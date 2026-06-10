#!/usr/bin/env tsx
/**
 * Adversarial harness for the tailoring engine. ZERO DB writes.
 * Tests prompts + verifier directly with in-code fixtures.
 * Run: npx dotenv -e .env.local -- tsx scripts/test-tailor-harness.ts
 * Runtime: ~4-5 min (Cerebras 5 req/min cap).
 */
import { CerebrasProvider } from "../src/server/services/ai/cerebras-provider";
import {
  __internals,
  BulletRephraseOutputSchema,
  GapClosingOutputSchema,
} from "../src/server/services/ai/tailor";
import { verifyBullet, codeDriftCheck } from "../src/server/services/ai/verify";

const cerebras = new CerebrasProvider();

// ---------- Fixtures ----------
const FAKE_JOB = {
  title: "Senior Fintech Data Engineer",
  description:
    "We build payment fraud detection systems. Requires: Python, SQL, Spark, " +
    "real-time streaming, financial compliance experience, PCI-DSS knowledge.",
};

const FAKE_MASTER_BULLETS = [
  "Built ETL pipelines in Python to process student enrollment data for an ed-tech platform.",
  "Helped maintain SQL databases supporting course recommendation features.",
];

const FAKE_WORK_HISTORY = [
  {
    title: "Data Engineer",
    company: "EduCorp",
    bullets: FAKE_MASTER_BULLETS,
  },
];

let pass = 0;
let fail = 0;
function report(name: string, ok: boolean, detail: string) {
  if (ok) {
    pass++;
    console.log(`PASS  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name} — ${detail}`);
  }
}

// ---------- Group 1: code-side drift check (free, instant) ----------
function testCodeChecks() {
  console.log("\n=== Group 1: code drift checks (no LLM) ===");
  const r1 = codeDriftCheck(
    "Built dashboards for the sales team.",
    "Built AI-driven dashboards for the sales team.",
  );
  report("code catches inserted 'AI'", !r1.ok, r1.reasons.join("; "));

  const r2 = codeDriftCheck("Improved processing speed.", "Improved processing speed by 40%.");
  report("code catches invented number", !r2.ok, r2.reasons.join("; "));

  const r3 = codeDriftCheck(
    "Analyzed data with Python and SQL.",
    "Performed data analysis using Python and SQL.",
  );
  report("code passes clean rephrase", r3.ok, r3.reasons.join("; "));
}

// ---------- Group 2: adversarial rephrase (domain-shift bait) ----------
async function testAdversarialRephrase() {
  console.log("\n=== Group 2: adversarial rephrase (fintech bait) ===");
  const gen = await cerebras.generate({
    system: __internals.BULLET_REPHRASE_SYSTEM_PROMPT,
    user: __internals.buildBulletRephraseUserPrompt({
      roleTitle: "Data Engineer",
      roleCompany: "EduCorp",
      masterBullets: FAKE_MASTER_BULLETS,
      jobTitle: FAKE_JOB.title,
      jobDescription: FAKE_JOB.description,
      matchedSkills: ["python", "sql"],
    }),
    schema: BulletRephraseOutputSchema,
    maxTokens: 2048,
  });

  for (let i = 0; i < FAKE_MASTER_BULLETS.length; i++) {
    const child = gen.bullets.find((b) => b.parentIndex === i)?.bulletText ?? "(missing)";
    const v = await verifyBullet(cerebras, FAKE_MASTER_BULLETS[i], child);
    const insertedFintech = /fintech|fraud|payment|pci|compliance|financial/i.test(child);
    console.log(`  bullet[${i}]: "${child}"`);
    if (insertedFintech) {
      report(`bullet[${i}] verifier catches fintech insertion`, !v.ok, `verifier said ok=${v.ok}`);
    } else {
      report(`bullet[${i}] generation stayed clean`, v.ok, v.reasons.join("; "));
    }
  }
}

// ---------- Group 3: adversarial gap-closing (FULL loop: generate -> verify -> retry) ----------
// Mirrors production: one retry with violations fed back. Assertion = final
// output passes verification, or the loop correctly refuses (hard error path).
async function gapClosingLoop(skill: string, evidence: string) {
  let verifyReasons: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const retryNote =
      attempt > 0
        ? `\n\nPREVIOUS ATTEMPT WAS REJECTED FOR THESE VIOLATIONS:\n${verifyReasons.map((r) => "- " + r).join("\n")}\nRemove every violation. Use ONLY what the evidence states.`
        : "";
    const candidate = await cerebras.generate({
      system: __internals.GAP_CLOSING_SYSTEM_PROMPT,
      user:
        __internals.buildGapClosingUserPrompt({ skill, evidence, workHistory: FAKE_WORK_HISTORY }) +
        retryNote,
      schema: GapClosingOutputSchema,
      maxTokens: 2048,
    });
    const v = await verifyBullet(cerebras, evidence, candidate.bulletText);
    if (v.ok) return { ok: true as const, bulletText: candidate.bulletText, attempts: attempt + 1 };
    verifyReasons = v.reasons;
  }
  return { ok: false as const, reasons: verifyReasons, attempts: 2 };
}

async function testAdversarialGapClosing() {
  console.log("\n=== Group 3: adversarial gap-closing (full loop) ===");

  // Thin evidence: loop must converge to an honest-minimal bullet OR refuse.
  const thin = await gapClosingLoop("spark", "I know Spark.");
  if (thin.ok) {
    console.log(`  thin (attempts=${thin.attempts}): "${thin.bulletText}"`);
    report("thin evidence: loop converged to verified bullet", true, "");
  } else {
    console.log(`  thin: loop refused after retry — ${thin.reasons.join("; ")}`);
    report("thin evidence: loop correctly refused ungroundable", true, "");
  }

  // Rich evidence: loop MUST converge — there is plenty to ground.
  const rich = await gapClosingLoop(
    "spark",
    "At EduCorp I used Spark to batch-process enrollment logs weekly for about a year.",
  );
  if (rich.ok) {
    console.log(`  rich (attempts=${rich.attempts}): "${rich.bulletText}"`);
    report("rich evidence: loop converged to verified bullet", true, "");
  } else {
    report("rich evidence: loop converged", false, `refused: ${rich.reasons.join("; ")}`);
  }
}

async function main() {
  const start = Date.now();
  testCodeChecks();
  await testAdversarialRephrase();
  await testAdversarialGapClosing();
  const mins = ((Date.now() - start) / 60000).toFixed(1);
  console.log(`\n===== RESULT: ${pass} passed, ${fail} failed (${mins} min) =====`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Harness crashed:", err);
  process.exit(1);
});
