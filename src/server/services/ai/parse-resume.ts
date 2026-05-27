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

export const RESUME_PARSE_VERSION = "groq-llama-3.3-70b-resume-v1";
const RESUME_TRUNCATE_CHARS = 12_000;
const MAX_WORK_HISTORY = 20;
const MAX_EDUCATION = 10;
const MAX_SKILLS = 50;
const MAX_BULLETS_PER_ROLE = 10;

export const ResumeParseSchema = z.object({
  fullName: z.string().max(120).nullable(),
  email: z.string().max(120).nullable(),
  phone: z.string().max(40).nullable(),
  location: z.string().max(120).nullable(),
  summary: z.string().max(800).nullable(),
  totalYearsExperience: z.number().int().min(0).max(60).nullable(),
  currentRole: z.string().max(120).nullable(),
  currentCompany: z.string().max(120).nullable(),
  education: z
    .array(
      z.object({
        school: z.string().max(160),
        degree: z.string().max(120).nullable(),
        field: z.string().max(120).nullable(),
        startYear: z.number().int().min(1950).max(2100).nullable(),
        endYear: z.number().int().min(1950).max(2100).nullable(),
      }),
    )
    .max(MAX_EDUCATION),
  workHistory: z
    .array(
      z.object({
        company: z.string().max(160),
        title: z.string().max(160),
        startDate: z.string().max(40).nullable(),
        endDate: z.string().max(40).nullable(),
        bullets: z.array(z.string().max(400)).max(MAX_BULLETS_PER_ROLE),
      }),
    )
    .max(MAX_WORK_HISTORY),
  skills: z.array(z.string().max(60)).max(MAX_SKILLS),
  links: z.object({
    linkedin: z.string().max(200).nullable(),
    github: z.string().max(200).nullable(),
    portfolio: z.string().max(200).nullable(),
    other: z.string().max(200).nullable(),
  }),
});
export type ResumeParse = z.infer<typeof ResumeParseSchema>;

const SYSTEM_PROMPT =
  "You extract structured data from resumes. Return ONLY a JSON object matching the requested shape exactly. Use null when a field is missing or unclear. Never invent details that are not in the resume. Keep bullet text verbatim from the resume — do not summarize, rephrase, or expand it.";

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
    `- skills: technical skills only (languages, frameworks, tools, platforms). Lowercase. Dedupe.`,
    `- dates: prefer "Jan 2024" or "2024-01" format. null if missing.`,
    `- endDate: null if the role is current ("Present", "Now").`,
    `- summary: ONLY include if a summary/objective section is in the resume. Otherwise null.`,
    `- workHistory: max ${MAX_WORK_HISTORY}, ordered newest first.`,
    `- education: max ${MAX_EDUCATION}.`,
    `- skills: max ${MAX_SKILLS}.`,
  ].join("\n");
}

function sanitize(raw: ResumeParse): ResumeParse {
  const skills = Array.from(
    new Set(raw.skills.map((s) => s.trim().toLowerCase()).filter((s) => s.length > 0)),
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
