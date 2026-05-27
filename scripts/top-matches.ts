#!/usr/bin/env tsx
import { prisma } from "../src/server/lib/prisma";
async function main() {
  const userId = process.argv[2];
  const matches = await prisma.userJobMatch.findMany({
    where: { userId },
    orderBy: { matchScore: "desc" },
    take: 15,
    include: { job: { select: { title: true, company: true, location: true } } },
  });
  console.log(`\nTOP 15 MATCHES FOR USER:\n`);
  for (const m of matches) {
    console.log(
      `${m.matchScore.toFixed(1).padStart(5)}  ${m.job.company.padEnd(15)} ${m.job.title}`,
    );
  }
  console.log(
    `\nTotal matches stored: ${await prisma.userJobMatch.count({ where: { userId } })}\n`,
  );
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
