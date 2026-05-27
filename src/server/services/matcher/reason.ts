// src/server/services/matcher/reason.ts
//
// Generates "why this job" reason paragraphs for a user's top-N matched jobs.
//
// Architectural shape:
// - Batched per-user: ONE LLM call returns reasons for top-10 jobs at once.
//   Faster + more coherent tone vs 10 separate calls.
// - Uses llama-3.1-8b-instant (free tier, plenty of headroom).
// - Integrity rule (from VISION): reasons reference facts from BOTH the
//   resume and the job description. Never invent details not present in
//   either source.
// - Idempotency: skips matches that already have a non-null reason.
// - Per-item Zod parse with try/catch (1 bad row doesn't kill the batch).
// - Atomic prisma.$transaction writes all reasons in one round-trip.

import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
import { logger } from "@/server/lib/logger";
import {
  getLLMProvider,
  LLMAuthError,
  LLMRateLimitError,
  LLMTransportError,
  LLMValidationError,
} from "@/server/services/ai/llm";
import { ResumeParseSchema, type ResumeParse } from "@/server/services/ai/parse-resume";

export const REASON_VERSION = "groq-llama-3.3-70b-reason-v1";
const REASON_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_TOP_N = 10;

export type ReasonOptions = {
  userId: string;
  limit?: number;
  dryRun?: boolean;
  force?: boolean;
};

export type ReasonSummary = {
  userId: string;
  considered: number;
  alreadyHadReason: number;
  generated: number;
  failed: number;
  durationMs: number;
};

const ReasonBatchSchema = z.object({
  reasons: z
    .array(
      z.object({
        jobId: z.string().min(1),
        reason: z.string().min(20).max(900),
      }),
    )
    .max(20),
});

const SYSTEM_PROMPT = [
  "You write match reasons for a job-matching platform.",
  "Each reason is 2-3 sentences explaining why this job aligns with the candidate's background.",
  "Be specific and honest. Reference actual facts from both the candidate's resume AND the job posting.",
  "Never invent details that aren't in either source.",
  "Tone: direct, calm, never apologetic. Never use 'you would be perfect for' or sales language.",
  "Describe the alignment factually. No emojis. No exclamation marks.",
  "Vary your opening across reasons — do NOT start every reason the same way. Mix sentence structures.",
  "If the candidate's experience is below what the job asks for, mention both honestly (e.g. '3y of relevant experience for a role asking 5+').",
  'Return ONLY a JSON object: { "reasons": [{ "jobId": "<jobId>", "reason": "<paragraph>" }, ...] }',
].join("\n");

function coerceResumeParse(json: unknown): ResumeParse {
  const result = ResumeParseSchema.safeParse(json);
  if (!result.success) {
    throw new Error(`ResumeVersion.parsedJson failed re-validation: ${result.error.message}`);
  }
  return result.data;
}

function buildUserPrompt(
  resume: ResumeParse,
  jobs: Array<{ jobId: string; title: string; company: string; description: string | null }>,
): string {
  const resumeSummary = {
    currentRole: resume.currentRole,
    currentCompany: resume.currentCompany,
    totalYearsExperience: resume.totalYearsExperience,
    summary: resume.summary,
    skills: resume.skills.slice(0, 30),
    mostRecentBullets: resume.workHistory[0]?.bullets?.slice(0, 5) ?? [],
  };

  const jobsBlock = jobs
    .map((j, i) => {
      const desc = j.description ? j.description.slice(0, 1500) : "(no description)";
      return `Job ${i + 1} (jobId: ${j.jobId}):\nTitle: ${j.title}\nCompany: ${j.company}\nPosting: ${desc}`;
    })
    .join("\n\n---\n\n");

  return [
    "Candidate resume facts (compact JSON):",
    JSON.stringify(resumeSummary, null, 2),
    "",
    "Jobs to write reasons for:",
    jobsBlock,
    "",
    'Return JSON: { "reasons": [{ "jobId": "<id from above>", "reason": "2-3 sentences" }, ...] }',
    "One reason per jobId. Match jobIds exactly.",
  ].join("\n");
}

