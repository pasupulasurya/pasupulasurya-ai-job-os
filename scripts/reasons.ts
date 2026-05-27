#!/usr/bin/env tsx
/**
 * Reason generator CLI.
 *
 * Usage:
 *   npm run reasons -- --user=<userId>              # generate top-10 reasons
 *   npm run reasons -- --user=<userId> --limit=2    # only top-2 (prompt iteration)
 *   npm run reasons -- --user=<userId> --dry-run    # no DB writes, log only
 *   npm run reasons -- --user=<userId> --force      # regen even if reason exists
 *   npm run reasons -- --all-users                  # iterate all users
 */

import { prisma } from "../src/server/lib/prisma";
import { generateReasonsForUser, REASON_VERSION } from "../src/server/services/matcher/reason";

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
    `→ Reason generator v=${REASON_VERSION} users=${userIds.length}${args.force ? " FORCE" : ""}${args.dryRun ? " DRY-RUN" : ""}${args.limit ? ` limit=${args.limit}` : ""}`,
  );

  for (const id of userIds) {
    try {
      const summary = await generateReasonsForUser({
        userId: id,
        force: args.force,
        limit: args.limit,
        dryRun: args.dryRun,
      });
      const rows: Array<[string, number | string]> = [
        ["userId", summary.userId],
        ["considered", summary.considered],
        ["generated", summary.generated],
        ["failed", summary.failed],
        ["durationMs", summary.durationMs],
      ];
      console.log("\n┌─────────────────────────────────────┐");
      console.log("│ Reason generation summary           │");
      console.log("├─────────────────────────────────────┤");
      for (const [k, v] of rows)
        console.log(`│ ${String(k).padEnd(15)} │ ${String(v).padStart(15)} │`);
      console.log("└─────────────────────────────────────┘");
    } catch (err) {
      console.error(`Reason generation failed for user ${id}:`, (err as Error).message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
