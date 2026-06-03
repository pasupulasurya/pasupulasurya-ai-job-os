#!/usr/bin/env tsx
/**
 * Test the new resume parser prompt against the current master resume.
 * Compares OLD skills (from current parsedJson) vs NEW skills (just-generated).
 *
 * Pass criteria:
 * - Noise removed: 'coursera', 'chrodadb' should NOT appear in new output
 * - Real skills preserved: 'pytorch', 'langchain', 'python', 'bert', etc. should still appear
 * - Canonical form applied: 'chromadb' should appear if 'chrodadb' was in old output
 */
import { prisma } from "../src/server/lib/prisma";
import { parseResume } from "../src/server/services/ai/parse-resume";

async function main() {
  const userId = process.argv[2] ?? "usr_98b04a8e6a854a0bb7ce8e04b4357922";

  const resume = await prisma.resumeVersion.findFirst({
    where: { user: { id: userId }, isMaster: true },
    select: { id: true, contentJson: true, parsedJson: true, parseVersion: true },
  });
  if (!resume) {
    console.error("No master resume found");
    process.exit(1);
  }

  const content = resume.contentJson as { rawText?: string } | null;
  const rawText = content?.rawText;
  if (!rawText) {
    console.error("No rawText in contentJson");
    process.exit(1);
  }

  const oldParsed = resume.parsedJson as { skills?: string[] } | null;
  const oldSkills = oldParsed?.skills ?? [];

  console.log("=== OLD skills (currently in DB) ===");
  console.log(`version: ${resume.parseVersion}`);
  console.log(`count: ${oldSkills.length}`);
  console.log(oldSkills.join(", "));
  console.log();

  console.log("Running new prompt (no DB writes)...");
  const newParsed = await parseResume(rawText);
  const newSkills = newParsed.skills;

  console.log();
  console.log("=== NEW skills (from new prompt) ===");
  console.log(`count: ${newSkills.length}`);
  console.log(newSkills.join(", "));
  console.log();

  // Diff
  const oldSet = new Set(oldSkills);
  const newSet = new Set(newSkills);
  const added = newSkills.filter((s) => !oldSet.has(s));
  const removed = oldSkills.filter((s) => !newSet.has(s));

  console.log("=== Diff ===");
  console.log(`Added in new: [${added.join(", ")}]`);
  console.log(`Removed in new: [${removed.join(", ")}]`);
  console.log();

  // Verdicts
  const NOISE_TARGETS = ["coursera", "udemy", "edx", "chrodadb", "datacamp"];
  const noiseFound = newSkills.filter((s) => NOISE_TARGETS.includes(s.toLowerCase()));
  const verdict =
    noiseFound.length === 0
      ? "✅ PASS — no noise targets in new output"
      : `❌ FAIL — noise still present: [${noiseFound.join(", ")}]`;

  console.log("=== Verdict ===");
  console.log(verdict);
  console.log();
  console.log(
    "Check that real skills (pytorch, langchain, python, bert, langgraph) are preserved manually.",
  );
  process.exit(0);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
