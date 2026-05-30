#!/usr/bin/env tsx
import { prisma } from "../src/server/lib/prisma";
async function main() {
  const userId = process.argv[2];
  const prefs = await prisma.userPreference.findUnique({ where: { userId } });
  console.log(JSON.stringify(prefs, null, 2));
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
