"use server";

import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { parseResume, RESUME_PARSE_VERSION } from "@/server/services/ai/parse-resume";

type ActionResult = { error: string } | { success: true; resumeId: string };

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "text/plain",
]);

/**
 * Upload a resume, parse it via LLM, store as the user's new master.
 *
 * Master-switching is non-destructive: the previous master row stays in DB
 * with isMaster=false. This preserves provenance for any tailored resumes
 * (TailoredResume.masterResumeId, Phase 2G) derived from older versions.
 */
export async function uploadMasterResumeAction(formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided" };
  if (file.size > MAX_FILE_BYTES) return { error: "File too large (max 5 MB)" };
  if (!ALLOWED_MIME.has(file.type))
    return { error: "Unsupported file type. Upload PDF, DOCX, or plain text." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return { error: "Not authenticated" };

  const appUser = await prisma.user.findUnique({ where: { authId: authUser.id } });
  if (!appUser) {
    logger.error({ authId: authUser.id }, "resume.upload.user_not_found");
    return { error: "Couldn't find your account." };
  }

  let rawText: string;
  try {
    rawText = await extractText(file);
  } catch (err) {
    logger.error(
      { err: (err as Error).message, fileName: file.name },
      "resume.upload.extract_failed",
    );
    return { error: "Couldn't read the file. Try a different format." };
  }
  if (rawText.trim().length < 100) {
    return { error: "Resume looks empty or unreadable. Try a different file." };
  }

  let parsed;
  try {
    parsed = await parseResume(rawText);
  } catch {
    return { error: "Couldn't parse the resume. Try again in a moment." };
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
        parsedJson: parsed,
        parsedAt: new Date(),
        parseVersion: RESUME_PARSE_VERSION,
        fileName: file.name,
        fileSize: file.size,
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

  return { success: true, resumeId: result.newId };
}

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  if (file.type === "text/plain") return buffer.toString("utf8");
  if (file.type === "application/pdf") {
    const { extractText: unpdfExtract } = await import("unpdf");
    const { text } = await unpdfExtract(new Uint8Array(buffer), { mergePages: true });
    return text;
  }
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    // Mammoth extracts the raw text content from a .docx file's XML structure.
    // We deliberately discard the HTML formatting output and use rawText only —
    // downstream the LLM parser works from plain text, not from formatting hints.
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error(`Unsupported file type for extraction: ${file.type}`);
}
