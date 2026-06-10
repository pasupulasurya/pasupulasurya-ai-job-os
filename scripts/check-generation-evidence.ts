#!/usr/bin/env tsx
// Evidence check: did the after() generation complete, fail, or die silently?
import { prisma } from "../src/server/lib/prisma";

async function main() {
  const rows = await prisma.tailoredResume.findMany({
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      matchId: true,
      status: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
      generationVersion: true,
    },
  });
  for (const r of rows) {
    const durationS = Math.round((r.updatedAt.getTime() - r.createdAt.getTime()) / 1000);
    console.log(`${r.matchId} | ${r.status} | ${durationS}s | err: ${r.errorMessage ?? "none"}`);
  }
  await prisma.$disconnect();
}
main();
