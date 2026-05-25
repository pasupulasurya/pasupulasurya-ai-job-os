import { z } from "zod";

/**
 * Zod schemas validating the Ashby public Job Board API response.
 *
 * Endpoint: https://api.ashbyhq.com/posting-api/job-board/{slug}
 * Docs:     https://ashbyhq.com/api/job-board (public, no auth required)
 *
 * Design philosophy:
 *  - STRICT on fields the scraper actually uses: id, title, location,
 *    jobUrl, publishedAt, isListed.
 *  - PERMISSIVE on side-info fields (address, workplaceType, descriptions)
 *    that Ashby customers populate inconsistently.
 *  - PER-JOB parsing: orchestrators validate one job at a time so a single
 *    malformed job doesn't reject an entire company's response.
 */

export const AshbySecondaryLocationSchema = z
  .object({
    location: z.string(),
  })
  .passthrough();

export const AshbyAddressSchema = z
  .object({
    postalAddress: z
      .object({
        addressCountry: z.string().optional(),
        addressRegion: z.string().optional(),
        addressLocality: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()
  .optional();

export const AshbyJobSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    department: z.string().nullable().optional(),
    team: z.string().nullable().optional(),
    employmentType: z.string().nullable().optional(),
    location: z.string(),
    secondaryLocations: z
      .array(AshbySecondaryLocationSchema)
      .nullable()
      .default([])
      .transform((v) => v ?? []),
    publishedAt: z.string(), // ISO-8601 datetime
    isListed: z.boolean(),
    isRemote: z
      .boolean()
      .nullable()
      .optional()
      .default(false)
      .transform((v) => v ?? false),
    workplaceType: z.string().nullable().optional(),
    address: AshbyAddressSchema.nullable(),
    jobUrl: z.string().url(),
    applyUrl: z.string().url().nullable().optional(),
    descriptionHtml: z.string().nullable().optional(),
    descriptionPlain: z.string().nullable().optional(),
  })
  .passthrough();

/**
 * Top-level response — permissive: just ensures `jobs` is an array.
 * Per-job validation happens in the orchestrator.
 */
export const AshbyJobsResponseSchema = z.object({
  jobs: z.array(z.unknown()),
});

// Inferred TypeScript types — single source of truth
export type AshbySecondaryLocation = z.infer<typeof AshbySecondaryLocationSchema>;
export type AshbyJob = z.infer<typeof AshbyJobSchema>;

/**
 * Returns the raw jobs array from an Ashby response.
 * Validates ONLY the top-level shape: `{ jobs: unknown[] }`.
 */
export function parseAshbyJobsArray(raw: unknown): unknown[] {
  return AshbyJobsResponseSchema.parse(raw).jobs;
}

/**
 * Validates ONE job against the strict schema.
 * Throws ZodError if the job is malformed; orchestrator catches and skips.
 */
export function parseAshbyJob(raw: unknown): AshbyJob {
  return AshbyJobSchema.parse(raw);
}
