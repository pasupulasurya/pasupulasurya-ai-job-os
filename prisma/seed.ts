import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env.local");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 10_000,
  max: 5,
});

const prisma = new PrismaClient({ adapter });

// ============================================================
// COMPANIES (30 US-based, mix of ATS platforms)
// ============================================================

const COMPANIES = [
  // AI / ML — Greenhouse
  { slug: "scaleai", name: "Scale AI", ats: "greenhouse", knownToSponsor: true },
  { slug: "anthropic", name: "Anthropic", ats: "greenhouse", knownToSponsor: true },
  { slug: "huggingface", name: "Hugging Face", ats: "greenhouse", knownToSponsor: true },
  { slug: "databricks", name: "Databricks", ats: "greenhouse", knownToSponsor: true },

  // AI / ML — Ashby & Lever
  { slug: "openai", name: "OpenAI", ats: "ashby", knownToSponsor: true },
  { slug: "perplexityai", name: "Perplexity", ats: "ashby", knownToSponsor: true },
  { slug: "cohere", name: "Cohere", ats: "lever", knownToSponsor: true },

  // Big tech / hyper-growth — Greenhouse
  { slug: "stripe", name: "Stripe", ats: "greenhouse", knownToSponsor: true },
  { slug: "airbnb", name: "Airbnb", ats: "greenhouse", knownToSponsor: true },
  { slug: "figma", name: "Figma", ats: "greenhouse", knownToSponsor: true },
  { slug: "notion", name: "Notion", ats: "greenhouse", knownToSponsor: true },
  { slug: "discord", name: "Discord", ats: "greenhouse", knownToSponsor: true },
  { slug: "vercel", name: "Vercel", ats: "greenhouse", knownToSponsor: true },

  // Ashby modern
  { slug: "linear", name: "Linear", ats: "ashby", knownToSponsor: true },
  { slug: "supabase", name: "Supabase", ats: "ashby", knownToSponsor: true },
  { slug: "ramp", name: "Ramp", ats: "ashby", knownToSponsor: true },

  // Fintech — Greenhouse
  { slug: "brex", name: "Brex", ats: "greenhouse", knownToSponsor: true },
  { slug: "plaid", name: "Plaid", ats: "greenhouse", knownToSponsor: true },
  { slug: "coinbase", name: "Coinbase", ats: "greenhouse", knownToSponsor: true },
  { slug: "robinhood", name: "Robinhood", ats: "greenhouse", knownToSponsor: true },

  // SaaS — Greenhouse
  { slug: "rippling", name: "Rippling", ats: "greenhouse", knownToSponsor: true },
  { slug: "asana", name: "Asana", ats: "greenhouse", knownToSponsor: true },
  { slug: "instacart", name: "Instacart", ats: "greenhouse", knownToSponsor: true },
  { slug: "doordash", name: "DoorDash", ats: "greenhouse", knownToSponsor: true },

  // Enterprise — Greenhouse
  { slug: "snowflakecomputing", name: "Snowflake", ats: "greenhouse", knownToSponsor: true },
  { slug: "samsara", name: "Samsara", ats: "greenhouse", knownToSponsor: true },
  { slug: "cloudflare", name: "Cloudflare", ats: "greenhouse", knownToSponsor: true },

  // Workday — kept inactive for now (week 2 build)
  { slug: "salesforce", name: "Salesforce", ats: "workday", active: false, knownToSponsor: true },
  { slug: "nvidia", name: "NVIDIA", ats: "workday", active: false, knownToSponsor: true },
  { slug: "adobe", name: "Adobe", ats: "workday", active: false, knownToSponsor: true },
];

// ============================================================
// SCRAPING RULES (owner-level hard filters)
// ============================================================

