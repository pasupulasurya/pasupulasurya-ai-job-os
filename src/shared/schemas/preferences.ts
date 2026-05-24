import { z } from "zod";

/**
 * UserPreference validation schema.
 *
 * Used by:
 *   - Onboarding form (client validation)
 *   - savePreferencesAction (server input sanitization)
 */

export const preferencesSchema = z.object({
  keywords: z
    .array(z.string().min(1).max(60))
    .min(1, "Add at least one keyword you want jobs to match")
    .max(20, "20 keywords is plenty — try to be specific"),
  excludeKeywords: z.array(z.string().min(1).max(60)).max(20).default([]),
  locations: z.array(z.string().min(1).max(60)).max(15).default([]),
  jobTypes: z.array(z.enum(["full-time", "internship", "contract", "part-time"])).default([]),
  experienceMin: z.number().int().min(0).max(50).nullable().default(null),
  experienceMax: z.number().int().min(0).max(50).nullable().default(null),
  visaSponsorship: z.boolean().default(true),
  stemOptOnly: z.boolean().default(false),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;
