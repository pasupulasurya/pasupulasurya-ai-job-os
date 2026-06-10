#!/usr/bin/env tsx
/**
 * Smoke-test the tailoring engine against a real match in production DB.
 * No rollback — writes one TailoredResume row. Idempotent on re-run.
 * Run via: npx dotenv -e .env.local -- tsx scripts/test-tailor-smoke.ts
 */
import { prisma } from "../src/server/lib/prisma";
import { tailorResumeForMatch } from "../src/server/services/ai/tailor";

async function main() {
  console.log("Finding a user with master resume + matches...");
  const user = await prisma.user.findFirst({
    where: {
      resumes: { some: { isMaster: true } },
      jobMatches: { some: {} },
    },
    include: {
      jobMatches: {
        where: { status: "fresh" },
        orderBy: { matchScore: "desc" },
        take: 1,
        include: { job: true },
      },
    },
  });

  if (!user) throw new Error("No user with master + matches found");

  // Fallback: any match if no fresh.
  let match = user.jobMatches[0];
  if (!match) {
    const any = await prisma.userJobMatch.findFirst({
      where: { userId: user.id },
      orderBy: { matchScore: "desc" },
      include: { job: true },
    });
    if (!any) throw new Error("User has no matches at all");
    match = any;
  }

  console.log(`User: ${user.email} (${user.id})`);
  console.log(`Match: ${match.job.title} @ ${match.job.company}`);
  console.log(`Match score: ${match.matchScore}`);
  console.log(`Match id: ${match.id}`);
  console.log("");

  console.log("Running tailorResumeForMatch...");
  const start = Date.now();
  const result = await tailorResumeForMatch({
    userId: user.id,
    matchId: match.id,
  });
  const elapsedMs = Date.now() - start;

  console.log(`\nCompleted in ${elapsedMs}ms`);
  console.log(`Resumed existing: ${result.resumed}`);
  console.log(`TailoredResume id: ${result.tailoredResumeId}`);
  console.log(`Ledger entries: ${result.changeLedger.length}`);
  console.log("");

  console.log("===== TAILORED SUMMARY =====");
  console.log(result.tailoredJson.summary);
  console.log("");

  console.log("===== TAILORED SKILLS (first 15) =====");
  console.log(result.tailoredJson.skills.slice(0, 15).join(", "));
  console.log("");

  console.log("===== WORK HISTORY (titles + bullet counts) =====");
  result.tailoredJson.workHistory.forEach((role, i) => {
    console.log(
      `[${i}] ${role.title ?? "(no title)"} @ ${role.company ?? "(no company)"} — ${role.bullets.length} bullets`,
    );
  });
  console.log("");

  console.log("===== FIRST ROLE — TAILORED BULLETS vs MASTER =====");
  const firstRole = result.tailoredJson.workHistory[0];
  if (firstRole) {
    firstRole.bullets.slice(0, 3).forEach((b, i) => {
      const ledger = result.changeLedger.find(
        (l) => l.targetRoleIndex === 0 && l.targetBulletIndex === i,
      );
      console.log(`\n[${i}] BEFORE: ${ledger?.beforeText ?? "(no master text recorded)"}`);
      console.log(`    AFTER:  ${b.text}`);
    });
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("\nSmoke test failed:");
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
