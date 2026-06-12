import { prisma } from "@/server/lib/prisma";
import { logger } from "@/server/lib/logger";
import { hasUSLocation } from "@/server/services/scrapers/location";
import { jobHash } from "@/server/services/scrapers/hash";
import { applyRules, type OwnerRule, type RuleableJob } from "@/server/services/scrapers/rules";
import { matchesCohortTitles, isTitleFilterEnabled } from "@/server/services/scrapers/title-filter";
import {
  parseAshbyJobsArray,
  parseAshbyJob,
  type AshbyJob,
} from "@/server/services/scrapers/ashby.schema";

const ASHBY_API = "https://api.ashbyhq.com/posting-api/job-board";
const DEDUP_WINDOW_DAYS = 14;
const JOB_TTL_DAYS = 30;
const USER_AGENT = "ai-job-os/0.1";

export interface ScrapeOutcome {
  company: string;
  fetched: number;
  insertedNew: number;
  skippedDedup: number;
  skippedRules: number;
  skippedLocation: number;
  skippedTitleFilter: number;
  skippedUnlisted: number;
  skippedMalformed: number;
  errors: number;
}

function stripNullBytes(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\u0000/g, "");
  }
  if (Array.isArray(value)) {
    return value.map(stripNullBytes);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripNullBytes(v);
    }
    return out;
  }
  return value;
}

function stripHtml(html: string | undefined): string {
  if (!html) return "";
  return html
    .replace(/\u0000/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Combine Ashby's primary location with its secondaryLocations[] into a
 * single pipe-delimited string. Mirrors Greenhouse's format so location.ts
 * can stay agnostic of the source.
 */
function combineLocations(j: AshbyJob): string {
  const parts: string[] = [j.location];
  for (const sec of j.secondaryLocations ?? []) {
    if (sec.location && sec.location !== j.location) {
      parts.push(sec.location);
    }
  }
  return parts.join(" | ");
}

/**
 * Fetch the Ashby board response, validate only the top-level shape.
 * Returns the raw jobs array; per-job parsing happens in the loop.
 */
async function fetchAshbyJobs(slug: string): Promise<unknown[]> {
  const url = `${ASHBY_API}/${slug}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Ashby API returned ${res.status} for slug "${slug}"`);
  }

  const raw = (await res.json()) as unknown;
  return parseAshbyJobsArray(raw);
}

/**
 * Scrape one Ashby-backed company by Company.id.
 *
 * Per-job parsing: malformed jobs are logged and skipped; good jobs flow.
 */
