import { prisma } from "@/server/lib/prisma";
import { logger } from "@/server/lib/logger";
import { hasUSLocation } from "@/server/services/scrapers/location";
import { jobHash } from "@/server/services/scrapers/hash";
import { applyRules, type OwnerRule, type RuleableJob } from "@/server/services/scrapers/rules";
import {
  parseGreenhouseJobsArray,
  parseGreenhouseJob,
  type GreenhouseJob,
} from "@/server/services/scrapers/greenhouse.schema";

const GREENHOUSE_API = "https://boards-api.greenhouse.io/v1/boards";
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
  skippedMalformed: number;
  errors: number;
}

/**
 * Recursively strip null bytes from any string in a JSON-like object.
 * Postgres TEXT/JSONB reject 0x00 bytes; this guarantees we never send them.
 */
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

/**
 * Strip HTML tags and decode common entities to plain text.
 */
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
 * Fetch Greenhouse board response, validate only the top-level shape.
 * Returns the raw jobs array; per-job parsing happens in the loop.
 */
async function fetchGreenhouseJobs(slug: string): Promise<unknown[]> {
  const url = `${GREENHOUSE_API}/${slug}/jobs?content=true`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
  });

  if (!res.ok) {
    throw new Error(`Greenhouse API ${slug} → HTTP ${res.status}`);
  }

  const raw: unknown = await res.json();
  return parseGreenhouseJobsArray(raw);
}

/**
 * Scrape one Greenhouse company end-to-end.
 *
 * Per-job parsing: each job is validated individually. If one job has
 * a malformed shape, it's logged and skipped — the rest of the company's
 * jobs flow through. This makes the scraper robust against schema drift
 * at scale.
 */
async function scrapeOneCompany(companyId: string): Promise<ScrapeOutcome> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }
  if (company.ats !== "greenhouse") {
    throw new Error(`Company ${company.slug} ats=${company.ats}, not greenhouse`);
  }

  const outcome: ScrapeOutcome = {
    company: company.slug,
    fetched: 0,
    insertedNew: 0,
    skippedDedup: 0,
    skippedRules: 0,
    skippedLocation: 0,
    skippedMalformed: 0,
    errors: 0,
  };

  // Load owner rules once
  const ruleRows = await prisma.scrapingRule.findMany({
    where: { enabled: true },
  });
  const rules: OwnerRule[] = ruleRows.map((r) => ({
    id: r.id,
    name: r.name,
    ruleType: r.ruleType,
    pattern: r.pattern,
    enabled: r.enabled,
    appliesTo: r.appliesTo,
  }));

  const now = new Date();
  const dedupCutoff = new Date(now.getTime() - DEDUP_WINDOW_DAYS * 86_400_000);
  const expiresAt = new Date(now.getTime() + JOB_TTL_DAYS * 86_400_000);

  // Fetch raw jobs (no per-job validation yet)
  let rawJobs: unknown[];
  try {
    rawJobs = await fetchGreenhouseJobs(company.slug);
  } catch (err) {
    logger.error(
      { err: (err as Error).message, slug: company.slug },
      "scrape.greenhouse.fetch_failed",
    );
    outcome.errors += 1;
    return outcome;
  }

  outcome.fetched = rawJobs.length;
  logger.info({ slug: company.slug, fetched: rawJobs.length }, "scrape.greenhouse.fetched");

  for (const rawJob of rawJobs) {
    // Per-job validation. A single malformed job is logged and skipped;
    // good jobs from the same company keep flowing.
    let j: GreenhouseJob;
    try {
      j = parseGreenhouseJob(rawJob);
    } catch (err) {
      outcome.skippedMalformed += 1;
      logger.warn(
        { err: (err as Error).message, slug: company.slug },
        "scrape.greenhouse.skip_malformed",
      );
      continue;
    }

    const locationText = j.location.name.replace(/\u0000/g, "");
    const titleText = j.title.replace(/\u0000/g, "");
    const descriptionText = stripHtml(j.content);
    const postedAt = j.updated_at ? new Date(j.updated_at) : null;

    // 1. US-only filter
    if (!hasUSLocation(locationText)) {
      outcome.skippedLocation += 1;
      continue;
    }

    // 2. Owner rules
    const ruleableJob: RuleableJob = {
      title: titleText,
      description: descriptionText,
      location: locationText,
      postedAt,
    };
    const ruleResult = applyRules(ruleableJob, rules);
    if (!ruleResult.pass) {
      outcome.skippedRules += 1;
      continue;
    }

    // 3. Dedup hash check
    const hash = jobHash(company.slug, titleText, locationText);
    const existing = await prisma.job.findFirst({
      where: { hash, scrapedAt: { gte: dedupCutoff } },
      select: { id: true },
    });
    if (existing) {
      outcome.skippedDedup += 1;
      continue;
    }

    // 4. Insert
    try {
      await prisma.job.create({
        data: {
          source: "greenhouse",
          sourceUrl: j.absolute_url,
          externalId: String(j.id),
          title: titleText,
          company: company.name,
          companySlug: company.slug,
          location: locationText,
          remote: locationText.toLowerCase().includes("remote"),
          description: descriptionText || null,
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
        logger.error(
          { err: msg, slug: company.slug, jobId: j.id },
          "scrape.greenhouse.insert_failed",
        );
        outcome.errors += 1;
      }
    }
  }

  // Update company stats
  await prisma.company.update({
    where: { id: company.id },
    data: { lastScrapedAt: now, lastJobCount: outcome.fetched },
  });

  logger.info(outcome, "scrape.greenhouse.company_done");
  return outcome;
}

/**
 * Scrape all (or filtered) active Greenhouse companies.
 */
export async function scrapeGreenhouse(onlySlugs?: string[]): Promise<ScrapeOutcome[]> {
  const where = {
    ats: "greenhouse",
    active: true,
    ...(onlySlugs && onlySlugs.length > 0 ? { slug: { in: onlySlugs } } : {}),
  };

  const companies = await prisma.company.findMany({
    where,
    orderBy: { name: "asc" },
  });

  logger.info(
    { companies: companies.length, filter: onlySlugs ?? "all" },
    "scrape.greenhouse.run_start",
  );

  const results: ScrapeOutcome[] = [];
  for (const c of companies) {
    try {
      const r = await scrapeOneCompany(c.id);
      results.push(r);
    } catch (err) {
      logger.error(
        { err: (err as Error).message, slug: c.slug },
        "scrape.greenhouse.company_failed",
      );
      results.push({
        company: c.slug,
        fetched: 0,
        insertedNew: 0,
        skippedDedup: 0,
        skippedRules: 0,
        skippedLocation: 0,
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
      skippedMalformed: 0,
      errors: 0,
    },
  );

  logger.info({ ...summary, companies: results.length }, "scrape.greenhouse.run_done");

  return results;
}
