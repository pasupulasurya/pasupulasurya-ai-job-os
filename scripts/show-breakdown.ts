#!/usr/bin/env tsx
import { prisma } from "../src/server/lib/prisma";
async function main() {
  const userId = process.argv[2];
  const matches = await prisma.userJobMatch.findMany({
    where: { userId },
    orderBy: { matchScore: "desc" },
    take: 1,
    include: { job: { select: { title: true } } },
  });
  for (const m of matches) {
    console.log(`Top match: ${m.job.title} — score ${m.matchScore}`);
    console.log("scoreBreakdown:");
    console.log(JSON.stringify(m.scoreBreakdown, null, 2));
  }
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
