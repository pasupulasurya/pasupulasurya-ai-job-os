import { z } from "zod";

/**
 * Zod schemas validating the Ashby public Job Board API response.
 *
 * Endpoint: https://api.ashbyhq.com/posting-api/job-board/{slug}
 * Docs:     https://ashbyhq.com/api/job-board (public, no auth required)
 *
 * Design notes:
 *  - Permissive at the edges: `.passthrough()` so Ashby can add fields
 *    without breaking our scraper.
 *  - Strict on the fields we depend on: id, title, jobUrl, location.
 *  - secondaryLocations defaults to [] (Ashby sometimes returns null;
 *    we learned this lesson from Greenhouse's `metadata` field).
 *  - descriptionPlain is optional — some boards (like Linear) omit it;
 *    we fall back to stripping descriptionHtml in the orchestrator.
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
    department: z.string().optional(),
    team: z.string().optional(),
    employmentType: z.string().optional(),
    location: z.string(),
    secondaryLocations: z
      .array(AshbySecondaryLocationSchema)
      .nullable()
      .default([])
      .transform((v) => v ?? []),
    publishedAt: z.string(), // ISO-8601 datetime — we'll parse to Date downstream
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
    applyUrl: z.string().url().optional(),
    descriptionHtml: z.string().optional(),
    descriptionPlain: z.string().optional(),
  })
  .passthrough();

export const AshbyJobsResponseSchema = z.object({
  jobs: z.array(AshbyJobSchema),
});

// Inferred TypeScript types — single source of truth
export type AshbySecondaryLocation = z.infer<typeof AshbySecondaryLocationSchema>;
export type AshbyJob = z.infer<typeof AshbyJobSchema>;
export type AshbyJobsResponse = z.infer<typeof AshbyJobsResponseSchema>;

/**
 * Validate a raw fetch response against the Ashby schema.
 * Throws ZodError with a useful path if the response is malformed.
 */
export function parseAshbyResponse(raw: unknown): AshbyJobsResponse {
  return AshbyJobsResponseSchema.parse(raw);
}
