import { z } from "zod";

// Canonical enums for ApplyProfile string fields. The fill engine
// matches portal option text against these values' display labels.
export const degreeLevelValues = [
  "high_school",
  "associate",
  "bachelors",
  "masters",
  "doctorate",
] as const;
export const genderValues = ["male", "female", "non_binary", "decline"] as const;
export const yesNoDeclineValues = ["yes", "no", "decline"] as const;
export const raceEthnicityValues = [
  "american_indian_alaska_native",
  "asian",
  "black_african_american",
  "native_hawaiian_pacific_islander",
  "white",
  "two_or_more",
  "decline",
] as const;
export const veteranStatusValues = ["not_veteran", "veteran", "decline"] as const;

const currentYear = new Date().getFullYear();

// Lenient in, strict out (same pattern as phone normalization):
// trim, empty -> null, prepend https:// when no scheme, then .url() validates.
const urlField = z.preprocess((val) => {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  if (trimmed === "") return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}, z.string().url().max(300).nullable());

export const applyProfileSchema = z.object({
  workAuthorizedUS: z.boolean().nullable(),
  requiresSponsorship: z.boolean().nullable(),
  over18: z.boolean().nullable(),
  degreeLevel: z.enum(degreeLevelValues).nullable(),
  schoolName: z.string().trim().max(200).nullable(),
  graduationYear: z
    .number()
    .int()
    .min(1950)
    .max(currentYear + 10)
    .nullable(),
  gender: z.enum(genderValues).nullable(),
  hispanicLatino: z.enum(yesNoDeclineValues).nullable(),
  raceEthnicity: z.enum(raceEthnicityValues).nullable(),
  veteranStatus: z.enum(veteranStatusValues).nullable(),
  disabilityStatus: z.enum(yesNoDeclineValues).nullable(),
  linkedinUrl: urlField,
  githubUrl: urlField,
  portfolioUrl: urlField,
  salaryExpectation: z.string().trim().max(120).nullable(),
  earliestStartDate: z.string().trim().max(120).nullable(),
  willingToRelocate: z.boolean().nullable(),
  previouslyEmployed: z.boolean().nullable(),
  referredByEmployee: z.string().trim().max(120).nullable(),
  howDidYouHear: z.string().trim().max(120).nullable(),
});

export type ApplyProfileInput = z.infer<typeof applyProfileSchema>;
