#!/usr/bin/env tsx
import { prisma } from "../src/server/lib/prisma";

async function main() {
  const userId = process.argv[2];

  const totalJobs = await prisma.job.count({ where: { deletedAt: null } });
  const enriched = await prisma.job.count({
    where: { deletedAt: null, enrichmentVersion: "groq-llama-3.1-8b-v2" },
  });
  const enrichedWithSkills = await prisma.job.count({
    where: {
      deletedAt: null,
      enrichmentVersion: "groq-llama-3.1-8b-v2",
      skills: { isEmpty: false },
    },
  });

  const allMatches = await prisma.userJobMatch.count({ where: { userId } });
  const matchesAbove40 = await prisma.userJobMatch.count({
    where: { userId, matchScore: { gte: 40 } },
  });
  const matchesAbove35 = await prisma.userJobMatch.count({
    where: { userId, matchScore: { gte: 35 } },
  });
  const matchesAbove30 = await prisma.userJobMatch.count({
    where: { userId, matchScore: { gte: 30 } },
  });

  const scoreDist = await prisma.userJobMatch.groupBy({
    by: ["matchScore"],
    where: { userId },
    _count: true,
    orderBy: { matchScore: "desc" },
  });

  console.log("=== Jobs in DB ===");
  console.log(`total active jobs:           ${totalJobs}`);
  console.log(`enriched (8b-v2):            ${enriched}`);
  console.log(`enriched WITH skills array:  ${enrichedWithSkills}`);
  console.log(`enriched but skills=[]:      ${enriched - enrichedWithSkills}`);
  console.log();
  console.log("=== Your matches (total stored) ===");
  console.log(`total UserJobMatch rows:     ${allMatches}`);
  console.log(`score >= 40 (persisted):     ${matchesAbove40}`);
  console.log(`score >= 35:                 ${matchesAbove35}`);
  console.log(`score >= 30:                 ${matchesAbove30}`);
  console.log();
  console.log("=== Score distribution ===");
  for (const row of scoreDist) {
    console.log(`  ${row.matchScore.toString().padStart(5)}  -  ${row._count} matches`);
  }
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
