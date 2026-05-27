// src/server/services/ai/enrich.ts
import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
import { logger } from "@/server/lib/logger";
import {
  getLLMProvider,
  LLMAuthError,
  LLMRateLimitError,
  LLMTransportError,
  LLMValidationError,
} from "./llm";

export const ENRICHMENT_VERSION = "groq-llama-3.3-70b-v1";
const DESCRIPTION_TRUNCATE_CHARS = 4000;
const MAX_SKILLS = 20;
const THROTTLE_MS = 500;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const EnrichmentSchema = z.object({
  seniority: z.enum(["entry", "mid", "senior", "staff"]).nullable(),
  experienceYears: z.number().int().min(0).max(40).nullable(),
  skills: z.array(z.string()).max(MAX_SKILLS),
  sponsorsVisa: z.boolean().nullable(),
  stemOptFriendly: z.boolean().nullable(),
});
export type Enrichment = z.infer<typeof EnrichmentSchema>;

const SYSTEM_PROMPT =
  "You extract structured data from US job postings. Return ONLY a JSON object with the exact shape requested. Use null when a field cannot be confidently determined. Never invent details not present in the posting.";

function buildUserPrompt(title: string, description: string): string {
  const trimmed =
    description.length > DESCRIPTION_TRUNCATE_CHARS
      ? description.slice(0, DESCRIPTION_TRUNCATE_CHARS)
      : description;
  return [
    `Job title: ${title}`,
    `Posting:\n${trimmed}`,
    ``,
    `Return JSON with this exact shape:`,
    `{`,
    `  "seniority": "entry" | "mid" | "senior" | "staff" | null,`,
    `  "experienceYears": integer 0-40 | null,`,
    `  "skills": string[] (lowercase, max ${MAX_SKILLS}),`,
    `  "sponsorsVisa": true | false | null,`,
    `  "stemOptFriendly": true | false | null`,
    `}`,
    ``,
    `Rules:`,
    `- seniority: "entry" = junior/new grad, "mid" = 2-5y, "senior" = 5-8y, "staff" = 8y+/principal/staff.`,
    `- experienceYears: lower bound if range. null if unspecified.`,
    `- skills: technical only (languages, frameworks, tools). Lowercase. No soft skills.`,
    `- sponsorsVisa: true if posting explicitly offers sponsorship. false if explicitly excludes (citizens-only, clearance). null if silent.`,
    `- stemOptFriendly: true if explicitly STEM/OPT-friendly. false if explicitly excludes. null if silent.`,
  ].join("\n");
}

function sanitize(raw: Enrichment): Enrichment {
  const skills = Array.from(
    new Set(raw.skills.map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0)),
  ).slice(0, MAX_SKILLS);
  return { ...raw, skills };
}

export const __internals = { buildUserPrompt, sanitize, SYSTEM_PROMPT };

export type EnrichOptions = {
  force?: boolean;
  limit?: number;
  dryRun?: boolean;
};

export type EnrichSummary = {
  processed: number;
  success: number;
  validationFailed: number;
  transportFailed: number;
  unknownFailed: number;
  durationMs: number;
  model: string;
  version: string;
};

export async function enrichJobs(opts: EnrichOptions = {}): Promise<EnrichSummary> {
  const { force = false, limit, dryRun = false } = opts;
  const startedAt = Date.now();
  const llm = await getLLMProvider();

  const where = {
    deletedAt: null,
    description: { not: null },
    ...(force
      ? {}
      : { OR: [{ enrichedAt: null }, { enrichmentVersion: { not: ENRICHMENT_VERSION } }] }),
  };

  const jobs = await prisma.job.findMany({
    where,
    select: { id: true, title: true, description: true },
    orderBy: { scrapedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  logger.info(
    { count: jobs.length, force, limit, dryRun, model: llm.model, version: ENRICHMENT_VERSION },
    "ai.enrich.run.start",
  );

  const counters = {
    processed: 0,
    success: 0,
    validationFailed: 0,
    transportFailed: 0,
    unknownFailed: 0,
  };

  for (const job of jobs) {
    counters.processed++;
    if (!job.description) continue;
    try {
      const raw = await llm.generate({
        system: __internals.SYSTEM_PROMPT,
        user: __internals.buildUserPrompt(job.title, job.description),
        schema: EnrichmentSchema,
        maxTokens: 512,
      });
      const clean = __internals.sanitize(raw);
      if (dryRun) {
        logger.info({ jobId: job.id, ...clean }, "ai.enrich.job.dryrun");
      } else {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            seniority: clean.seniority,
            experienceYears: clean.experienceYears,
            skills: clean.skills,
            sponsorsVisa: clean.sponsorsVisa,
            stemOptFriendly: clean.stemOptFriendly,
            enrichedAt: new Date(),
            enrichmentVersion: ENRICHMENT_VERSION,
          },
        });
      }
      counters.success++;
      logger.info(
        {
          jobId: job.id,
          seniority: clean.seniority,
          sponsorsVisa: clean.sponsorsVisa,
          skillsCount: clean.skills.length,
        },
        "ai.enrich.job.success",
      );
      await sleep(THROTTLE_MS);
    } catch (err) {
      if (err instanceof LLMAuthError) {
        logger.error({ err: err.message }, "ai.enrich.run.aborted.auth");
        throw err;
      }
      if (err instanceof LLMRateLimitError) {
        logger.warn(
          { jobId: job.id, processed: counters.processed },
          "ai.enrich.run.aborted.ratelimit",
        );
        break;
      }
      if (err instanceof LLMValidationError) {
        counters.validationFailed++;
        logger.warn(
          { jobId: job.id, err: err.message, rawOutput: err.rawOutput.slice(0, 500) },
          "ai.enrich.job.validation_failed",
        );
      } else if (err instanceof LLMTransportError) {
        counters.transportFailed++;
        logger.warn({ jobId: job.id, err: err.message }, "ai.enrich.job.transport_failed");
      } else {
        counters.unknownFailed++;
        logger.error({ jobId: job.id, err: (err as Error).message }, "ai.enrich.job.failed");
      }
    }
  }

  const summary: EnrichSummary = {
    ...counters,
    durationMs: Date.now() - startedAt,
    model: llm.model,
    version: ENRICHMENT_VERSION,
  };
  logger.info(summary, "ai.enrich.run.complete");
  return summary;
}