const SCRAPING_RULES = [
  // ❌ Skip US-citizen-only jobs (sponsorship dealbreaker)
  {
    name: "Skip US citizen only",
    ruleType: "exclude_keyword",
    pattern: "us citizen",
    appliesTo: "description",
  },
  {
    name: "Skip US citizens only (variant)",
    ruleType: "exclude_keyword",
    pattern: "u.s. citizen",
    appliesTo: "description",
  },
  {
    name: "Skip 'must be US citizen'",
    ruleType: "exclude_keyword",
    pattern: "must be a us citizen",
    appliesTo: "description",
  },

  // ❌ Security clearance
  {
    name: "Skip security clearance jobs",
    ruleType: "exclude_keyword",
    pattern: "security clearance",
    appliesTo: "description",
  },
  {
    name: "Skip secret clearance",
    ruleType: "exclude_keyword",
    pattern: "secret clearance",
    appliesTo: "any",
  },
  {
    name: "Skip TS/SCI clearance",
    ruleType: "exclude_keyword",
    pattern: "ts/sci",
    appliesTo: "any",
  },

  // ❌ No sponsorship language
  {
    name: "Skip 'unable to sponsor'",
    ruleType: "exclude_keyword",
    pattern: "unable to sponsor",
    appliesTo: "description",
  },
  {
    name: "Skip 'not able to sponsor'",
    ruleType: "exclude_keyword",
    pattern: "not able to sponsor",
    appliesTo: "description",
  },
  {
    name: "Skip 'no sponsorship'",
    ruleType: "exclude_keyword",
    pattern: "no sponsorship",
    appliesTo: "description",
  },
  {
    name: "Skip 'will not sponsor'",
    ruleType: "exclude_keyword",
    pattern: "will not sponsor",
    appliesTo: "description",
  },

  // 📍 US-only location filter
  {
    name: "Require US location match",
    ruleType: "require_location_match",
    pattern: "united states|usa|us-|remote (us|united states)|new york|san francisco|austin|seattle|boston|chicago|los angeles|denver|atlanta|miami|washington|new jersey|texas|california|colorado|massachusetts|illinois|florida|virginia|north carolina|georgia|oregon|arizona|nashville|portland|minneapolis|dallas|houston|philadelphia|phoenix|salt lake|raleigh|charlotte|remote",
    appliesTo: "location",
  },

  // ⏰ Skip old jobs
  {
    name: "Skip jobs older than 30 days",
    ruleType: "max_age_days",
    pattern: "30",
    appliesTo: "any",
  },
];

// ============================================================
// SEED FUNCTION
// ============================================================

async function main() {
  console.log("🌱 Seeding database...\n");

  // Seed Companies
  console.log("📦 Seeding companies...");
  let companiesAdded = 0;
  let companiesUpdated = 0;
  for (const company of COMPANIES) {
    const result = await prisma.company.upsert({
      where: { slug: company.slug },
      update: {
        name: company.name,
        ats: company.ats,
        active: company.active ?? true,
        knownToSponsor: company.knownToSponsor ?? null,
      },
      create: {
        slug: company.slug,
        name: company.name,
        ats: company.ats,
        active: company.active ?? true,
        knownToSponsor: company.knownToSponsor ?? null,
      },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      companiesAdded++;
    } else {
      companiesUpdated++;
    }
  }
  console.log(`   ✅ ${companiesAdded} added, ${companiesUpdated} updated\n`);

  // Seed Scraping Rules
  console.log("📦 Seeding scraping rules...");
  let rulesAdded = 0;
  for (const rule of SCRAPING_RULES) {
    // Check if rule with same name exists
    const existing = await prisma.scrapingRule.findFirst({
      where: { name: rule.name },
    });
    if (!existing) {
      await prisma.scrapingRule.create({ data: rule });
      rulesAdded++;
    }
  }
  console.log(`   ✅ ${rulesAdded} new rules added\n`);

  // Summary
  const totalCompanies = await prisma.company.count();
  const totalRules = await prisma.scrapingRule.count();
  console.log("📊 Database state:");
  console.log(`   Companies: ${totalCompanies}`);
  console.log(`   Scraping rules: ${totalRules}`);
  console.log("\n✨ Done!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
