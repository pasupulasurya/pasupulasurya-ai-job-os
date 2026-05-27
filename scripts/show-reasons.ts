#!/usr/bin/env tsx
import { prisma } from "../src/server/lib/prisma";
async function main() {
  const userId = process.argv[2];
  const matches = await prisma.userJobMatch.findMany({
    where: { userId },
    orderBy: { matchScore: "desc" },
    take: 15,
    include: { job: { select: { title: true, company: true } } },
  });
  for (const m of matches) {
    console.log(`\n[${m.matchScore.toFixed(1)}] ${m.job.company} — ${m.job.title}`);
    console.log(`Reason: ${m.reason ?? "(none)"}`);
  }
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
