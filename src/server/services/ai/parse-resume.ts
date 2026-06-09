// src/server/services/ai/parse-resume.ts
import { z } from "zod";
import { logger } from "@/server/lib/logger";
import {
  getLLMProvider,
  LLMAuthError,
  LLMRateLimitError,
  LLMTransportError,
  LLMValidationError,
} from "./llm";

export const RESUME_PARSE_VERSION = "groq-llama-3.3-70b-resume-v3";
const RESUME_TRUNCATE_CHARS = 12_000;
const MAX_WORK_HISTORY = 20;
const MAX_EDUCATION = 10;
const MAX_SKILLS = 80;
const MAX_BULLETS_PER_ROLE = 10;

// Coerce a year that may arrive as a numeric string ("2021") into a number.
// Non-numeric or missing -> null. Field stays typed as number downstream.
const yearField = z.preprocess((v) => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\d{4}$/.test(v.trim())) return Number(v.trim());
  return null;
}, z.number().int().min(1950).max(2100).nullable().catch(null));

// String field that degrades to null if the model returns the wrong shape.
const softStr = (max: number) => z.string().max(max).nullable().catch(null);

export const ResumeParseSchema = z.object({
  fullName: softStr(120),
  email: softStr(120),
  phone: softStr(40),
  location: softStr(120),
  summary: softStr(800),
  totalYearsExperience: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return v;
    if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim());
    return null;
  }, z.number().int().min(0).max(60).nullable().catch(null)),
  currentRole: softStr(120),
  currentCompany: softStr(120),
  education: z
    .array(
      z.object({
        school: z.string().max(160).catch(""),
        degree: softStr(120),
        field: softStr(120),
        startYear: yearField,
        endYear: yearField,
      }),
    )
    .max(MAX_EDUCATION)
    .catch([]),
  workHistory: z
    .array(
      z.object({
        company: softStr(160),
        title: softStr(160),
        startDate: softStr(40),
        endDate: softStr(40),
        bullets: z.array(z.string().max(400)).max(MAX_BULLETS_PER_ROLE).catch([]),
      }),
    )
    .max(MAX_WORK_HISTORY)
    .catch([]),
  skills: z.array(z.string().max(60)).max(MAX_SKILLS).catch([]),
  links: z
    .object({
      linkedin: softStr(200),
      github: softStr(200),
      portfolio: softStr(200),
      other: softStr(200),
    })
    .catch({ linkedin: null, github: null, portfolio: null, other: null }),
});
export type ResumeParse = z.infer<typeof ResumeParseSchema>;

const SYSTEM_PROMPT =
  "You extract structured data from resumes. Return ONLY a JSON object matching the requested shape exactly. Use null when a field is missing or unclear. Never invent details that are not in the resume. Keep bullet text verbatim from the resume — do not summarize, rephrase, or expand it. For skills, extract every named technology, library, framework, language, tool, platform, database, and ML model in the resume — do not deduplicate semantically similar terms (if the resume names both 'GCP' and 'GCP Vertex AI', include both; if it names 'sentence-bert' and 'sentence-transformers', include both).";

function buildUserPrompt(rawText: string): string {
  const trimmed =
    rawText.length > RESUME_TRUNCATE_CHARS ? rawText.slice(0, RESUME_TRUNCATE_CHARS) : rawText;
  return [
    `Resume text:`,
    trimmed,
    ``,
    `Return JSON with this exact shape:`,
    `{`,
    `  "fullName": string | null,`,
    `  "email": string | null,`,
    `  "phone": string | null,`,
    `  "location": string | null,`,
    `  "summary": string | null,`,
    `  "totalYearsExperience": integer 0-60 | null,`,
    `  "currentRole": string | null,`,
    `  "currentCompany": string | null,`,
    `  "education": Array<{ school, degree, field, startYear, endYear }>,`,
    `  "workHistory": Array<{ company, title, startDate, endDate, bullets[] }>,`,
    `  "skills": string[],`,
    `  "links": { "linkedin": string|null, "github": string|null, "portfolio": string|null, "other": string|null }`,
    `}`,
    ``,
    `Rules:`,
    `- bullets: keep verbatim from the resume. No rewriting.`,
    `- skills: every named technology, library, framework, language, tool, platform, database, and ML model in the resume. Lowercase. Dedupe exact duplicates only — do NOT merge variants ('sentence-bert' and 'sentence-transformers' are different entries if both appear; 'gcp' and 'gcp vertex ai' are different entries if both appear). Cleaning of misspellings, course providers, and garbage terms happens after extraction in code — do not filter here.`,
    `- dates: prefer "Jan 2024" or "2024-01" format. null if missing.`,
    `- endDate: null if the role is current ("Present", "Now").`,
    `- summary: ONLY include if a summary/objective section is in the resume. Otherwise null.`,
    `- workHistory: max ${MAX_WORK_HISTORY}, ordered newest first.`,
    `- education: max ${MAX_EDUCATION}.`,
    `- skills: max ${MAX_SKILLS}.`,
  ].join("\n");
}

