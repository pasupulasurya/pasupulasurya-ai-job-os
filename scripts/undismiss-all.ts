#!/usr/bin/env tsx
import { prisma } from "../src/server/lib/prisma";
async function main() {
  const userId = process.argv[2];
  const result = await prisma.userJobMatch.updateMany({
    where: { userId },
    data: { dismissed: false, dismissedAt: null, status: "fresh" },
  });
  console.log(`Un-dismissed ${result.count} matches`);
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
