// src/server/services/ai/verify.ts
// Phase 2G — verification pass. Two layers:
//   1. Code-side claim-drift check: numbers + suspicious-term detection. Free, deterministic.
//   2. LLM-as-verifier: semantic drift check on a single parent-child pair.
// A bullet passes only if BOTH layers pass.

import { z } from "zod";
import { CerebrasProvider } from "./cerebras-provider";

export type DriftCheckResult = {
  ok: boolean;
  reasons: string[];
};

// ---------- Layer 1: code-side checks ----------

// Numbers in the child must all appear in the parent (no invented metrics).
function extractNumbers(text: string): string[] {
  return text.match(/\d+(?:[.,]\d+)?%?/g) ?? [];
}

// Words in child not in parent that look like domain qualifiers.
// We compare word sets and flag NEW words that are capitalized terms or
// known drift patterns (domain adjectives the model likes to insert).
const DRIFT_TERM_PATTERNS = [
  /safety/i,
  /security/i,
  /compliance/i,
  /fintech/i,
  /healthcare/i,
  /\bai\b/i,
  /\bml\b/i,
  /machine learning/i,
  /artificial intelligence/i,
  /blockchain/i,
  /crypto/i,
  /defense/i,
  /military/i,
  /clinical/i,
];

export function codeDriftCheck(parentText: string, childText: string): DriftCheckResult {
  const reasons: string[] = [];

  // Numbers check.
  const parentNums = new Set(extractNumbers(parentText));
  const childNums = extractNumbers(childText);
  for (const n of childNums) {
    if (!parentNums.has(n)) reasons.push(`invented number: "${n}"`);
  }

  // Domain-qualifier check: pattern present in child but not in parent.
  for (const re of DRIFT_TERM_PATTERNS) {
    const inChild = re.test(childText);
    const inParent = re.test(parentText);
    if (inChild && !inParent) {
      const match = childText.match(re)?.[0] ?? re.source;
      reasons.push(`inserted domain term not in master: "${match}"`);
    }
  }

  return { ok: reasons.length === 0, reasons };
}

// ---------- Layer 2: LLM verifier ----------

const VerifierOutputSchema = z.object({
  verdict: z.enum(["pass", "fail"]),
  violations: z.array(z.string()),
});

const VERIFIER_SYSTEM_PROMPT = `\
You are a strict resume-integrity verifier. You receive a MASTER bullet (the truth)
and a TAILORED bullet (a rephrase). Your only job: determine whether the tailored
bullet claims ANYTHING the master does not support.

Violations include:
- New numbers, metrics, or scales not in the master.
- New technologies, tools, or skills not in the master.
- New domain context (e.g. "safety", "AI", "fintech") not in the master.
- Stronger claims ("led" when master says "supported"; "built" when master says "used").
- Implied outcomes the master doesn't state.

Pure vocabulary changes, reordering, and synonyms with the SAME meaning are fine.

Output strict JSON:
{ "verdict": "pass" | "fail", "violations": ["<specific violation>", ...] }
If pass, violations must be [].`;

function buildVerifierUserPrompt(parentText: string, childText: string): string {
  return `\
MASTER (the truth):
${parentText}

TAILORED (the rephrase to verify):
${childText}

Does the tailored bullet claim anything the master does not support? Output JSON.`;
}

export async function llmDriftCheck(
  provider: CerebrasProvider,
  parentText: string,
  childText: string,
): Promise<DriftCheckResult> {
  const result = await provider.generate({
    system: VERIFIER_SYSTEM_PROMPT,
    user: buildVerifierUserPrompt(parentText, childText),
    schema: VerifierOutputSchema,
    maxTokens: 2048,
  });
  return { ok: result.verdict === "pass", reasons: result.violations };
}

// ---------- Combined ----------

export async function verifyBullet(
  provider: CerebrasProvider,
  parentText: string,
  childText: string,
): Promise<DriftCheckResult> {
  const code = codeDriftCheck(parentText, childText);
  if (!code.ok) return code; // fail fast, skip LLM cost
  return llmDriftCheck(provider, parentText, childText);
}

export const __verifyInternals = {
  VERIFIER_SYSTEM_PROMPT,
  buildVerifierUserPrompt,
  extractNumbers,
  DRIFT_TERM_PATTERNS,
};

// ---------- Summary verification ----------
// Truth source = the ENTIRE master parsedJson, not just the old summary.
// A tailored summary may legitimately surface skills/accomplishments from
// workHistory that the old summary never mentioned — that's truth-surfacing,
// not fabrication. What it may NOT do: claim domains, skills, or outcomes
// found nowhere in the master.

const SUMMARY_VERIFIER_SYSTEM_PROMPT = `\
You are a strict resume-integrity verifier. You receive the candidate's FULL MASTER
RESUME CONTENT (the truth) and a TAILORED SUMMARY to verify.

The tailored summary MAY:
- Mention any skill, tool, accomplishment, or experience found ANYWHERE in the master
  (summary, skills list, or work-history bullets) — even if the old summary omitted it.
- Reorder, re-emphasize, rephrase.

The tailored summary may NOT:
- Claim skills, tools, domains, or experiences found NOWHERE in the master.
- State aspirations or aims toward a domain absent from the master (e.g. "safety-focused",
  "AI-driven", "fintech") — aspirational framing does not exempt fabrication.
- Inflate seniority, scope, or outcomes beyond what master content supports.

Output strict JSON:
{ "verdict": "pass" | "fail", "violations": ["<specific violation>", ...] }
If pass, violations must be [].`;

