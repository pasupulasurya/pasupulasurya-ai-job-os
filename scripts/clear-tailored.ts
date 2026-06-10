#!/usr/bin/env tsx
// Dev helper: clear all TailoredResume rows so smoke test regenerates.
import { prisma } from "../src/server/lib/prisma";

async function main() {
  const r = await prisma.tailoredResume.deleteMany({});
  console.log(`cleared ${r.count} rows`);
  await prisma.$disconnect();
}
main();
