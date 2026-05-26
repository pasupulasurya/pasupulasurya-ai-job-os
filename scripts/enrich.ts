#!/usr/bin/env tsx
/**
 * AI enrichment runner.
 *
 * Usage:
 *   npm run enrich                     # skip already-enriched (default)
 *   npm run enrich -- --force          # re-enrich everything
 *   npm run enrich -- --limit=10       # cap at N jobs (testing)
 *   npm run enrich -- --dry-run        # call LLM, log result, no DB write
 *
 * Exits 0 on success, 1 on error.
 */

import { enrichJobs } from "../src/server/services/ai/enrich";

function parseArgs(argv: string[]): { force: boolean; limit?: number; dryRun: boolean } {
  let force = false;
  let dryRun = false;
  let limit: number | undefined;
  for (const arg of argv) {
    if (arg === "--force") force = true;
    else if (arg === "--dry-run") dryRun = true;
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
  return { force, limit, dryRun };
}

async function main() {
  const { force, limit, dryRun } = parseArgs(process.argv.slice(2));
  console.log(
    `→ Enriching jobs${force ? " (FORCE)" : ""}${dryRun ? " (DRY RUN)" : ""}${limit ? ` (limit ${limit})` : ""}`,
  );
  const summary = await enrichJobs({ force, limit, dryRun });
  const rows = [
    ["processed", summary.processed],
    ["success", summary.success],
    ["validationFailed", summary.validationFailed],
    ["transportFailed", summary.transportFailed],
    ["unknownFailed", summary.unknownFailed],
    ["durationMs", summary.durationMs],
  ];
  console.log("\n┌────────────────────────────────┐");
  console.log("│ Enrichment summary             │");
  console.log("├────────────────────────────────┤");
  for (const [k, v] of rows) console.log(`│ ${String(k).padEnd(18)} │ ${String(v).padStart(9)} │`);
  console.log("└────────────────────────────────┘");
  console.log(`model=${summary.model} version=${summary.version}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
