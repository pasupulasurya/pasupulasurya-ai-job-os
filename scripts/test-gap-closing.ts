#!/usr/bin/env tsx
// Smoke-test gap-closing: supply evidence for a skill, watch the engine
// classify new/augment, verify, write back, persist.
// Run: npx dotenv -e .env.local -- tsx scripts/test-gap-closing.ts
import { prisma } from "../src/server/lib/prisma";
import { generateBulletFromEvidence } from "../src/server/services/ai/tailor";

async function main() {
  const row = await prisma.tailoredResume.findFirst();
  if (!row) throw new Error("No TailoredResume — run test-tailor-smoke first");

  console.log(`Tailored resume: ${row.id} (match ${row.matchId})`);
  console.log("Closing gap: 'kubernetes' with realistic evidence...\n");

  const result = await generateBulletFromEvidence({
    matchId: row.matchId,
    userId: row.userId,
    skill: "kubernetes",
    evidence:
      "At BYJU'S I deployed our internal analytics dashboards on a Kubernetes cluster and maintained the deployment configs for about six months.",
  });

  console.log(`Move: ${result.move}`);
  console.log(`Target role index: ${result.targetRoleIndex}`);
  console.log(`Target bullet index: ${result.targetBulletIndex}`);
  console.log(`\nGenerated bullet:\n${result.bulletText}`);
  console.log(`\nLedger entry:\n${JSON.stringify(result.newLedgerEntry, null, 2)}`);

  // Confirm write-back landed on master.
  const master = await prisma.resumeVersion.findUnique({
    where: { id: row.masterResumeId },
    select: { parsedJson: true },
  });
  const skills = (master?.parsedJson as { skills?: string[] })?.skills ?? [];
  console.log(
    `\nMaster skills now include kubernetes: ${skills.some((s) => s.toLowerCase() === "kubernetes")}`,
  );

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("\nFailed:", err.message);
  await prisma.$disconnect();
  process.exit(1);
});
