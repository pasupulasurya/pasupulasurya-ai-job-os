#!/usr/bin/env tsx
/**
 * Test the new enrichment prompt against known-bad jobs WITHOUT writing to DB.
 * Compares current (already-stored) skills vs newly-generated skills.
 *
 * Pass criteria: Non-technical roles should return skills: [].
 * Fail criteria: 8b-instant still hallucinates technical skills.
 */
import { prisma } from "../src/server/lib/prisma";
import { getLLMProvider } from "../src/server/services/ai/llm";
import { EnrichmentSchema, __internals } from "../src/server/services/ai/enrich";

const KNOWN_BAD_TITLES = [
  "Executive Assistant",
  "Customer Success Manager, Ads Solutions",
  "Account Development Executive",
  "Account Executive - New Verticals, Enterprise Ad Sales",
  "Account Manager, Mid Market CPG Partnerships",
  "Senior Associate, Grocery Partnerships",
  "Manager, DashMart - Growth Strategy& Operations",
  "Manager, Dasher & Logistics Strategy & Operations",
];

const ENRICHMENT_MODEL = "llama-3.1-8b-instant";

async function main() {
  const provider = await getLLMProvider();
  const jobs = await prisma.job.findMany({
    where: {
      enrichmentVersion: { not: null },
      description: { not: null },
      OR: KNOWN_BAD_TITLES.map((t) => ({ title: { contains: t } })),
    },
    select: { id: true, title: true, company: true, description: true, skills: true },
    take: 10,
  });

  console.log(`Testing new prompt against ${jobs.length} known-bad jobs.\n`);

  for (const job of jobs) {
    const result = await provider.generate({
      system: __internals.SYSTEM_PROMPT,
      user: __internals.buildUserPrompt(job.title, job.description ?? ""),
      schema: EnrichmentSchema,
      model: ENRICHMENT_MODEL,
      maxTokens: 512,
    });

    const oldSkills = job.skills.join(", ") || "[]";
    const newSkills = result.skills.join(", ") || "[]";
    const verdict = result.skills.length === 0 ? "PASS (empty)" : "FAIL (non-empty)";

    console.log(`[${job.company}] ${job.title}`);
    console.log(`  OLD: ${oldSkills}`);
    console.log(`  NEW: ${newSkills}`);
    console.log(`  ${verdict}\n`);
    await new Promise((r) => setTimeout(r, 500));
  }
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