/**
 * Skills that should NEVER appear in the output even if the LLM extracts them.
 * Course providers, learning platforms, generic single-word filler.
 * Lowercase keys. Add new entries here as patterns emerge from real resumes.
 */
const SKILL_BLOCKLIST = new Set<string>([
  // Course providers and learning platforms
  "coursera",
  "udemy",
  "edx",
  "datacamp",
  "pluralsight",
  "linkedin learning",
  "udacity",
  // Generic filler words that aren't named technologies
  "cloud",
  "ai",
  "ml",
  "machine learning", // too generic on its own; specific frameworks captured separately
  "deep learning",
  "data science",
  "computer science",
]);

/**
 * Canonical-form fixes for common OCR errors and misreads.
 * Lowercase keys → lowercase canonical values.
 * Add new entries when a known typo pattern emerges.
 */
const SKILL_CANONICAL: Record<string, string> = {
  // OCR/extraction errors observed in real resumes
  chrodadb: "chromadb",
  tensoflow: "tensorflow",
  tensorflw: "tensorflow",
  pythn: "python",
  pyhon: "python",
  qllor: "qlora",
  llor: "lora",
  sps: "spss",
  pyrotch: "pytorch",
  pytroch: "pytorch",
};

function sanitize(raw: ResumeParse): ResumeParse {
  const skills = Array.from(
    new Set(
      raw.skills
        .map((s) => s.trim().toLowerCase())
        .map((s) => SKILL_CANONICAL[s] ?? s) // canonical-form fix
        .filter((s) => s.length > 0)
        .filter((s) => !SKILL_BLOCKLIST.has(s)), // blocklist removal
    ),
  ).slice(0, MAX_SKILLS);
  return { ...raw, skills };
}

export async function parseResume(rawText: string): Promise<ResumeParse> {
  const llm = await getLLMProvider();
  const startedAt = Date.now();
  logger.info(
    { model: llm.model, version: RESUME_PARSE_VERSION, chars: rawText.length },
    "ai.resume.parse.start",
  );

  try {
    const raw = await llm.generate({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(rawText),
      schema: ResumeParseSchema,
      maxTokens: 4096,
    });
    const clean = sanitize(raw);
    logger.info(
      {
        durationMs: Date.now() - startedAt,
        workHistoryCount: clean.workHistory.length,
        educationCount: clean.education.length,
        skillsCount: clean.skills.length,
      },
      "ai.resume.parse.success",
    );
    return clean;
  } catch (err) {
    if (err instanceof LLMValidationError) {
      logger.warn(
        { err: err.message, rawOutput: err.rawOutput.slice(0, 500) },
        "ai.resume.parse.validation_failed",
      );
    } else if (err instanceof LLMRateLimitError) {
      logger.warn({ err: err.message }, "ai.resume.parse.ratelimit");
    } else if (err instanceof LLMTransportError) {
      logger.warn({ err: err.message }, "ai.resume.parse.transport_failed");
    } else if (err instanceof LLMAuthError) {
      logger.error({ err: err.message }, "ai.resume.parse.auth_failed");
    } else {
      logger.error({ err: (err as Error).message }, "ai.resume.parse.failed");
    }
    throw err;
  }
}

export const __internals = { buildUserPrompt, sanitize, SYSTEM_PROMPT };