function buildSummaryVerifierUserPrompt(args: {
  masterSummary: string;
  masterSkills: string[];
  masterBulletsFlat: string[];
  tailoredSummary: string;
}): string {
  return `\
MASTER SUMMARY:
${args.masterSummary || "(none)"}

MASTER SKILLS:
${args.masterSkills.join(", ") || "(none)"}

MASTER WORK-HISTORY BULLETS:
${args.masterBulletsFlat.map((b) => "- " + b).join("\n") || "(none)"}

TAILORED SUMMARY TO VERIFY:
${args.tailoredSummary}

Does the tailored summary claim anything found nowhere in the master content above? Output JSON.`;
}

export async function verifySummary(
  provider: CerebrasProvider,
  args: {
    masterSummary: string;
    masterSkills: string[];
    masterBulletsFlat: string[];
    tailoredSummary: string;
  },
): Promise<DriftCheckResult> {
  // Layer 1: code check — domain terms in tailored but nowhere in master corpus.
  const corpus = [args.masterSummary, ...args.masterSkills, ...args.masterBulletsFlat].join(" ");
  const reasons: string[] = [];
  for (const re of DRIFT_TERM_PATTERNS) {
    if (re.test(args.tailoredSummary) && !re.test(corpus)) {
      const match = args.tailoredSummary.match(re)?.[0] ?? re.source;
      reasons.push(`inserted domain term not in master: "${match}"`);
    }
  }
  if (reasons.length > 0) return { ok: false, reasons };

  // Layer 2: LLM verifier against full master corpus.
  const result = await provider.generate({
    system: SUMMARY_VERIFIER_SYSTEM_PROMPT,
    user: buildSummaryVerifierUserPrompt(args),
    schema: VerifierOutputSchema,
    maxTokens: 2048,
  });
  return { ok: result.verdict === "pass", reasons: result.violations };
}

// ---------- Batched bullet verification ----------
// One LLM call verifies all of a role's parent-child pairs. Output schema
// forces a per-index verdict so the model can't skip items. Code-side drift
// check still runs per-bullet BEFORE this (free, deterministic layer).

const BatchVerifierOutputSchema = z.object({
  results: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      verdict: z.enum(["pass", "fail"]),
      violations: z.array(z.string()),
    }),
  ),
});

const BATCH_VERIFIER_SYSTEM_PROMPT = `\
You are a strict resume-integrity verifier. You receive multiple MASTER/TAILORED
bullet pairs. For EACH pair independently, determine whether the tailored bullet
claims ANYTHING the master does not support.

Violations include:
- New numbers, metrics, or scales not in the master.
- New technologies, tools, or skills not in the master.
- New domain context (e.g. "safety", "AI", "fintech") not in the master.
- Stronger claims ("led" when master says "supported"; "Streamlined" when master
  says "Helped streamline").
- Implied outcomes the master doesn't state.

Pure vocabulary changes, reordering, and synonyms with the SAME meaning are fine.

Judge each pair on its own. Do not let earlier pairs influence later ones.

Output strict JSON:
{
  "results": [
    { "index": 0, "verdict": "pass" | "fail", "violations": [...] },
    { "index": 1, "verdict": "pass" | "fail", "violations": [...] },
    ...
  ]
}
One result per input pair, same index. If pass, violations must be [].`;

function buildBatchVerifierUserPrompt(
  pairs: Array<{ parentText: string; childText: string }>,
): string {
  return pairs
    .map(
      (p, i) => `\
=== PAIR ${i} ===
MASTER (the truth):
${p.parentText}

TAILORED (to verify):
${p.childText}`,
    )
    .join("\n\n");
}

/**
 * Verify a batch of parent-child pairs in ONE LLM call.
 * Returns one DriftCheckResult per pair, in input order.
 * Code-side check runs per-pair first; pairs failing code check skip the LLM
 * (their result is final). Only code-passing pairs go to the LLM batch.
 */
export async function verifyBulletsBatch(
  provider: CerebrasProvider,
  pairs: Array<{ parentText: string; childText: string }>,
): Promise<DriftCheckResult[]> {
  const results: DriftCheckResult[] = new Array(pairs.length);
  const llmPairs: Array<{ originalIndex: number; parentText: string; childText: string }> = [];

  // Layer 1 per-pair: code check. Failures are final; passes queue for LLM.
  pairs.forEach((p, i) => {
    const code = codeDriftCheck(p.parentText, p.childText);
    if (!code.ok) {
      results[i] = code;
    } else {
      llmPairs.push({ originalIndex: i, parentText: p.parentText, childText: p.childText });
    }
  });

  if (llmPairs.length === 0) return results;

  // Layer 2: one batched LLM call for the code-passing pairs.
  const batch = await provider.generate({
    system: BATCH_VERIFIER_SYSTEM_PROMPT,
    user: buildBatchVerifierUserPrompt(
      llmPairs.map((p) => ({ parentText: p.parentText, childText: p.childText })),
    ),
    schema: BatchVerifierOutputSchema,
    maxTokens: 4096,
  });

  // Strict: one result per pair, indexes must align.
  if (batch.results.length !== llmPairs.length) {
    throw new Error(
      `Batch verifier length mismatch: sent=${llmPairs.length}, got=${batch.results.length}`,
    );
  }
  for (const r of batch.results) {
    const mapped = llmPairs[r.index];
    if (!mapped) throw new Error(`Batch verifier returned unknown index: ${r.index}`);
    results[mapped.originalIndex] = {
      ok: r.verdict === "pass",
      reasons: r.violations,
    };
  }

  // Any pair the model silently skipped is a hard error (integrity > convenience).
  for (let i = 0; i < results.length; i++) {
    if (!results[i]) throw new Error(`Batch verifier missing result for pair ${i}`);
  }
  return results;
}
