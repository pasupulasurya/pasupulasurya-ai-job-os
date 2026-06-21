import { createHash } from "crypto";

/**
 * Stable dedup hash for (companySlug, title, location).
 *
 * Two jobs from the same company with the same hash are treated as the same
 * posting (reposts, mirror listings, minor edits all collide).
 *
 * Pure function. Same inputs always produce same output.
 */
export function jobHash(
  companySlug: string,
  title: string,
  location: string,
  externalId: string,
): string {
  const normalized = [
    companySlug.trim().toLowerCase(),
    title.trim().toLowerCase().replace(/\s+/g, " "),
    location.trim().toLowerCase().replace(/\s+/g, " "),
    externalId.trim().toLowerCase(),
  ].join("|");

  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}
