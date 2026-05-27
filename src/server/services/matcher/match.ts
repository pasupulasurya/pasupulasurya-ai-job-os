// src/server/services/matcher/match.ts
//
// Per-user job matcher orchestrator. Loads user prefs + master resume,
// loads all eligible jobs, filters + scores each pair, upserts UserJobMatch.
// Idempotent via MATCH_VERSION.

import { prisma } from "@/server/lib/prisma";
import { logger } from "@/server/lib/logger";
import { ResumeParseSchema, type ResumeParse } from "@/server/services/ai/parse-resume";
import { applyAllFilters } from "./filters";
import { composeScore, type MatchableJob, type MatchableUser } from "./score";

export const MATCH_VERSION = "matcher-v1";

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
    locations: user.preferences.locations,
    visaSponsorship: user.preferences.visaSponsorship,
    totalYearsExperience: parsed.totalYearsExperience,
    resumeSkills: parsed.skills,
    excludeKeywords: user.preferences.excludeKeywords,
    avoidCompanies: user.preferences.avoidCompanies,
  };

  const blockedCompanyNames = new Set(
    user.blockedCompanies.map((b) => b.company.name.toLowerCase()),
  );

  // 2. Load eligible jobs. Filtered at DB level to avoid loading expired/deleted.
  const now = new Date();
  const jobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { scrapedAt: "desc" },
    ...(limit ? { take: limit } : {}),
  });

  logger.info(
    { userId, jobsCount: jobs.length, force, dryRun, version: MATCH_VERSION },
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
  };

  // 3. If not forcing, pre-fetch the user's existing match versions to skip re-scoring.
  const existingVersions = force
    ? new Map<string, string | null>()
    : new Map(
        (
          await prisma.userJobMatch.findMany({
            where: { userId, matchVersion: MATCH_VERSION },
            select: { jobId: true, matchVersion: true },
          })
        ).map((m) => [m.jobId, m.matchVersion]),
      );

  // 4. Per-job loop.
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
        location: job.location,
        remote: job.remote,
        seniority: job.seniority,
        experienceYears: job.experienceYears,
        skills: job.skills,
        sponsorsVisa: job.sponsorsVisa,
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
            matchVersion: MATCH_VERSION,
            status: "fresh",
          },
          update: {
            matchScore: totalScore,
            scoreBreakdown: breakdown,
            matchVersion: MATCH_VERSION,
            // do NOT reset status: a user who already "viewed" or "applied" keeps that state
          },
        });
        counters.upserted++;
      }
    } catch (err) {
      counters.errors++;
      logger.error({ userId, jobId: job.id, err: (err as Error).message }, "matcher.job.failed");
    }
  }

  const summary: MatchSummary = {
    userId,
    ...counters,
    durationMs: Date.now() - startedAt,
    version: MATCH_VERSION,
  };
  logger.info(summary, "matcher.run.complete");
  return summary;
}
