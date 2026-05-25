#!/usr/bin/env tsx
/**
 * CLI scraper runner.
 *
 * Usage:
 *   npx tsx scripts/scrape.ts greenhouse                    # all active companies
 *   npx tsx scripts/scrape.ts greenhouse --slug=anthropic   # just one
 *   npx tsx scripts/scrape.ts greenhouse --slug=anthropic --slug=stripe
 *
 * Exits 0 on success, 1 on error.
 */

import { scrapeGreenhouse } from "../src/server/services/scrapers/greenhouse";

async function main() {
  const args = process.argv.slice(2);
  const provider = args[0];

  if (provider !== "greenhouse") {
    console.error(`Unknown provider: "${provider}". Supported: greenhouse`);
    process.exit(1);
  }

  // Collect --slug=X flags (can be repeated)
  const slugs: string[] = [];
  for (const arg of args.slice(1)) {
    if (arg.startsWith("--slug=")) {
      slugs.push(arg.slice("--slug=".length));
    }
  }

  console.log(
    `→ Scraping ${provider}${slugs.length ? ` (slugs: ${slugs.join(", ")})` : " (all)"}\n`,
  );

  const results = await scrapeGreenhouse(slugs.length > 0 ? slugs : undefined);

  // Print summary table
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│ Scrape summary                                              │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  console.log("│ company             │ fetched │ inserted │ loc  │ rule │ dup │");
  console.log("├─────────────────────────────────────────────────────────────┤");
  for (const r of results) {
    const co = r.company.padEnd(19);
    const f = String(r.fetched).padStart(7);
    const i = String(r.insertedNew).padStart(8);
    const l = String(r.skippedLocation).padStart(4);
    const ru = String(r.skippedRules).padStart(4);
    const d = String(r.skippedDedup).padStart(3);
    console.log(`│ ${co} │ ${f} │ ${i} │ ${l} │ ${ru} │ ${d} │`);
  }
  console.log("└─────────────────────────────────────────────────────────────┘");

  const totals = results.reduce(
    (a, r) => ({
      fetched: a.fetched + r.fetched,
      inserted: a.inserted + r.insertedNew,
      errors: a.errors + r.errors,
    }),
    { fetched: 0, inserted: 0, errors: 0 },
  );

  console.log(
    `\nTotals: ${totals.fetched} fetched, ${totals.inserted} inserted, ${totals.errors} errors`,
  );

  process.exit(totals.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Scrape failed:", err);
  process.exit(1);
});
