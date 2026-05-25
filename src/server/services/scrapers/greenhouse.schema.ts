import { z } from "zod";

/**
 * Zod schemas validating the Greenhouse public Job Board API response.
 *
 * Endpoint: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
 * Docs:     https://developers.greenhouse.io/job-board.html
 *
 * Design notes:
 *  - Permissive on the edges: we use .passthrough() to ignore unknown fields
 *    Greenhouse may add later.
 *  - Strict on the fields we depend on: id, title, location.name, absolute_url
 *    must exist or we reject the response.
 *  - Optional fields (content, departments, offices) are typed but not required.
 */

export const GreenhouseLocationSchema = z.object({
  name: z.string(),
});

export const GreenhouseMetadataSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    value: z.union([z.string(), z.array(z.string()), z.null(), z.boolean()]),
    value_type: z.string(),
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

export const GreenhouseJobsResponseSchema = z.object({
  jobs: z.array(GreenhouseJobSchema),
  meta: z.object({ total: z.number().optional() }).passthrough().optional(),
});

// Inferred TypeScript types — single source of truth
export type GreenhouseLocation = z.infer<typeof GreenhouseLocationSchema>;
export type GreenhouseMetadata = z.infer<typeof GreenhouseMetadataSchema>;
export type GreenhouseJob = z.infer<typeof GreenhouseJobSchema>;
export type GreenhouseJobsResponse = z.infer<typeof GreenhouseJobsResponseSchema>;

/**
 * Validate a raw fetch response against the Greenhouse schema.
 * Throws ZodError with a useful path if the response is malformed.
 */
export function parseGreenhouseResponse(raw: unknown): GreenhouseJobsResponse {
  return GreenhouseJobsResponseSchema.parse(raw);
}
