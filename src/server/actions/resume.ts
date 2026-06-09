"use server";

import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { parseResume, RESUME_PARSE_VERSION } from "@/server/services/ai/parse-resume";
import { matchJobsForUser } from "@/server/services/matcher/match";

type RequestUploadUrlResult =
  | { error: string }
  | { success: true; uploadUrl: string; storagePath: string; token: string };

type UploadResult =
  | { error: string }
  | {
      success: true;
      resumeId: string;
      matchSummary?: { jobsConsidered: number; upserted: number; scoredAbove: number };
    };

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB — also enforced at bucket level
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "text/plain",
]);
const RESUMES_BUCKET = "resumes";

/**
 * Sanitize a user-provided filename for use in a storage path.
 * Replaces anything that isn't alphanumeric, dot, dash, or underscore with
 * underscore. Path traversal prevention: drops any "/" or ".." sequences.
 * Falls back to "resume" if the sanitized name is empty.
 */
function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, "_")
    .replace(/\.\./g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned.length > 0 ? cleaned : "resume";
}

/**
 * Step 1 of the upload flow. Validates the request and generates a signed
 * Supabase Storage upload URL scoped to the user's own folder via RLS.
 *
 * The client then PUTs the file directly to this URL (browser → Supabase),
 * bypassing the Vercel 4.5 MB body limit entirely.
 *
 * Validation:
 * - User is authenticated
 * - filename is non-empty
 * - fileSize <= 5 MB
 * - contentType is in the allowed set
 *
 * Returns the signed URL + storagePath. The storagePath is what the client
 * passes to uploadMasterResumeAction in Step 3.
 */
