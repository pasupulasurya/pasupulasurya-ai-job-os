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

export const ENRICHMENT_VERSION = "groq-llama-3.1-8b-v4";
const ENRICHMENT_MODEL = "llama-3.1-8b-instant";
const DESCRIPTION_TRUNCATE_CHARS = 2000;
const MAX_SKILLS = 20;
const THROTTLE_MS = 500;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const EnrichmentSchema = z.object({
  seniority: z.enum(["entry", "mid", "senior", "staff"]).nullable(),
  experienceYears: z.number().int().min(0).max(40).nullable(),
  skills: z.preprocess((val) => {
    if (!Array.isArray(val)) return val;
    return Array.from(
      new Set(
        val
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim().toLowerCase())
          .filter((s) => s.length >= 2),
      ),
    );
  }, z.array(z.string()).max(MAX_SKILLS)),
  sponsorsVisa: z.boolean().nullable(),
  stemOptFriendly: z.boolean().nullable(),
});
export type Enrichment = z.infer<typeof EnrichmentSchema>;

const SYSTEM_PROMPT = [
  "You extract structured data from US job postings. Return ONLY a JSON object with the exact shape requested. Use null when a field cannot be confidently determined.",
  "",
  "Critical anti-hallucination rules:",
  "- Never include a skill that is not explicitly named in the posting text.",
  "- Do not infer skills from company name, industry, or general 'tech company' context. A job at OpenAI is not automatically a Python job; a job at DoorDash is not automatically a JavaScript job.",
  "- If the role is non-technical (sales, account management, executive assistant, customer success, partnerships, marketing, recruiter, operations), the skills array must be empty UNLESS the posting explicitly requires technical work.",
  "- When uncertain, prefer empty arrays and null values over guessing.",
].join("\n");

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
    `- skills: technical skills explicitly named in the posting text (languages, frameworks, tools, platforms). Lowercase. No soft skills. No skills inferred from company name or job category. If the role is non-technical (sales, executive assistant, account executive, customer success, recruiter, marketing, partnerships, operations, strategy), return []. Only include a skill if you can quote the literal word from the posting.`,
    `- sponsorsVisa: true if posting explicitly offers sponsorship. false if explicitly excludes (citizens-only, clearance). null if silent.`,
    `- stemOptFriendly: true if explicitly STEM/OPT-friendly. false if explicitly excludes. null if silent.`,
  ].join("\n");
}

// Context-aware skill blocklist. The v3 prompt explicitly tells the LLM to
// return skills:[] for non-technical roles, but the LLM still hallucinates
// AI-coded skills (~5% of the time) when the job title contains words like
// "Technical Solutions" or "AI Account Executive". Tuesday's lesson:
// prompts are extraction tools, not quality filters. Same architectural
// pattern as SKILL_BLOCKLIST in parse-resume.ts — LLM extracts, code cleans.

// Non-technical role title patterns (substrings, case-insensitive).
// If the job title matches any of these, AI-coded skills get dropped.
// Order doesn't matter; first-match wins. Keep narrow — false positives
// (dropping a real ML role) are worse than false negatives (leaving one
// hallucination in).
const NON_TECH_TITLE_PATTERNS = [
  "account executive",
  "account manager",
  "account director",
  "accountant",
  "accounting",
  "sales development",
  "sales operations",
  "sales representative",
  "sales engineer",
  "recruiter",
  "recruiting",
  "talent acquisition",
  "talent partner",
  "legal counsel",
  "general counsel",
  "lawyer",
  "paralegal",
  "compliance",
  "customer success",
  "customer support",
  "customer experience",
  "marketing manager",
  "content marketing",
  "brand manager",
  "growth marketing",
  "partnerships",
  "business development",
  "biz dev",
  "strategist",
  "strategy lead",
  "executive assistant",
  "people operations",
  "people partner",
  "human resources",
  "hr business partner",
  "communications",
  "public relations",
  "facilities",
  "office manager",
  "administrative",
];

// AI-coded skills that get dropped if the title matches a non-tech pattern.
// Conservative list: only skills that are NEVER legitimately required for
// roles in NON_TECH_TITLE_PATTERNS. We deliberately exclude python, sql,
// data science, analytics — those CAN be legitimate skills for finance,
// accounting, or operations roles.
const AI_CODED_HALLUCINATED_SKILLS = new Set([
  "ai",
  "artificial intelligence",
  "ml",
  "machine learning",
  "deep learning",
  "neural network",
  "neural networks",
  "llm",
  "llms",
  "large language model",
  "large language models",
  "nlp",
  "natural language processing",
  "computer vision",
  "generative ai",
  "genai",
  "transformers",
]);

/**
 * Drop AI-coded skills from non-technical roles. Returns the same shape
 * as input. If the title doesn't match a non-tech pattern, returns input
 * unchanged. If a skill is dropped, logs the action so we can audit.
 */
function applyContextAwareSkillBlocklist(
  raw: Enrichment,
  jobTitle: string,
  jobId: string,
): Enrichment {
  const titleLower = jobTitle.toLowerCase();
  const isNonTechRole = NON_TECH_TITLE_PATTERNS.some((p) => titleLower.includes(p));
  if (!isNonTechRole) return raw;

  const dropped: string[] = [];
  const kept: string[] = [];
  for (const skill of raw.skills) {
    const skillLower = skill.toLowerCase().trim();
    if (AI_CODED_HALLUCINATED_SKILLS.has(skillLower)) {
      dropped.push(skill);
    } else {
      kept.push(skill);
    }
  }

  if (dropped.length > 0) {
    logger.info({ jobId, title: jobTitle, dropped, kept }, "ai.enrich.blocklist.applied");
  }

  return { ...raw, skills: kept };
}

function sanitize(raw: Enrichment): Enrichment {
  const skills = Array.from(
    new Set(raw.skills.map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0)),
  ).slice(0, MAX_SKILLS);
  return { ...raw, skills };
}

export const __internals = {
  buildUserPrompt,
  sanitize,
  applyContextAwareSkillBlocklist,
  SYSTEM_PROMPT,
};

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
        model: ENRICHMENT_MODEL,
      });
      const filtered = __internals.applyContextAwareSkillBlocklist(raw, job.title, job.id);
      const clean = __internals.sanitize(filtered);
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
