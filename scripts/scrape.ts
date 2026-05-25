#!/usr/bin/env tsx
/**
 * CLI scraper runner.
 *
 * Usage:
 *   npx tsx scripts/scrape.ts greenhouse                       # all active GH
 *   npx tsx scripts/scrape.ts greenhouse --slug=anthropic      # one GH company
 *   npx tsx scripts/scrape.ts ashby                            # all active Ashby
 *   npx tsx scripts/scrape.ts ashby --slug=linear              # one Ashby company
 *   npx tsx scripts/scrape.ts ashby --slug=openai --slug=ramp  # multiple
 *
 * Exits 0 on success, 1 on error.
 */

import { scrapeGreenhouse } from "../src/server/services/scrapers/greenhouse";
import { scrapeAshby } from "../src/server/services/scrapers/ashby";

type Provider = "greenhouse" | "ashby";

const SUPPORTED_PROVIDERS: Provider[] = ["greenhouse", "ashby"];

/**
 * Common shape that all scrapers return. Different scrapers may have
 * extra fields (e.g. Ashby has skippedUnlisted), but the CLI only
 * displays the lowest common denominator.
 */
interface CommonOutcome {
  company: string;
  fetched: number;
  insertedNew: number;
  skippedDedup: number;
  skippedRules: number;
  skippedLocation: number;
  errors: number;
}

async function runScraper(provider: Provider, slugs: string[]): Promise<CommonOutcome[]> {
  const filter = slugs.length > 0 ? slugs : undefined;

  if (provider === "greenhouse") {
    return scrapeGreenhouse(filter);
  }
  if (provider === "ashby") {
    return scrapeAshby(filter);
  }
  // Exhaustiveness check — TypeScript will error here if we add a
  // provider to the union but forget to handle it above.
  const _exhaustive: never = provider;
  throw new Error(`Unhandled provider: ${_exhaustive as string}`);
}

async function main() {
  const args = process.argv.slice(2);
  const providerArg = args[0];

  if (!SUPPORTED_PROVIDERS.includes(providerArg as Provider)) {
    console.error(
      `Unknown provider: "${providerArg}". Supported: ${SUPPORTED_PROVIDERS.join(", ")}`,
    );
    process.exit(1);
  }
  const provider = providerArg as Provider;

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

  const results = await runScraper(provider, slugs);

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