async function scrapeOneCompany(companyId: string): Promise<ScrapeOutcome> {
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
  });

  const outcome: ScrapeOutcome = {
    company: company.slug,
    fetched: 0,
    insertedNew: 0,
    skippedDedup: 0,
    skippedRules: 0,
    skippedLocation: 0,
    skippedTitleFilter: 0,
    skippedUnlisted: 0,
    skippedMalformed: 0,
    errors: 0,
  };

  let rawJobs: unknown[];
  try {
    rawJobs = await fetchAshbyJobs(company.slug);
  } catch (err) {
    logger.error({ err: (err as Error).message, slug: company.slug }, "scrape.ashby.fetch_failed");
    outcome.errors = 1;
    return outcome;
  }

  outcome.fetched = rawJobs.length;
  logger.info({ slug: company.slug, fetched: rawJobs.length }, "scrape.ashby.fetched");

  // Load active rules once per company
  const rulesRaw = await prisma.scrapingRule.findMany({
    where: { enabled: true },
  });
  const rules: OwnerRule[] = rulesRaw.map((r) => ({
    id: r.id,
    name: r.name,
    ruleType: r.ruleType,
    pattern: r.pattern,
    enabled: r.enabled,
    appliesTo: r.appliesTo,
  }));

  const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const expiresAt = new Date(Date.now() + JOB_TTL_DAYS * 24 * 60 * 60 * 1000);

  for (const rawJob of rawJobs) {
    // Per-job validation
    let j: AshbyJob;
    try {
      j = parseAshbyJob(rawJob);
    } catch (err) {
      outcome.skippedMalformed += 1;
      logger.warn(
        { err: (err as Error).message, slug: company.slug },
        "scrape.ashby.skip_malformed",
      );
      continue;
    }

    // 1. Skip unlisted jobs
    if (!j.isListed) {
      outcome.skippedUnlisted += 1;
      continue;
    }

    const locationText = combineLocations(j).replace(/\u0000/g, "");
    const titleText = j.title.replace(/\u0000/g, "");

    // 2. Description: prefer plain, fall back to stripped HTML
    const descriptionText =
      (j.descriptionPlain ?? "").trim() || stripHtml(j.descriptionHtml ?? undefined).trim();

    // 2.5 Cohort title pre-filter (2J.1) — before location parsing.
    if (isTitleFilterEnabled() && !matchesCohortTitles(titleText)) {
      outcome.skippedTitleFilter += 1;
      logger.debug({ slug: company.slug, title: titleText }, "scrape.title_filter.dropped");
      continue;
    }

    // 3. US location filter
    if (!hasUSLocation(locationText)) {
      outcome.skippedLocation += 1;
      continue;
    }

    // 4. Owner rules
    const postedAt = j.publishedAt ? new Date(j.publishedAt) : null;
    const ruleable: RuleableJob = {
      title: titleText,
      description: descriptionText,
      location: locationText,
      postedAt,
    };
    const ruleResult = applyRules(ruleable, rules);
    if (!ruleResult.pass) {
      outcome.skippedRules += 1;
      continue;
    }

    // 5. Dedup hash check
    const hash = jobHash(company.slug, titleText, locationText);
    // Two dedup cases in one indexed query: exact same posting URL
    // (any age — catches >14d jobs alive via matches, which previously
    // fell through to a handled-but-noisy insert constraint error every
    // cron), OR same company|title|location re-posted within the window.
    const existing = await prisma.job.findFirst({
      where: {
        OR: [{ sourceUrl: j.jobUrl }, { hash, scrapedAt: { gte: dedupCutoff } }],
      },
      select: { id: true },
    });
    if (existing) {
      outcome.skippedDedup += 1;
      continue;
    }

    // 6. Insert
    try {
      await prisma.job.create({
        data: {
          source: "ashby",
          sourceUrl: j.jobUrl,
          externalId: j.id,
          title: titleText,
          company: company.name,
          companySlug: company.slug,
          location: locationText,
          remote: j.isRemote === true,
          description: descriptionText,
          rawJson: stripNullBytes(j) as object,
          hash,
          postedAt,
          expiresAt,
        },
      });
      outcome.insertedNew += 1;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("Unique constraint") || msg.includes("sourceUrl")) {
        outcome.skippedDedup += 1;
      } else {
        logger.error({ err: msg, slug: company.slug, jobId: j.id }, "scrape.ashby.insert_failed");
        outcome.errors += 1;
      }
    }
  }

  // Update Company stats
  await prisma.company.update({
    where: { id: company.id },
    data: {
      lastScrapedAt: new Date(),
      lastJobCount: outcome.insertedNew,
    },
  });

  logger.info({ ...outcome }, "scrape.ashby.company_done");
  return outcome;
}

/**
 * Scrape all (or filtered) active Ashby companies.
 */
export async function scrapeAshby(onlySlugs?: string[]): Promise<ScrapeOutcome[]> {
  const where = {
    ats: "ashby",
    active: true,
    ...(onlySlugs && onlySlugs.length > 0 ? { slug: { in: onlySlugs } } : {}),
  };

  const companies = await prisma.company.findMany({
    where,
    orderBy: { name: "asc" },
  });

  logger.info(
    { companies: companies.length, filter: onlySlugs ?? "all" },
    "scrape.ashby.run_start",
  );

  const results: ScrapeOutcome[] = [];
  for (const c of companies) {
    try {
      const r = await scrapeOneCompany(c.id);
      results.push(r);
    } catch (err) {
      logger.error({ err: (err as Error).message, slug: c.slug }, "scrape.ashby.company_failed");
      results.push({
        company: c.slug,
        fetched: 0,
        insertedNew: 0,
        skippedDedup: 0,
        skippedRules: 0,
        skippedLocation: 0,
        skippedTitleFilter: 0,
        skippedUnlisted: 0,
        skippedMalformed: 0,
        errors: 1,
      });
    }
  }

  const summary = results.reduce(
    (acc, r) => {
      acc.fetched += r.fetched;
      acc.insertedNew += r.insertedNew;
      acc.skippedDedup += r.skippedDedup;
      acc.skippedRules += r.skippedRules;
      acc.skippedLocation += r.skippedLocation;
      acc.skippedTitleFilter += r.skippedTitleFilter;
      acc.skippedUnlisted += r.skippedUnlisted;
      acc.skippedMalformed += r.skippedMalformed;
      acc.errors += r.errors;
      return acc;
    },
    {
      fetched: 0,
      insertedNew: 0,
      skippedDedup: 0,
      skippedRules: 0,
      skippedLocation: 0,
      skippedTitleFilter: 0,
      skippedUnlisted: 0,
      skippedMalformed: 0,
      errors: 0,
    },
  );

  logger.info({ ...summary, companies: results.length }, "scrape.ashby.run_done");

  return results;
}