export async function generateReasonsForUser(opts: ReasonOptions): Promise<ReasonSummary> {
  const { userId, limit = DEFAULT_TOP_N, dryRun = false, force = false } = opts;
  const startedAt = Date.now();

  // Load user + master resume
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { resumes: { where: { isMaster: true }, take: 1 } },
  });
  if (!user) throw new Error(`User not found: ${userId}`);
  const master = user.resumes[0];
  if (!master?.parsedJson) throw new Error(`User has no parsed master resume`);

  const resume = coerceResumeParse(master.parsedJson);

  // Load top-N matches, optionally only those missing reasons
  const matches = await prisma.userJobMatch.findMany({
    where: {
      userId,
      ...(force ? {} : { reason: null }),
    },
    orderBy: { matchScore: "desc" },
    take: limit,
    include: { job: { select: { id: true, title: true, company: true, description: true } } },
  });

  if (matches.length === 0) {
    logger.info({ userId }, "reason.run.no_matches");
    return {
      userId,
      considered: 0,
      alreadyHadReason: 0,
      generated: 0,
      failed: 0,
      durationMs: Date.now() - startedAt,
    };
  }

  const counters = { considered: matches.length, alreadyHadReason: 0, generated: 0, failed: 0 };

  const jobs = matches.map((m) => ({
    jobId: m.job.id,
    title: m.job.title,
    company: m.job.company,
    description: m.job.description,
  }));

  logger.info(
    { userId, count: jobs.length, model: REASON_MODEL, version: REASON_VERSION, dryRun },
    "reason.run.start",
  );

  const llm = await getLLMProvider();

  let parsed: z.infer<typeof ReasonBatchSchema>;
  try {
    parsed = await llm.generate({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(resume, jobs),
      schema: ReasonBatchSchema,
      model: REASON_MODEL,
      maxTokens: 2048,
    });
  } catch (err) {
    if (err instanceof LLMValidationError) {
      logger.warn(
        { userId, err: err.message, rawOutput: err.rawOutput.slice(0, 800) },
        "reason.run.validation_failed",
      );
    } else if (err instanceof LLMRateLimitError) {
      logger.warn({ userId, err: err.message }, "reason.run.ratelimit");
    } else if (err instanceof LLMTransportError) {
      logger.warn({ userId, err: err.message }, "reason.run.transport_failed");
    } else if (err instanceof LLMAuthError) {
      logger.error({ userId, err: err.message }, "reason.run.auth_failed");
    } else {
      logger.error({ userId, err: (err as Error).message }, "reason.run.failed");
    }
    return { userId, ...counters, failed: counters.considered, durationMs: Date.now() - startedAt };
  }

  // Map jobId -> reason from LLM response
  const reasonsByJobId = new Map<string, string>();
  for (const r of parsed.reasons) {
    reasonsByJobId.set(r.jobId, r.reason);
  }

  if (dryRun) {
    for (const m of matches) {
      const r = reasonsByJobId.get(m.job.id);
      logger.info(
        { userId, jobId: m.job.id, title: m.job.title, reason: r ?? "(none returned)" },
        "reason.dryrun",
      );
    }
    return {
      userId,
      ...counters,
      generated: reasonsByJobId.size,
      durationMs: Date.now() - startedAt,
    };
  }

  // Atomic transaction: write all reasons
  const updates = matches
    .map((m) => {
      const reason = reasonsByJobId.get(m.job.id);
      if (!reason) return null;
      return prisma.userJobMatch.update({
        where: { id: m.id },
        data: { reason },
      });
    })
    .filter((u): u is NonNullable<typeof u> => u !== null);

  try {
    await prisma.$transaction(updates);
    counters.generated = updates.length;
    counters.failed = matches.length - updates.length;
  } catch (err) {
    logger.error({ userId, err: (err as Error).message }, "reason.run.write_failed");
    counters.failed = matches.length;
  }

  const summary: ReasonSummary = { userId, ...counters, durationMs: Date.now() - startedAt };
  logger.info(summary, "reason.run.complete");
  return summary;
}
