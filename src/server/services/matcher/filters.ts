// src/server/services/matcher/filters.ts
//
// Hard pre-filters: jobs that fail these are dropped entirely, not scored low.
// Keeps the user's match list free of jobs they could never realistically take.
//
// Each filter returns { passes: boolean, reason?: string } so the orchestrator
// can log why a job was dropped (useful for debugging match emptiness).

import type { MatchableJob, MatchableUser } from "./score";

export type FilterResult = { passes: true } | { passes: false; reason: string };

const lower = (s: string) => s.toLowerCase();

/**
 * Drops jobs whose title or description contains any of the user's excludeKeywords.
 * Case-insensitive substring match.
 */
export function filterExcludeKeywords(
  job: { title: string; description: string | null },
  excludeKeywords: string[],
): FilterResult {
  if (excludeKeywords.length === 0) return { passes: true };
  const haystack = `${job.title} ${job.description ?? ""}`.toLowerCase();
  const hit = excludeKeywords.find((k) => haystack.includes(lower(k)));
  if (hit) return { passes: false, reason: `excluded keyword: ${hit}` };
  return { passes: true };
}

/**
 * Drops jobs at companies the user has soft-blocked (UserPreference.avoidCompanies).
 * Case-insensitive substring match on the job's company string.
 */
export function filterAvoidCompanies(
  job: { company: string },
  avoidCompanies: string[],
): FilterResult {
  if (avoidCompanies.length === 0) return { passes: true };
  const jobCompany = lower(job.company);
  const hit = avoidCompanies.find((c) => jobCompany.includes(lower(c)));
  if (hit) return { passes: false, reason: `avoided company: ${hit}` };
  return { passes: true };
}

/**
 * Hard sponsorship filter: if the user needs sponsorship AND the job explicitly
 * does not sponsor, drop it. Silent jobs (sponsorsVisa === null) still pass
 * through to be scored — most jobs don't state either way.
 */
export function filterSponsorshipMismatch(job: MatchableJob, user: MatchableUser): FilterResult {
  if (!user.visaSponsorship) return { passes: true };
  if (job.sponsorsVisa === false) {
    return { passes: false, reason: "job explicitly does not sponsor visa" };
  }
  return { passes: true };
}

/**
 * Compose all filters. Returns first failure or pass.
 * Order matters only for the `reason` returned — shortest-circuit checks first.
 */
export function applyAllFilters(
  job: MatchableJob & { company: string; description: string | null },
  user: MatchableUser & { excludeKeywords: string[]; avoidCompanies: string[] },
): FilterResult {
  const checks = [
    () => filterExcludeKeywords(job, user.excludeKeywords),
    () => filterAvoidCompanies(job, user.avoidCompanies),
    () => filterSponsorshipMismatch(job, user),
  ];
  for (const check of checks) {
    const result = check();
    if (!result.passes) return result;
  }
  return { passes: true };
}
