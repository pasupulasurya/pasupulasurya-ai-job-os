import { z } from "zod";

/**
 * Normalize a phone string to E.164 format.
 * - Strip spaces, dashes, parens
 * - Preserve leading + if present
 * - If no leading +, prepend +1 (US default)
 * - Return null for empty/whitespace input
 */
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits === "") return null;
  return hasPlus ? `+${digits}` : `+1${digits}`;
}

const E164 = /^\+[1-9]\d{1,14}$/;

export const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100, "First name is too long"),
  lastName: z.string().trim().min(1, "Last name is required").max(100, "Last name is too long"),
  phone: z
    .string()
    .nullable()
    .optional()
    .transform((v) => normalizePhone(v ?? null))
    .refine((v) => v === null || E164.test(v), {
      message: "Phone format invalid. Use digits only, e.g. 2025551234 or +12025551234",
    }),
});

export type ProfileInput = z.infer<typeof profileSchema>;
