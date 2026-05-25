#!/usr/bin/env tsx
/**
 * Daily cleanup runner.
 *
 * Three operations, run in order:
 *   1. Soft-dismiss UserJobMatch rows unviewed > 7 days
 *   2. Soft-archive Application rows rejected/declined > 90 days
 *   3. Hard-delete Job rows > 30 days old with zero matches and zero applications
 *
 * Usage:
 *   npm run cleanup                  # actually run cleanup
 *   npm run cleanup -- --dry-run     # log what WOULD change, change nothing
 *
 * Exits 0 on success, 1 on error.
 */

import { prisma } from "../src/server/lib/prisma";
import { logger } from "../src/server/lib/logger";

const STALE_MATCH_DAYS = 7;
const REJECTED_APP_DAYS = 90;
const UNMATCHED_JOB_DAYS = 30;

interface OpResult {
  name: string;
  eligible: number;
  changed: number;
  errored: boolean;
}

/**
 * Operation 1: soft-dismiss stale UserJobMatch rows.
 * "User hasn't looked at this match in a week. It's noise. Hide it."
 *
 * Keeps the row for analytics: which keywords led to most dismissals,
 * how active are users, etc.
 */
async function autoDismissStaleMatches(dryRun: boolean): Promise<OpResult> {
  const op = "cleanup.matches.auto_dismiss";
  const cutoff = new Date(Date.now() - STALE_MATCH_DAYS * 24 * 60 * 60 * 1000);

  try {
    const eligible = await prisma.userJobMatch.count({
      where: {
        viewedAt: null,
        matchedAt: { lt: cutoff },
        dismissed: false,
      },
    });

    logger.info({ eligible, dryRun, cutoff }, `${op}.eligible`);

    if (dryRun || eligible === 0) {
      return { name: "auto_dismiss_matches", eligible, changed: 0, errored: false };
    }

    const result = await prisma.userJobMatch.updateMany({
      where: {
        viewedAt: null,
        matchedAt: { lt: cutoff },
        dismissed: false,
      },
      data: {
        dismissed: true,
        autoDismissed: true,
        dismissedAt: new Date(),
        status: "dismissed",
      },
    });

    logger.info({ changed: result.count }, `${op}.done`);
    return { name: "auto_dismiss_matches", eligible, changed: result.count, errored: false };
  } catch (err) {
    logger.error({ err: (err as Error).message }, `${op}.failed`);
    return { name: "auto_dismiss_matches", eligible: 0, changed: 0, errored: true };
  }
}

/**
 * Operation 2: soft-archive rejected applications older than 90 days.
 * Sets archivedAt=NOW so they hide from default dashboards.
 * Still queryable for analytics.
 */
async function archiveOldRejections(dryRun: boolean): Promise<OpResult> {
  const op = "cleanup.applications.archive_rejected";
  const cutoff = new Date(Date.now() - REJECTED_APP_DAYS * 24 * 60 * 60 * 1000);

  try {
    const eligible = await prisma.application.count({
      where: {
        status: { in: ["rejected", "declined"] },
        archivedAt: null,
        updatedAt: { lt: cutoff },
      },
    });

    logger.info({ eligible, dryRun, cutoff }, `${op}.eligible`);

    if (dryRun || eligible === 0) {
      return { name: "archive_rejections", eligible, changed: 0, errored: false };
    }

    const result = await prisma.application.updateMany({
      where: {
        status: { in: ["rejected", "declined"] },
        archivedAt: null,
        updatedAt: { lt: cutoff },
      },
      data: { archivedAt: new Date() },
    });

    logger.info({ changed: result.count }, `${op}.done`);
    return { name: "archive_rejections", eligible, changed: result.count, errored: false };
  } catch (err) {
    logger.error({ err: (err as Error).message }, `${op}.failed`);
    return { name: "archive_rejections", eligible: 0, changed: 0, errored: true };
  }
}

/**
 * Operation 3: hard-delete jobs that nobody ever cared about.
 *
 * Criteria (ALL must be true):
 *   - scrapedAt > 30 days ago
 *   - zero UserJobMatch rows referencing this job
 *   - zero Application rows referencing this job
 *
 * If any user matched OR applied, the job is preserved (they need the URL).
 */
async function deleteUnmatchedJobs(dryRun: boolean): Promise<OpResult> {
  const op = "cleanup.jobs.delete_unmatched";
  const cutoff = new Date(Date.now() - UNMATCHED_JOB_DAYS * 24 * 60 * 60 * 1000);

  try {
    const eligible = await prisma.job.count({
      where: {
        scrapedAt: { lt: cutoff },
        matches: { none: {} },
        applications: { none: {} },
      },
    });

    logger.info({ eligible, dryRun, cutoff }, `${op}.eligible`);

    if (dryRun || eligible === 0) {
      return { name: "delete_unmatched_jobs", eligible, changed: 0, errored: false };
    }

    const result = await prisma.job.deleteMany({
      where: {
        scrapedAt: { lt: cutoff },
        matches: { none: {} },
        applications: { none: {} },
      },
    });

    logger.info({ changed: result.count }, `${op}.done`);
    return { name: "delete_unmatched_jobs", eligible, changed: result.count, errored: false };
  } catch (err) {
    logger.error({ err: (err as Error).message }, `${op}.failed`);
    return { name: "delete_unmatched_jobs", eligible: 0, changed: 0, errored: true };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log(
    `→ Cleanup ${dryRun ? "(DRY RUN — no changes will be made)" : "(LIVE — changes will be applied)"}\n`,
  );

  logger.info({ dryRun }, "cleanup.run_start");

  const results: OpResult[] = [];
  results.push(await autoDismissStaleMatches(dryRun));
  results.push(await archiveOldRejections(dryRun));
  results.push(await deleteUnmatchedJobs(dryRun));

  // Print summary table
  console.log("\n┌──────────────────────────────────────────────────┐");
  console.log("│ Cleanup summary                                  │");
  console.log("├──────────────────────────────────────────────────┤");
  console.log("│ operation                  │ eligible │ changed  │");
  console.log("├──────────────────────────────────────────────────┤");
  for (const r of results) {
    const op = r.name.padEnd(26);
    const e = String(r.eligible).padStart(8);
    const c = String(r.changed).padStart(8);
    console.log(`│ ${op} │ ${e} │ ${c} │`);
  }
  console.log("└──────────────────────────────────────────────────┘");

  const totalEligible = results.reduce((a, r) => a + r.eligible, 0);
  const totalChanged = results.reduce((a, r) => a + r.changed, 0);
  const errorCount = results.filter((r) => r.errored).length;

  console.log(`\nTotals: ${totalEligible} eligible, ${totalChanged} changed, ${errorCount} errors`);
  if (dryRun) {
    console.log("(dry run — no actual changes were made)");
  }

  logger.info({ totalEligible, totalChanged, errors: errorCount, dryRun }, "cleanup.run_done");

  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  logger.error({ err: (err as Error).message }, "cleanup.run_failed");
  process.exit(1);
});