export async function requestResumeUploadUrlAction(
  filename: string,
  fileSize: number,
  contentType: string,
): Promise<RequestUploadUrlResult> {
  if (!filename || filename.length === 0) return { error: "Filename is required" };
  if (fileSize <= 0) return { error: "File appears empty" };
  if (fileSize > MAX_FILE_BYTES) return { error: "File too large (max 5 MB)" };
  if (!ALLOWED_MIME.has(contentType))
    return { error: "Unsupported file type. Upload PDF, DOCX, or plain text." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { error: "Not authenticated" };

  const safeName = sanitizeFilename(filename);
  const timestamp = Date.now();
  const storagePath = `${authUser.id}/${timestamp}-${safeName}`;

  const { data, error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    logger.error(
      { authId: authUser.id, err: error?.message ?? "no data" },
      "resume.upload_url.failed",
    );
    return { error: "Couldn't prepare upload. Try again." };
  }

  logger.info(
    { authId: authUser.id, storagePath, fileSize, contentType },
    "resume.upload_url.created",
  );

  return {
    success: true,
    uploadUrl: data.signedUrl,
    storagePath: data.path,
    token: data.token,
  };
}

/**
 * Step 3 of the upload flow. After the client has uploaded the file to
 * Supabase Storage via the signed URL, this action downloads it server-side,
 * extracts text, parses via LLM, persists as the new master resume, and
 * triggers the matcher.
 *
 * Master-switching is non-destructive: the previous master row stays in DB
 * with isMaster=false. This preserves provenance for any tailored resumes
 * (TailoredResume.masterResumeId, Phase 2G) derived from older versions.
 *
 * The uploaded file is DELETED from Supabase Storage in a finally block
 * (success OR failure). Storage is a transit zone, not a destination —
 * net usage per upload is zero. This keeps us well under the 1 GB free-tier
 * storage quota even at scale.
 */
export async function uploadMasterResumeAction(storagePath: string): Promise<UploadResult> {
  if (!storagePath || typeof storagePath !== "string") return { error: "Invalid storage path" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { error: "Not authenticated" };

  // Defense in depth: verify the path starts with this user's authId.
  // RLS would also reject this, but failing fast in app code gives a
  // clearer error message than a generic storage permission error.
  const expectedPrefix = `${authUser.id}/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    logger.warn({ authId: authUser.id, storagePath }, "resume.upload.path_mismatch");
    return { error: "Storage path doesn't belong to you" };
  }

  const appUser = await prisma.user.findUnique({ where: { authId: authUser.id } });
  if (!appUser) {
    logger.error({ authId: authUser.id }, "resume.upload.user_not_found");
    return { error: "Couldn't find your account." };
  }

  let rawText: string;
  let fileName: string;
  let fileSize: number;
  let contentType: string;

  // Outer try captures download + processing failures, but cleanup ALWAYS
  // runs via the finally block so we don't leave orphaned files in Storage.
  try {
    // Download the file from Supabase Storage
    const { data: fileBlob, error: downloadErr } = await supabase.storage
      .from(RESUMES_BUCKET)
      .download(storagePath);

    if (downloadErr || !fileBlob) {
      logger.error(
        { authId: authUser.id, storagePath, err: downloadErr?.message },
        "resume.upload.download_failed",
      );
      return { error: "Couldn't read the uploaded file. Try again." };
    }

    fileSize = fileBlob.size;
    contentType = fileBlob.type;
    // Filename: take the timestamp-name portion of the storage path
    const pathParts = storagePath.split("/");
    fileName = pathParts[pathParts.length - 1] ?? "resume";

    if (fileSize > MAX_FILE_BYTES) {
      return { error: "File too large (max 5 MB)" };
    }
    if (!ALLOWED_MIME.has(contentType)) {
      return { error: "Unsupported file type. Upload PDF, DOCX, or plain text." };
    }

    // Extract text from the file
    try {
      rawText = await extractText(fileBlob, contentType);
    } catch (err) {
      logger.error({ err: (err as Error).message, fileName }, "resume.upload.extract_failed");
      return { error: "Couldn't read the file. Try a different format." };
    }

    if (rawText.trim().length < 100) {
      return { error: "Resume looks empty or unreadable. Try a different file." };
    }
  } finally {
    // Cleanup: delete the file from Storage regardless of success or failure.
    // We don't await this in a way that blocks the response — fire and
    // forget. If it fails the storage will eventually be cleaned up via
    // bucket lifecycle policies (future Phase 2H work) or we can add a
    // periodic cleanup script. Worst case: 5 MB orphan per failed upload.
    void supabase.storage
      .from(RESUMES_BUCKET)
      .remove([storagePath])
      .then((res) => {
        if (res.error) {
          logger.warn(
            { authId: authUser.id, storagePath, err: res.error.message },
            "resume.upload.cleanup_failed",
          );
        }
      });
  }

  // Parse is an ENHANCEMENT, not a gate. The empty-file block above already
  // stopped truly unreadable uploads. If parsing fails here, we still let the
  // user through with a minimal resume (raw text preserved), so onboarding is
  // never hard-blocked by an LLM hiccup. Failures are logged for later repair.
  let parsed: Awaited<ReturnType<typeof parseResume>> | null = null;
  try {
    parsed = await parseResume(rawText);
  } catch (err) {
    logger.error(
      { userId: appUser.id, err: (err as Error).message, name: (err as Error).name },
      "resume.upload.parse_failed_degraded",
    );
    parsed = null;
  }

  const result = await prisma.$transaction(async (tx) => {
    const previousMaster = await tx.resumeVersion.findFirst({
      where: { userId: appUser.id, isMaster: true },
      select: { id: true },
    });
    if (previousMaster) {
      await tx.resumeVersion.update({
        where: { id: previousMaster.id },
        data: { isMaster: false },
      });
    }
    const created = await tx.resumeVersion.create({
      data: {
        userId: appUser.id,
        isMaster: true,
        contentJson: { rawText },
        parsedJson: parsed ?? undefined,
        parsedAt: parsed ? new Date() : null,
        parseVersion: parsed ? RESUME_PARSE_VERSION : null,
        fileName,
        fileSize,
      },
      select: { id: true },
    });
    return { previousMasterId: previousMaster?.id ?? null, newId: created.id };
  });

  if (result.previousMasterId) {
    logger.info(
      { userId: appUser.id, oldMasterId: result.previousMasterId, newMasterId: result.newId },
      "resume.master.switched",
    );
  } else {
    logger.info({ userId: appUser.id, newMasterId: result.newId }, "resume.master.created");
  }

  // Trigger re-match after resume upload. The new master's resumeId +
  // parseVersion are part of the matchVersion hash, so all existing matches
  // become stale-version and get re-scored against the new skills. Failures
  // do NOT fail the upload — resume is persisted, daily cron will re-run
  // matcher tomorrow if needed.
  let matchSummary: { jobsConsidered: number; upserted: number; scoredAbove: number } | undefined;
  try {
    const summary = await matchJobsForUser({ userId: appUser.id, force: true });
    matchSummary = {
      jobsConsidered: summary.jobsConsidered,
      upserted: summary.upserted,
      scoredAbove: summary.scoredAbove,
    };
    logger.info({ userId: appUser.id, ...matchSummary }, "resume.upload.matcher_completed");
  } catch (err) {
    logger.error(
      { userId: appUser.id, err: (err as Error).message },
      "resume.upload.matcher_failed",
    );
  }

  return { success: true, resumeId: result.newId, matchSummary };
}

async function extractText(fileBlob: Blob, contentType: string): Promise<string> {
  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  if (contentType === "text/plain") return buffer.toString("utf8");
  if (contentType === "application/pdf") {
    const { extractText: unpdfExtract } = await import("unpdf");
    const { text } = await unpdfExtract(new Uint8Array(buffer), { mergePages: true });
    return text;
  }
  if (contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    // Mammoth extracts the raw text content from a .docx file's XML structure.
    // We deliberately discard the HTML formatting output and use rawText only —
    // downstream the LLM parser works from plain text, not from formatting hints.
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error(`Unsupported file type for extraction: ${contentType}`);
}

type SetMasterResult =
  | { error: string }
  | {
      success: true;
      newMasterId: string;
      matchSummary?: { jobsConsidered: number; upserted: number; scoredAbove: number };
    };

/**
 * Switch which existing ResumeVersion is the user's master. Non-destructive:
 * the previous master row stays in DB with isMaster=false (preserves provenance
 * for any tailored resumes derived from it).
 *
 * Triggers the matcher synchronously after the switch — the new master's
 * resumeId + parseVersion are part of the matchVersion hash, so all existing
 * matches become stale-version and get re-scored against the new resume's
 * skills. Matcher failure does NOT fail the switch — the daily cron picks up.
 */
export async function setMasterResumeAction(resumeId: string): Promise<SetMasterResult> {
  if (!resumeId || typeof resumeId !== "string") return { error: "Invalid resume id" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { error: "Not authenticated" };

  const appUser = await prisma.user.findUnique({ where: { authId: authUser.id } });
  if (!appUser) {
    logger.error({ authId: authUser.id }, "resume.set_master.user_not_found");
    return { error: "Couldn't find your account." };
  }

  const target = await prisma.resumeVersion.findUnique({
    where: { id: resumeId },
    select: { id: true, userId: true, isMaster: true },
  });
  if (!target || target.userId !== appUser.id) {
    logger.warn({ userId: appUser.id, resumeId }, "resume.set_master.not_owned");
    return { error: "Resume not found" };
  }
  if (target.isMaster) return { error: "Already your master resume" };

  const result = await prisma.$transaction(async (tx) => {
    const previousMaster = await tx.resumeVersion.findFirst({
      where: { userId: appUser.id, isMaster: true },
      select: { id: true },
    });
    if (previousMaster) {
      await tx.resumeVersion.update({
        where: { id: previousMaster.id },
        data: { isMaster: false },
      });
    }
    await tx.resumeVersion.update({
      where: { id: target.id },
      data: { isMaster: true },
    });
    return { previousMasterId: previousMaster?.id ?? null, newMasterId: target.id };
  });

  logger.info(
    {
      userId: appUser.id,
      oldMasterId: result.previousMasterId,
      newMasterId: result.newMasterId,
    },
    "resume.master.switched",
  );

  let matchSummary: { jobsConsidered: number; upserted: number; scoredAbove: number } | undefined;
  try {
    const summary = await matchJobsForUser({ userId: appUser.id, force: true });
    matchSummary = {
      jobsConsidered: summary.jobsConsidered,
      upserted: summary.upserted,
      scoredAbove: summary.scoredAbove,
    };
    logger.info({ userId: appUser.id, ...matchSummary }, "resume.set_master.matcher_completed");
  } catch (err) {
    logger.error(
      { userId: appUser.id, err: (err as Error).message },
      "resume.set_master.matcher_failed",
    );
  }

  return { success: true, newMasterId: result.newMasterId, matchSummary };
}
