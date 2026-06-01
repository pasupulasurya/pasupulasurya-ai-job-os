#!/usr/bin/env tsx
import { prisma } from "../src/server/lib/prisma";
async function main() {
  const userId = process.argv[2];
  const matches = await prisma.userJobMatch.findMany({
    where: { userId, matchScore: { gte: 40, lte: 47 } },
    include: { job: { select: { title: true, company: true, skills: true } } },
    orderBy: { matchScore: "desc" },
  });
  console.log(`${matches.length} matches in 40-47 score range:`);
  for (const m of matches) {
    console.log(
      `[${m.matchScore}] ${m.job.title} @ ${m.job.company} — skills:[${m.job.skills.join(", ")}]`,
    );
  }
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
