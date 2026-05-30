#!/usr/bin/env tsx
import { prisma } from "../src/server/lib/prisma";
async function main() {
  const userId = process.argv[2];
  const resume = await prisma.resumeVersion.findFirst({
    where: { userId, isMaster: true },
    select: { parsedJson: true, fileName: true },
  });
  const parsed = resume?.parsedJson as { skills?: unknown } | null;
  const skills = Array.isArray(parsed?.skills) ? parsed.skills : [];
  console.log("fileName:", resume?.fileName);
  console.log("total skills in parsedJson:", skills.length);
  console.log("skills:", JSON.stringify(skills, null, 2));
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
