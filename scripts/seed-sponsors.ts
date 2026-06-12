// 2J.2 — seed sponsor-verified companies from the join pipeline output.
// Input: /tmp/2j2/seed.json (stage-2b verified + budget-cut list).
// Idempotent on Company.slug: existing rows get knownToSponsor=true
// + name refresh, never duplicated, active flag preserved.
// Token discovery credit: Feashliaa/job-board-aggregator (MIT) —
// every token independently verified against the live ATS API.
// Usage: npm run seed:sponsors -- --dry-run   (then without)
import { readFileSync } from "node:fs";
import { prisma } from "../src/server/lib/prisma";
import { logger } from "../src/server/lib/logger";

type SeedRow = {
  name: string;
  boardName: string;
  score: number;
  slug: string;
  ats: string;
  activeJobs: number;
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const rows = JSON.parse(readFileSync("/tmp/2j2/seed.json", "utf8")) as SeedRow[];
  logger.info({ rows: rows.length, dryRun }, "seed.sponsors.start");

  let created = 0,
    updated = 0;
  for (const r of rows) {
    const existing = await prisma.company.findUnique({ where: { slug: r.slug } });
    if (existing) {
      if (!dryRun) {
        await prisma.company.update({
          where: { slug: r.slug },
          data: { knownToSponsor: true, notes: `h1b_score=${r.score} (fy2025+26)` },
        });
      }
      updated += 1;
      continue;
    }
    if (!dryRun) {
      await prisma.company.create({
        data: {
          slug: r.slug,
          name: r.boardName || r.name,
          ats: r.ats,
          active: true,
          knownToSponsor: true,
          notes: `h1b_score=${r.score} (fy2025+26), seeded 2j.2`,
        },
      });
    }
    created += 1;
  }
  logger.info({ created, updated, dryRun }, "seed.sponsors.done");
  console.log(`${dryRun ? "[DRY RUN] " : ""}created ${created}, updated ${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
