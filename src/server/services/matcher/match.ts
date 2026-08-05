// src/server/services/matcher/match.ts
//
// Per-user job matcher orchestrator. Loads user prefs + master resume,
// loads all eligible jobs, filters + scores each pair, upserts UserJobMatch.
// Idempotent via MATCH_VERSION.

import { createHash } from "node:crypto";
import { prisma } from "@/server/lib/prisma";
import { logger } from "@/server/lib/logger";
import { ResumeParseSchema, type ResumeParse } from "@/server/services/ai/parse-resume";
import { applyAllFilters } from "./filters";
import { composeScore, type MatchableJob, type MatchableUser } from "./score";

export const MATCH_VERSION = "matcher-v1";

/**
 * Compute the full match-version string for a (preferences, resume) pair.
 *
 * Returns `matcher-v1:${hash}` where the hash captures every field that
 * affects the scoring or filtering outcome. When ANY of these inputs change,
 * the hash changes, all of that user's existing matches become stale-version,
 * and the matcher re-scores them on the next run.
 *
 * This is the real correctness mechanism: idempotency is preserved when
 * inputs are stable, invalidation is automatic when inputs change. No manual
 * backfill needed — the matcher self-heals.
 *
 * Inputs hashed (any change invalidates):
 *   - All UserPreference fields that the matcher reads (keywords, targetRoles,
 *     locations, jobTypes, experienceMin/Max, visaSponsorship, stemOptOnly,
 *     salaryMin, currentEmployment, workAuthStatus, visaType, excludeKeywords,
 *     avoidCompanies)
 *   - Master resume id (resume swap -> different parsed skills -> new score)
 *   - Master resume parseVersion (parser upgrade -> different skills -> new score)
 */
type HashInput = {
  keywords: string[];
  excludeKeywords: string[];
  targetRoles: string[];
  locations: string[];
  jobTypes: string[];
  experienceMin: number | null;
  experienceMax: number | null;
  visaSponsorship: boolean;
  stemOptOnly: boolean;
  visaType: string | null;
  workAuthStatus: string | null;
  salaryMin: number | null;
  currentEmployment: string | null;
  avoidCompanies: string[];
  resumeId: string;
  parseVersion: string | null;
};

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableSerialize).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableSerialize(obj[k])).join(",") + "}";
}

export function computeMatchVersion(input: HashInput): string {
  const hash = createHash("sha256").update(stableSerialize(input)).digest("hex").slice(0, 12);
  return `${MATCH_VERSION}:${hash}`;
}

const MIN_SCORE_TO_PERSIST = 40; // 30/100. Below this we don't upsert (keeps list clean).

export type MatchOptions = {
  userId: string;
  force?: boolean;
  limit?: number;
  dryRun?: boolean;
};

export type MatchSummary = {
  userId: string;
  jobsConsidered: number;
  filtered: number;
  scoredAbove: number;
  scoredBelow: number;
  upserted: number;
  errors: number;
  skippedAlreadyMatched: number;
  reconciledDeleted: number;
  durationMs: number;
  version: string;
};

function coerceResumeParse(json: unknown): ResumeParse {
  const result = ResumeParseSchema.safeParse(json);
  if (!result.success) {
    throw new Error(`ResumeVersion.parsedJson failed re-validation: ${result.error.message}`);
  }
  return result.data;
}

