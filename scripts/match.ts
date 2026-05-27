#!/usr/bin/env tsx
/**
 * Matcher CLI.
 *
 * Usage:
 *   npm run match -- --user=<userId>                # match all eligible jobs
 *   npm run match -- --user=<userId> --limit=50     # cap at N jobs
 *   npm run match -- --user=<userId> --force        # re-score (ignore matchVersion)
 *   npm run match -- --user=<userId> --dry-run      # log scores, no DB writes
 *   npm run match -- --all-users                    # iterate all users
 *
 * Exits 0 on success, 1 on error.
 */

import { prisma } from "../src/server/lib/prisma";
import { matchJobsForUser, MATCH_VERSION } from "../src/server/services/matcher/match";

function parseArgs(argv: string[]): {
  userId?: string;
  allUsers: boolean;
  force: boolean;
  limit?: number;
  dryRun: boolean;
} {
  let userId: string | undefined;
  let allUsers = false;
  let force = false;
  let dryRun = false;
  let limit: number | undefined;

  for (const arg of argv) {
    if (arg === "--all-users") allUsers = true;
    else if (arg === "--force") force = true;
    else if (arg === "--dry-run") dryRun = true;
    else if (arg.startsWith("--user=")) userId = arg.slice("--user=".length);
    else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (!Number.isInteger(n) || n <= 0) {
        console.error(`Invalid --limit value: ${arg}`);
        process.exit(1);
      }
      limit = n;
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return { userId, allUsers, force, limit, dryRun };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.userId && !args.allUsers) {
    console.error("Must provide --user=<id> or --all-users");
    process.exit(1);
  }

  const userIds: string[] = args.allUsers
    ? (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id)
    : [args.userId!];

  console.log(
    `→ Matcher v=${MATCH_VERSION} users=${userIds.length}${args.force ? " FORCE" : ""}${args.dryRun ? " DRY-RUN" : ""}${args.limit ? ` limit=${args.limit}` : ""}`,
  );

  for (const id of userIds) {
    try {
      const summary = await matchJobsForUser({
        userId: id,
        force: args.force,
        limit: args.limit,
        dryRun: args.dryRun,
      });
      const rows: Array<[string, number | string]> = [
        ["userId", summary.userId],
        ["jobsConsidered", summary.jobsConsidered],
        ["filtered", summary.filtered],
        ["skippedAlreadyMatched", summary.skippedAlreadyMatched],
        ["scoredAbove", summary.scoredAbove],
        ["scoredBelow", summary.scoredBelow],
        ["upserted", summary.upserted],
        ["errors", summary.errors],
        ["durationMs", summary.durationMs],
      ];
      console.log("\n┌──────────────────────────────────────────────┐");
      console.log("│ Match summary                                │");
      console.log("├──────────────────────────────────────────────┤");
      for (const [k, v] of rows)
        console.log(`│ ${String(k).padEnd(22)} │ ${String(v).padStart(17)} │`);
      console.log("└──────────────────────────────────────────────┘");
    } catch (err) {
      console.error(`Match failed for user ${id}:`, (err as Error).message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
