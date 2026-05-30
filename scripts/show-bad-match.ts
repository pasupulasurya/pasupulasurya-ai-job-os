#!/usr/bin/env tsx
import { prisma } from "../src/server/lib/prisma";

async function main() {
  const userId = process.argv[2];
  const match = await prisma.userJobMatch.findFirst({
    where: { userId, job: { title: { contains: "Executive Assistant" } } },
    include: {
      job: {
        select: { title: true, skills: true, seniority: true, sponsorsVisa: true, location: true },
      },
    },
  });
  if (!match) {
    console.log("no match found");
    process.exit(0);
  }

  console.log("=== Job ===");
  console.log("title:", match.job.title);
  console.log("skills:", match.job.skills);
  console.log("seniority:", match.job.seniority);
  console.log("sponsorsVisa:", match.job.sponsorsVisa);
  console.log("location:", match.job.location);
  console.log();
  console.log("=== Match ===");
  console.log("score:", match.matchScore);
  console.log("breakdown:");
  console.log(JSON.stringify(match.scoreBreakdown, null, 2));
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
