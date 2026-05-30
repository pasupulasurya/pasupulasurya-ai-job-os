import { z } from "zod";

/**
 * UserPreference validation schema.
 *
 * Used by:
 *   - Onboarding form (client validation)
 *   - savePreferencesAction (server input sanitization)
 */

// Canonical enums — kept in sync with Prisma schema comments.
export const visaTypeValues = [
  "h1b",
  "f1_opt",
  "stem_opt",
  "green_card",
  "citizen",
  "other",
] as const;
export const workAuthStatusValues = [
  "needs_sponsorship",
  "current_h1b",
  "ead",
  "citizen_or_gc",
] as const;
export const currentEmploymentValues = ["employed", "unemployed", "student", "freelance"] as const;

export const preferencesSchema = z.object({
  keywords: z
    .array(z.string().min(1).max(60))
    .min(3, "Add at least 3 keywords for good matches — too few means too many irrelevant jobs")
    .max(20, "20 keywords is plenty — try to be specific"),
  excludeKeywords: z.array(z.string().min(1).max(60)).max(20).default([]),
  locations: z.array(z.string().min(1).max(60)).max(15).default([]),
  jobTypes: z.array(z.enum(["full-time", "internship", "contract", "part-time"])).default([]),

  // Experience
  experienceMin: z.number().int().min(0).max(50).nullable().default(null),
  experienceMax: z.number().int().min(0).max(50).nullable().default(null),

  // Visa & work auth
  visaSponsorship: z.boolean().default(true),
  stemOptOnly: z.boolean().default(false),
  visaType: z.enum(visaTypeValues).nullable().default(null),
  workAuthStatus: z.enum(workAuthStatusValues).nullable().default(null),

  // Compensation & employment
  salaryMin: z.number().int().min(0).max(10_000_000).nullable().default(null),
  currentEmployment: z.enum(currentEmploymentValues).nullable().default(null),

  // Targeting
  targetRoles: z.array(z.string().min(1).max(80)).max(15).default([]),
  avoidCompanies: z.array(z.string().min(1).max(80)).max(30).default([]),

  // Onboarding flag (client may set true on final step)
  onboardingComplete: z.boolean().default(false),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;