export async function matchJobsForUser(opts: MatchOptions): Promise<MatchSummary> {
  const { userId, force = false, limit, dryRun = false } = opts;
  const startedAt = Date.now();

  // 1. Load user + master resume + preferences in one query.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      preferences: true,
      resumes: { where: { isMaster: true }, take: 1 },
      blockedCompanies: { include: { company: { select: { slug: true, name: true } } } },
    },
  });
  if (!user) throw new Error(`User not found: ${userId}`);
  if (!user.preferences) throw new Error(`User has no preferences row: ${userId}`);
  const masterResume = user.resumes[0];
  if (!masterResume || !masterResume.parsedJson) {
    throw new Error(`User ${userId} has no parsed master resume`);
  }

  const parsed = coerceResumeParse(masterResume.parsedJson);

  const matchableUser: MatchableUser & { excludeKeywords: string[]; avoidCompanies: string[] } = {
    keywords: user.preferences.keywords,
    targetRoles: user.preferences.targetRoles,
    visaSponsorship: user.preferences.visaSponsorship,
    totalYearsExperience: parsed.totalYearsExperience,
    resumeSkills: parsed.skills,
    excludeKeywords: user.preferences.excludeKeywords,
    avoidCompanies: user.preferences.avoidCompanies,
  };

  // Compute the per-user match version. See computeMatchVersion docstring.
  // When prefs or resume change, this hash changes, and the skip-if-exists
  // logic below correctly re-scores all jobs.
  const matchVersion = computeMatchVersion({
    keywords: user.preferences.keywords,
    excludeKeywords: user.preferences.excludeKeywords,
    targetRoles: user.preferences.targetRoles,
    locations: user.preferences.locations,
    jobTypes: user.preferences.jobTypes,
    experienceMin: user.preferences.experienceMin,
    experienceMax: user.preferences.experienceMax,
    visaSponsorship: user.preferences.visaSponsorship,
    stemOptOnly: user.preferences.stemOptOnly,
    visaType: user.preferences.visaType,
    workAuthStatus: user.preferences.workAuthStatus,
    salaryMin: user.preferences.salaryMin,
    currentEmployment: user.preferences.currentEmployment,
    avoidCompanies: user.preferences.avoidCompanies,
    resumeId: masterResume.id,
    parseVersion: masterResume.parseVersion,
  });

  const blockedCompanyNames = new Set(
    user.blockedCompanies.map((b) => b.company.name.toLowerCase()),
  );

  // 2. Load eligible jobs. Filtered at DB level to avoid loading expired/deleted.
  const now = new Date();
  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      enrichmentVersion: { not: null },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ...(force ? {} : { matches: { none: { userId, matchVersion } } }),
    },
    omit: { rawJson: true },
    orderBy: { scrapedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  // Company sponsorship prior: per-job sponsorsVisa is null on ~99.9% of jobs,
  // so the scorer falls back to the company's knownToSponsor (USCIS-verified).
  // Pre-load once as a slug->prior map (mirrors blockedCompanyNames pattern).
  const sponsorRows = await prisma.company.findMany({
    select: { slug: true, knownToSponsor: true },
  });
  const sponsorMap = new Map(sponsorRows.map((c) => [c.slug, c.knownToSponsor]));

  logger.info(
    { userId, jobsCount: jobs.length, force, dryRun, version: matchVersion },
    "matcher.run.start",
  );

  const counters = {
    jobsConsidered: 0,
    filtered: 0,
    scoredAbove: 0,
    scoredBelow: 0,
    upserted: 0,
    errors: 0,
    skippedAlreadyMatched: 0,
    reconciledDeleted: 0,
  };

  // 3. If not forcing, pre-fetch the user's existing match versions to skip re-scoring.
  const existingVersions = force
    ? new Map<string, string | null>()
    : new Map(
        (
          await prisma.userJobMatch.findMany({
            where: { userId, matchVersion: matchVersion },
            select: { jobId: true, matchVersion: true },
          })
        ).map((m) => [m.jobId, m.matchVersion]),
      );

  // 4. Per-job loop.
  // Track every jobId that gets a row this run, for force-run reconciliation below.
  const upsertedJobIds = new Set<string>();
  for (const job of jobs) {
    counters.jobsConsidered++;
    try {
      // Hard-block: company blocklist (DB-relational, checked here)
      if (blockedCompanyNames.has(job.company.toLowerCase())) {
        counters.filtered++;
        continue;
      }
      // Skip if already scored with current version (unless --force)
      if (existingVersions.has(job.id)) {
        counters.skippedAlreadyMatched++;
        continue;
      }

      const matchableJob: MatchableJob & { company: string; description: string | null } = {
        title: job.title,
        seniority: job.seniority,
        experienceYears: job.experienceYears,
        skills: job.skills,
        sponsorsVisa: job.sponsorsVisa,
        knownToSponsor: job.companySlug ? (sponsorMap.get(job.companySlug) ?? null) : null,
        company: job.company,
        description: job.description,
      };

      const filterResult = applyAllFilters(matchableJob, matchableUser);
      if (!filterResult.passes) {
        counters.filtered++;
        continue;
      }

      const { totalScore, breakdown } = composeScore(matchableJob, matchableUser);
      if (totalScore < MIN_SCORE_TO_PERSIST) {
        counters.scoredBelow++;
        continue;
      }
      counters.scoredAbove++;

      if (dryRun) {
        logger.info({ userId, jobId: job.id, title: job.title, totalScore }, "matcher.job.dryrun");
      } else {
        await prisma.userJobMatch.upsert({
          where: { userId_jobId: { userId, jobId: job.id } },
          create: {
            userId,
            jobId: job.id,
            matchScore: totalScore,
            scoreBreakdown: breakdown,
            matchVersion: matchVersion,
            status: "fresh",
          },
          update: {
            matchScore: totalScore,
            scoreBreakdown: breakdown,
            matchVersion: matchVersion,
            // do NOT reset status: a user who already "viewed" or "applied" keeps that state
          },
        });
        upsertedJobIds.add(job.id);
        counters.upserted++;
      }
    } catch (err) {
      counters.errors++;
      logger.error({ userId, jobId: job.id, err: (err as Error).message }, "matcher.job.failed");
    }
  }

  // Reconciliation (FORCE runs only): a force run re-scores every job, so any
  // fresh/viewed row NOT upserted this run is stale — it either dropped below the
  // persist threshold or its scoring inputs changed (e.g. an experience override
  // that didn't bump the match-version hash, which is why version-based cleanup is
  // insufficient). Delete those. Only fresh/viewed are touched; applied/dismissed/
  // rejected are the user's decisions and are never removed. Guarded on a non-empty
  // upserted set so a zero-match run can never wipe the table. Non-force runs skip
  // this entirely: they only add/skip, never re-score-down, so they create no fossils.
  if (force && !dryRun && !limit && upsertedJobIds.size > 0) {
    const deleted = await prisma.userJobMatch.deleteMany({
      where: {
        userId,
        status: { in: ["fresh", "viewed"] },
        jobId: { notIn: Array.from(upsertedJobIds) },
      },
    });
    counters.reconciledDeleted = deleted.count;
    logger.info(
      { userId, deleted: deleted.count, kept: upsertedJobIds.size },
      "matcher.reconciled",
    );
  }

  const summary: MatchSummary = {
    userId,
    ...counters,
    durationMs: Date.now() - startedAt,
    version: matchVersion,
  };
  logger.info(summary, "matcher.run.complete");
  return summary;
}
