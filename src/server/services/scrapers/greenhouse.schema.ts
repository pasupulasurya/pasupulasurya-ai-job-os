import { z } from "zod";

/**
 * Zod schemas validating the Greenhouse public Job Board API response.
 *
 * Endpoint: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
 * Docs:     https://developers.greenhouse.io/job-board.html
 *
 * Design philosophy:
 *  - STRICT on fields the scraper actually uses: id, title, location.name,
 *    absolute_url, updated_at. These must be the expected shape or we
 *    skip the job.
 *  - PERMISSIVE on "metadata" and other free-form fields. Greenhouse
 *    customers populate these any way they want (strings, arrays, booleans,
 *    objects, numbers). We store them as-is in rawJson for analytics.
 *  - PER-JOB parsing: orchestrators validate one job at a time so a single
 *    malformed job doesn't reject an entire company's response.
 */

export const GreenhouseLocationSchema = z.object({
  name: z.string(),
});

export const GreenhouseMetadataSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    // Free-form: can be string, array, boolean, object, number, null
    value: z.unknown(),
    value_type: z.string().optional(),
  })
  .passthrough();

export const GreenhouseJobSchema = z
  .object({
    id: z.number(),
    internal_job_id: z.number().optional(),
    title: z.string(),
    updated_at: z.string(), // ISO-8601 — we'll parse to Date downstream
    location: GreenhouseLocationSchema,
    absolute_url: z.string().url(),
    metadata: z
      .array(GreenhouseMetadataSchema)
      .nullable()
      .default([])
      .transform((v) => v ?? []),
    content: z.string().optional(), // HTML when ?content=true
    departments: z.array(z.unknown()).optional(),
    offices: z.array(z.unknown()).optional(),
  })
  .passthrough();

/**
 * Top-level response — permissive: just ensures `jobs` is an array.
 * We do NOT validate each job here; per-job validation happens in the
 * orchestrator so one malformed job doesn't fail the whole company.
 */
export const GreenhouseJobsResponseSchema = z.object({
  jobs: z.array(z.unknown()),
  meta: z.object({ total: z.number().optional() }).passthrough().optional(),
});

// Inferred TypeScript types — single source of truth
export type GreenhouseLocation = z.infer<typeof GreenhouseLocationSchema>;
export type GreenhouseMetadata = z.infer<typeof GreenhouseMetadataSchema>;
export type GreenhouseJob = z.infer<typeof GreenhouseJobSchema>;

/**
 * Returns the raw jobs array from a Greenhouse response.
 * Validates ONLY the top-level shape: `{ jobs: unknown[] }`.
 * Per-job validation is the orchestrator's job.
 */
export function parseGreenhouseJobsArray(raw: unknown): unknown[] {
  return GreenhouseJobsResponseSchema.parse(raw).jobs;
}

/**
 * Validates ONE job against the strict schema.
 * Throws ZodError if the job is malformed; orchestrator catches and skips.
 */
export function parseGreenhouseJob(raw: unknown): GreenhouseJob {
  return GreenhouseJobSchema.parse(raw);
}
