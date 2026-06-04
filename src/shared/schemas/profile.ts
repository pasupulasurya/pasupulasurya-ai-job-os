import { z } from "zod";
import { COUNTRIES, DEFAULT_COUNTRY_CODE, findCountry } from "@/shared/data/countries";

/**
 * Normalize a phone string to E.164 format using the selected country's dial code.
 *
 * Y-lenient: accepts any common format. The user may paste:
 *  - "5618877710" (no dial code)
 *  - "+15618877710" (full E.164, US prefix)
 *  - "(561) 887-7710" (US format with parens/dashes)
 *  - "+44 20 7946 0958" (any country's E.164)
 *
 * Strategy:
 *  1. Extract just the digits.
 *  2. If digits start with the SELECTED country's dial code → use as-is.
 *  3. If digits start with ANY known country's dial code → strip that dial code,
 *     then re-prepend the SELECTED country's dial code. This is the "user changed
 *     country picker but kept the phone field" case — the phone re-prefixes correctly.
 *  4. Otherwise → prepend the selected country's dial code.
 *
 * Returns null for empty input.
 */
function normalizePhoneWithCountry(
  raw: string | null | undefined,
  countryCode: string,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits === "") return null;

  const selectedCountry = findCountry(countryCode);
  const selectedDialDigits = (selectedCountry?.dial ?? "+1").replace("+", "");

  // Case 1: digits already start with the SELECTED country's dial code → return as E.164
  if (digits.startsWith(selectedDialDigits)) {
    return `+${digits}`;
  }

  // Case 2: digits start with SOME other country's dial code → strip it, re-prepend selected
  // Try longest-prefix match across known dial codes (so "+1242" Bahamas wins over "+1" US)
  const allDials = COUNTRIES.map((c) => c.dial.replace("+", "")).sort(
    (a, b) => b.length - a.length,
  );
  for (const dial of allDials) {
    if (digits.startsWith(dial)) {
      const localDigits = digits.slice(dial.length);
      return `+${selectedDialDigits}${localDigits}`;
    }
  }

  // Case 3: no dial code detected → prepend selected country's
  return `+${selectedDialDigits}${digits}`;
}

const E164 = /^\+[1-9]\d{1,14}$/;
const COUNTRY_CODES = COUNTRIES.map((c) => c.code) as [string, ...string[]];

export const profileSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(100, "First name is too long"),
    lastName: z.string().trim().min(1, "Last name is required").max(100, "Last name is too long"),
    country: z.enum(COUNTRY_CODES).default(DEFAULT_COUNTRY_CODE),
    phone: z.string().nullable().optional(),
  })
  .transform((data) => ({
    firstName: data.firstName,
    lastName: data.lastName,
    country: data.country,
    phone: normalizePhoneWithCountry(data.phone, data.country),
  }))
  .refine((data) => data.phone === null || E164.test(data.phone), {
    message: "Phone format invalid. Use digits only, e.g. 2025551234",
    path: ["phone"],
  });

export type ProfileInput = z.infer<typeof profileSchema>;
