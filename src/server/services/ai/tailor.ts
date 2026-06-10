// src/server/services/ai/tailor.ts
// Phase 2G — Resume tailoring engine.
//
// Public API:
//   tailorResumeForMatch({ userId, matchId }) -> TailoringResult
//   generateBulletFromEvidence({ skill, evidence, masterRoles }) -> GapClosingResult
//
// Architecture:
//   - 3 LLM job types: summary rewrite, bullet rephrase (batched per role),
//     gap-closing generation (on-demand from UI evidence).
//   - Cerebras gpt-oss-120b for all generation (free-tier, no card).
//     Per-call model override stays available for the verifier (2G.1 step 3).
//   - Every change carries provenance into the change ledger:
//     - rephrase/augment -> parentMasterBulletId
//     - new bullet -> evidence sentence
//     - skill add -> evidence sentence
//   - Idempotent: if a TailoredResume already exists for the match,
//     return it as-is (user is resuming a draft).
//
// What stays in CODE not LLM:
//   - Skill ordering (from scoreBreakdown.skills matched list)
//   - Which bullets to include (default all; UI curates trim)
//   - Education + personal info (copied verbatim from master)

import { z } from "zod";

export const TAILORING_VERSION = "cerebras-gpt-oss-120b-tailor-v2";

// ---------- Change ledger record ----------
// Stored as a JSON array in TailoredResume.changeLedger. Each AI-produced
// change emits exactly one record before the engine returns.

export const ChangeLedgerRecordSchema = z.object({
  move: z.enum([
    "summary_rewrite",
    "bullet_rephrase",
    "new_bullet",
    "augment_bullet",
    "skill_added",
  ]),
  // Which gap this closes; null for summary/rephrase that don't target a specific gap.
  skillClosed: z.string().nullable(),
  // User-supplied evidence sentence; only present for gap-closing moves.
  evidence: z.string().nullable(),
  // Index into tailoredJson.workHistory[]. Null for summary/skill_added.
  targetRoleIndex: z.number().int().nullable(),
  // Index of the bullet within the target role. Null for new_bullet appended at end.
  targetBulletIndex: z.number().int().nullable(),
  // Trace to the master bullet this derives from. Required for bullet_rephrase/augment_bullet.
  parentMasterBulletId: z.string().nullable(),
  // Pre-change text. Null for new_bullet/skill_added (no prior content).
  beforeText: z.string().nullable(),
  // Post-change text. Always present.
  afterText: z.string(),
  // User can revert any change; reverted records stay in ledger for audit.
  reverted: z.boolean().default(false),
  // Full Q&A thread for gap-closing moves (2G.2 amendment). Null otherwise.
  conversation: z
    .array(z.object({ role: z.enum(["ai", "user"]), text: z.string() }))
    .nullable()
    .default(null),
});
export type ChangeLedgerRecord = z.infer<typeof ChangeLedgerRecordSchema>;

// ---------- Tailored content shape ----------
// Lives in TailoredResume.tailoredJson. Education + personal info are
// copied verbatim from master and not surfaced in the type — we read them
// straight from master.parsedJson at render time.

export const TailoredBulletSchema = z.object({
  // Stable id we mint to track this bullet across edits/reverts.
  id: z.string(),
  // The current visible text.
  text: z.string(),
  // For provenance: which master bullet (if any) this descends from.
  // null means "new bullet from evidence."
  parentMasterBulletId: z.string().nullable(),
});

export const TailoredRoleSchema = z.object({
  // Mirrors master.parsedJson.workHistory[i].title / company / dates verbatim.
  title: z.string().nullable(),
  company: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  bullets: z.array(TailoredBulletSchema),
});

export const TailoredJsonSchema = z.object({
  summary: z.string(),
  // Skills ordered by relevance to the job (matcher-driven, code not LLM).
  skills: z.array(z.string()),
  workHistory: z.array(TailoredRoleSchema),
});
export type TailoredJson = z.infer<typeof TailoredJsonSchema>;

// ---------- Per-LLM-job output schemas ----------
// Used inside the engine to validate each LLM call's output before
// converting it into TailoredJson + ledger entries.

// Summary rewrite: one call, returns rewritten summary plus the
// master-facts it traced. claimsTraced is for the verifier (2G.1 step 3).
export const SummaryRewriteOutputSchema = z.object({
  summary: z.string(),
  claimsTraced: z.array(z.string()),
});

// Per-role bullet rephrase: batched call returns an array, each item
// declaring its parent master bullet via parentIndex (0-indexed into the
// role's master bullets). bulletText is the rewritten content.
export const BulletRephraseOutputSchema = z.object({
  bullets: z.array(
    z.object({
      parentIndex: z.number().int().nonnegative(),
      bulletText: z.string(),
    }),
  ),
});

// Gap-closing generation: AI classifies new vs augment and emits the line.
// If "augment", parentRoleIndex + parentBulletIndex must point to an
// existing master bullet. If "new", parentRoleIndex points to the role to
// append under (no parentBulletIndex).
export const GapClosingOutputSchema = z.object({
  move: z.enum(["new_bullet", "augment_bullet"]),
  parentRoleIndex: z.number().int().nonnegative(),
  parentBulletIndex: z.number().int().nonnegative().nullable(),
  bulletText: z.string(),
  // For verifier: the master claims this generation references.
  claimsReferenced: z.array(z.string()),
});

// ---------- Public engine input / output ----------

export type TailoringInput = {
  userId: string;
  matchId: string;
};

export type TailoringResult = {
  tailoredResumeId: string;
  tailoredJson: TailoredJson;
  changeLedger: ChangeLedgerRecord[];
  status: "generated" | "verified" | "saved";
  tokensUsed: number | null;
  generationVersion: string;
  resumed: boolean; // true if returned an existing row instead of generating
};

export type GapClosingInput = {
  matchId: string;
  userId: string;
  skill: string;
  evidence: string;
  conversation?: ConversationMessage[];
};

export type GapClosingResult = {
  move: "new_bullet" | "augment_bullet";
  targetRoleIndex: number;
  targetBulletIndex: number | null;
  bulletText: string;
  // Updated full tailoredJson + new ledger record appended.
  tailoredJson: TailoredJson;
  newLedgerEntry: ChangeLedgerRecord;
};

// ============================================================
// PROMPTS
// ============================================================
// Three job types: summary rewrite, bullet rephrase, gap-closing.
// All share the same integrity constraint: never invent facts;
// every claim must trace to the inputs.

const INTEGRITY_RULES = `\
INTEGRITY RULES (non-negotiable):
- Never invent facts, numbers, technologies, or accomplishments not present in the inputs.
- Every claim in your output must trace to something in the inputs you were given.
- If you cannot ground a statement in the inputs, omit it.
- Do NOT change company names, job titles, dates, or education details.
- You may reorder, re-emphasize, and rephrase in the job's vocabulary. You may NOT add or invent.
- CRITICAL: Do NOT insert the target job's domain words into bullets unless the master
  bullet itself contains that domain. Examples of FORBIDDEN insertions: adding
  "safety-relevant", "safety-related", "AI-driven", "fintech", "healthcare", or any
  job-domain qualifier to a bullet whose master text never mentions that domain.
  Rephrasing means SAME claims in different words — never broader or domain-shifted claims.
- Output strict JSON matching the requested schema. No prose, no markdown, no comments.`;

// ---------- Summary rewrite ----------

const SUMMARY_SYSTEM_PROMPT = `\
You rewrite professional resume summaries to align with a target job, without inventing.

${INTEGRITY_RULES}

Your output schema:
{
  "summary": "<rewritten 2-4 sentence summary>",
  "claimsTraced": ["<master-fact-1>", "<master-fact-2>", ...]
}

claimsTraced must list the specific master-resume facts your rewrite uses.
This list will be verified against the master. Be precise — phrase each
claim as a short factual statement, not a quote.`;

function buildSummaryUserPrompt(args: {
  masterSummary: string;
  jobTitle: string;
  jobDescription: string;
  matchedSkills: string[];
  gapSkills: string[];
}): string {
  return `\
MASTER SUMMARY (the truth about the candidate):
${args.masterSummary}

TARGET JOB TITLE:
${args.jobTitle}

TARGET JOB DESCRIPTION:
${args.jobDescription}

SKILLS THE CANDIDATE GENUINELY HAS THAT THIS JOB WANTS:
${args.matchedSkills.length > 0 ? args.matchedSkills.join(", ") : "(none extracted)"}

SKILLS THIS JOB WANTS THAT ARE NOT IN THE CANDIDATE'S RESUME:
${args.gapSkills.length > 0 ? args.gapSkills.join(", ") : "(none)"}
(Do NOT claim the gap skills. They are listed for context only.)

Rewrite the summary so it speaks to this specific job in the job's vocabulary,
while staying 100% grounded in the master summary. 2-4 sentences. Output JSON.`;
}

// ---------- Bullet rephrase (batched per role) ----------

const BULLET_REPHRASE_SYSTEM_PROMPT = `\
You rephrase resume bullets one-to-one to align with a target job, without inventing.

${INTEGRITY_RULES}

You receive an array of master bullets from one role. Output exactly the same number
of rephrased bullets, each tagged with its parentIndex (0-based position in the input
array). DO NOT merge, split, drop, or reorder. DO NOT invent metrics or technologies
not in the original bullet.

Your output schema:
{
  "bullets": [
    { "parentIndex": 0, "bulletText": "<rephrased bullet 0>" },
    { "parentIndex": 1, "bulletText": "<rephrased bullet 1>" },
    ...
  ]
}

The output array length MUST equal the input array length.`;

function buildBulletRephraseUserPrompt(args: {
  roleTitle: string | null;
  roleCompany: string | null;
  masterBullets: string[];
  jobTitle: string;
  jobDescription: string;
  matchedSkills: string[];
}): string {
  const bulletsListing = args.masterBullets.map((b, i) => `[${i}] ${b}`).join("\n");
  return `\
ROLE: ${args.roleTitle ?? "(unknown title)"} at ${args.roleCompany ?? "(unknown company)"}

MASTER BULLETS FOR THIS ROLE (the truth about what the candidate did):
${bulletsListing}

TARGET JOB TITLE: ${args.jobTitle}

TARGET JOB DESCRIPTION:
${args.jobDescription}

SKILLS THE CANDIDATE HAS THAT THIS JOB WANTS:
${args.matchedSkills.length > 0 ? args.matchedSkills.join(", ") : "(none extracted)"}

Rephrase each bullet to speak to this job in the job's vocabulary. Stay grounded
in what the master bullet actually says. Output one rephrased bullet per input bullet,
in JSON, tagged with parentIndex.`;
}

// ---------- Gap-closing generation ----------

const GAP_CLOSING_SYSTEM_PROMPT = `\
You add a single resume bullet to surface a candidate skill the resume didn't already
mention, based on user-provided evidence. You may NOT invent. You may only convert the
user's evidence into a properly-phrased bullet under the right role.

${INTEGRITY_RULES}

You receive:
- A skill the candidate is closing the gap on.
- The user's plain-text evidence describing where/how they used the skill.
- The candidate's full work history (roles + bullets).

Decide between two moves:
- "new_bullet": Add a new bullet under one specific role. Use this when the evidence
  describes a distinct accomplishment not already represented under that role's bullets.
- "augment_bullet": Rewrite one specific existing bullet to fold in the skill. Use this
  when the evidence is a richer angle on something already listed.

Your output schema:
{
  "move": "new_bullet" | "augment_bullet",
  "parentRoleIndex": <0-based index into workHistory>,
  "parentBulletIndex": <0-based index into that role's bullets, or null for new_bullet>,
  "bulletText": "<the new or rewritten bullet>",
  "claimsReferenced": ["<master-fact-or-evidence-fact-used>", ...]
}

parentRoleIndex MUST point to a real role in the work history.
For augment_bullet, parentBulletIndex MUST point to an existing bullet in that role.
For new_bullet, parentBulletIndex MUST be null.
claimsReferenced lists every fact your bullet relies on — these will be verified.`;

function buildGapClosingUserPrompt(args: {
  skill: string;
  evidence: string;
  workHistory: Array<{
    title: string | null;
    company: string | null;
    bullets: string[];
  }>;
}): string {
  const historyListing = args.workHistory
    .map((role, i) => {
      const bullets = role.bullets.map((b, j) => `  [${i}.${j}] ${b}`).join("\n");
      return `Role [${i}]: ${role.title ?? "(unknown)"} at ${role.company ?? "(unknown)"}\n${bullets || "  (no bullets)"}`;
    })
    .join("\n\n");
  return `\
SKILL TO CLOSE: ${args.skill}

USER'S EVIDENCE (where/how they used this skill — the truth):
${args.evidence}

CANDIDATE'S WORK HISTORY:
${historyListing}

Decide new_bullet vs augment_bullet based on the evidence. Pick the role it fits.
Write the bullet using only what the evidence tells you. Output JSON.`;
}

// Exported for the harness (test-tailor-prompt.ts) and for the verifier (2G.1 step 3).
export const __internals = {
  INTEGRITY_RULES,
  SUMMARY_SYSTEM_PROMPT,
  buildSummaryUserPrompt,
  BULLET_REPHRASE_SYSTEM_PROMPT,
  buildBulletRephraseUserPrompt,
  GAP_CLOSING_SYSTEM_PROMPT,
  buildGapClosingUserPrompt,
};

// ============================================================
// ENGINE
// ============================================================

import { prisma } from "@/server/lib/prisma";
import { logger } from "@/server/lib/logger";
import { CerebrasProvider } from "./cerebras-provider";
import { verifyBullet, verifyBulletsBatch, verifySummary } from "./verify";

// Bullet ids are minted from the role index + position for stable provenance.
// e.g. "m:1.3" = master role 1, bullet 3. "n:<uuid>" = new bullet from evidence.
function masterBulletId(roleIndex: number, bulletIndex: number): string {
  return `m:${roleIndex}.${bulletIndex}`;
}

// Extract the matcher's matched-skills + gap-skills from scoreBreakdown.
// scoreBreakdown.skills.signal is human prose ("3/5 job skills in resume").
// We need the actual lists, so we derive from raw job.skills vs user.resumeSkills.
function deriveSkillSets(args: { jobSkills: string[]; userResumeSkills: string[] }): {
  matched: string[];
  gap: string[];
} {
  const userSet = new Set(args.userResumeSkills.map((s) => s.toLowerCase()));
  const matched = args.jobSkills.filter((s) => userSet.has(s.toLowerCase()));
  const gap = args.jobSkills.filter((s) => !userSet.has(s.toLowerCase()));
  return { matched, gap };
}

// Master parsedJson shape we depend on. Defensive: parseResume's per-field
// .catch() means any of these can be null/missing. We narrow at the boundary.
type MasterParsed = {
  summary?: string | null;
  skills?: string[] | null;
  workHistory?: Array<{
    title?: string | null;
    company?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    bullets?: string[] | null;
  }> | null;
};

function readMasterParsed(parsedJson: unknown): MasterParsed {
  if (!parsedJson || typeof parsedJson !== "object") return {};
  return parsedJson as MasterParsed;
}

// Load everything the engine needs from the DB. Throws if anything required
// is missing (no master, no parsedJson, no match, etc.) — these are not
// recoverable runtime errors, they're "this user can't be tailored yet."
async function loadTailoringInputs(args: { userId: string; matchId: string }) {
  const match = await prisma.userJobMatch.findUnique({
    where: { id: args.matchId },
    include: { job: true },
  });
  if (!match) throw new Error(`Match not found: ${args.matchId}`);
  if (match.userId !== args.userId) throw new Error("Match does not belong to user");

  const master = await prisma.resumeVersion.findFirst({
    where: { userId: args.userId, isMaster: true },
  });
  if (!master) throw new Error("No master resume — user must upload one first");
  const parsed = readMasterParsed(master.parsedJson);
  if (!parsed.workHistory || parsed.workHistory.length === 0) {
    throw new Error("Master resume has no parsed workHistory — re-upload may be needed");
  }

  return { match, master, parsed };
}

/**
 * Main entry point. Tailor a resume for a specific match.
 * Idempotent: re-running returns the existing TailoredResume row if one
 * already exists (user is resuming a draft). To force regeneration,
 * delete the row first.
 *
 * Failure modes:
 *  - Throws if master resume / match / parsed workHistory missing.
 *  - Per-LLM-call failures: summary failure throws; per-role bullet
 *    rephrase failure falls back to copying master bullets unchanged
 *    (honest — they're true even if not job-targeted).
 *  - One bad role does NOT fail the whole tailoring.
 */
export async function tailorResumeForMatch(input: TailoringInput): Promise<TailoringResult> {
  // Idempotency check: existing row -> return it.
  const existing = await prisma.tailoredResume.findUnique({
    where: { matchId: input.matchId },
  });
  if (existing) {
    logger.info({ matchId: input.matchId, status: existing.status }, "tailor.resumed_existing");
    return {
      tailoredResumeId: existing.id,
      tailoredJson: existing.tailoredJson as TailoredJson,
      changeLedger: existing.changeLedger as ChangeLedgerRecord[],
      status: existing.status as "generated" | "verified" | "saved",
      tokensUsed: existing.tokensUsed,
      generationVersion: existing.generationVersion,
      resumed: true,
    };
  }

  // Fresh generation.
  const { match, master, parsed } = await loadTailoringInputs(input);
  const cerebras = new CerebrasProvider();
  const ledger: ChangeLedgerRecord[] = [];
  let totalTokens = 0;

  const jobSkills = match.job.skills ?? [];
  const userSkills = parsed.skills ?? [];
  const { matched: matchedSkills, gap: gapSkills } = deriveSkillSets({
    jobSkills,
    userResumeSkills: userSkills,
  });

  // ---------- Step 1: summary rewrite ----------
  const masterSummary = parsed.summary ?? "";
  const summaryResult = await cerebras.generate({
    system: __internals.SUMMARY_SYSTEM_PROMPT,
    user: __internals.buildSummaryUserPrompt({
      masterSummary,
      jobTitle: match.job.title,
      jobDescription: match.job.description ?? "",
      matchedSkills,
      gapSkills,
    }),
    schema: SummaryRewriteOutputSchema,
    maxTokens: 2048,
  });
  // Verify summary against the FULL master corpus (not just old summary).
  const masterBulletsFlat = (parsed.workHistory ?? []).flatMap((r) => r.bullets ?? []);
  let finalSummary = summaryResult.summary;
  {
    const sv = await verifySummary(cerebras, {
      masterSummary,
      masterSkills: userSkills,
      masterBulletsFlat,
      tailoredSummary: finalSummary,
    });
    if (!sv.ok) {
      logger.warn(
        { matchId: input.matchId, violations: sv.reasons },
        "tailor.summary_drift_flagged_retrying",
      );
      try {
        const retry = await cerebras.generate({
          system: __internals.SUMMARY_SYSTEM_PROMPT,
          user: `${__internals.buildSummaryUserPrompt({
            masterSummary,
            jobTitle: match.job.title,
            jobDescription: match.job.description ?? "",
            matchedSkills,
            gapSkills,
          })}

PREVIOUS ATTEMPT WAS REJECTED FOR THESE VIOLATIONS:
${sv.reasons.map((r) => "- " + r).join("\n")}
Remove every violation. Do not introduce new ones.`,
          schema: SummaryRewriteOutputSchema,
          maxTokens: 2048,
        });
        const sv2 = await verifySummary(cerebras, {
          masterSummary,
          masterSkills: userSkills,
          masterBulletsFlat,
          tailoredSummary: retry.summary,
        });
        if (sv2.ok) {
          finalSummary = retry.summary;
          logger.info({ matchId: input.matchId }, "tailor.summary_passed_on_retry");
        } else {
          finalSummary = masterSummary;
          logger.warn(
            { matchId: input.matchId, violations: sv2.reasons },
            "tailor.summary_retry_failed_fallback",
          );
        }
      } catch {
        finalSummary = masterSummary;
      }
    } else {
      logger.info({ matchId: input.matchId }, "tailor.summary_verified");
    }
  }
  if (finalSummary !== masterSummary) {
    ledger.push({
      move: "summary_rewrite",
      skillClosed: null,
      evidence: null,
      targetRoleIndex: null,
      targetBulletIndex: null,
      parentMasterBulletId: null,
      beforeText: masterSummary || null,
      afterText: finalSummary,
      reverted: false,
      conversation: null,
    });
  }

  // ---------- Step 2: per-role bullet rephrase (batched) ----------
  const tailoredRoles = await Promise.all(
    (parsed.workHistory ?? []).map(async (role, roleIndex) => {
      const masterBullets = role.bullets ?? [];

      // Empty role -> nothing to rephrase. Mirror verbatim.
      if (masterBullets.length === 0) {
        return {
          title: role.title ?? null,
          company: role.company ?? null,
          startDate: role.startDate ?? null,
          endDate: role.endDate ?? null,
          bullets: [],
        };
      }

      try {
        const rephraseResult = await cerebras.generate({
          system: __internals.BULLET_REPHRASE_SYSTEM_PROMPT,
          user: __internals.buildBulletRephraseUserPrompt({
            roleTitle: role.title ?? null,
            roleCompany: role.company ?? null,
            masterBullets,
            jobTitle: match.job.title,
            jobDescription: match.job.description ?? "",
            matchedSkills,
          }),
          schema: BulletRephraseOutputSchema,
          maxTokens: 2048,
        });

        // Strict length check: model must return one rephrase per master bullet.
        if (rephraseResult.bullets.length !== masterBullets.length) {
          throw new Error(
            `Length mismatch: master=${masterBullets.length}, model=${rephraseResult.bullets.length}`,
          );
        }

        // Build tailored bullets in master-order with verify -> retry -> fallback.
        // Quality target: fallback should be the worst-worst case (<5% of bullets).
        // Batch verify: ONE LLM call for all of this role's pairs.
        const pairs = masterBullets.map((masterText, masterIdx) => {
          const item = rephraseResult.bullets.find((b) => b.parentIndex === masterIdx);
          if (!item) {
            throw new Error(`Model missing rephrase for parentIndex=${masterIdx}`);
          }
          return { parentText: masterText, childText: item.bulletText };
        });
        const verdicts = await verifyBulletsBatch(cerebras, pairs);

        const tailoredBullets = [];
        for (let masterIdx = 0; masterIdx < masterBullets.length; masterIdx++) {
          const id = masterBulletId(roleIndex, masterIdx);
          const masterText = masterBullets[masterIdx];
          let finalText = pairs[masterIdx].childText;
          let verifyState = "passed";

          const v1 = verdicts[masterIdx];
          if (!v1.ok) {
            // One retry: feed the violations back, ask for a corrected rephrase.
            logger.warn(
              { matchId: input.matchId, roleIndex, masterIdx, violations: v1.reasons },
              "tailor.bullet_drift_flagged_retrying",
            );
            try {
              const retry = await cerebras.generate({
                system: __internals.BULLET_REPHRASE_SYSTEM_PROMPT,
                user: `${__internals.buildBulletRephraseUserPrompt({
                  roleTitle: role.title ?? null,
                  roleCompany: role.company ?? null,
                  masterBullets: [masterText],
                  jobTitle: match.job.title,
                  jobDescription: match.job.description ?? "",
                  matchedSkills,
                })}

PREVIOUS ATTEMPT WAS REJECTED FOR THESE VIOLATIONS:
${v1.reasons.map((r) => "- " + r).join("\n")}
Remove every violation. Do not introduce new ones.`,
                schema: BulletRephraseOutputSchema,
                maxTokens: 2048,
              });
              const retryText = retry.bullets[0]?.bulletText;
              if (retryText) {
                const v2 = await verifyBullet(cerebras, masterText, retryText);
                if (v2.ok) {
                  finalText = retryText;
                  verifyState = "passed_on_retry";
                } else {
                  finalText = masterText;
                  verifyState = "fallback_to_master";
                  logger.warn(
                    { matchId: input.matchId, roleIndex, masterIdx, violations: v2.reasons },
                    "tailor.bullet_retry_failed_fallback",
                  );
                }
              } else {
                finalText = masterText;
                verifyState = "fallback_to_master";
              }
            } catch {
              finalText = masterText;
              verifyState = "fallback_to_master";
            }
          }

          // Only ledger a change if the final text differs from master.
          if (finalText !== masterText) {
            ledger.push({
              move: "bullet_rephrase",
              skillClosed: null,
              evidence: null,
              targetRoleIndex: roleIndex,
              targetBulletIndex: masterIdx,
              parentMasterBulletId: id,
              beforeText: masterText,
              afterText: finalText,
              reverted: false,
              conversation: null,
            });
          }
          logger.info(
            { matchId: input.matchId, roleIndex, masterIdx, verifyState },
            "tailor.bullet_verified",
          );
          tailoredBullets.push({ id, text: finalText, parentMasterBulletId: id });
        }

        return {
          title: role.title ?? null,
          company: role.company ?? null,
          startDate: role.startDate ?? null,
          endDate: role.endDate ?? null,
          bullets: tailoredBullets,
        };
      } catch (err) {
        // Per-role fallback: copy master bullets verbatim. Honest — content is true,
        // just not job-targeted. Ledger records the fallback for audit.
        logger.warn(
          { matchId: input.matchId, roleIndex, err: (err as Error).message },
          "tailor.role_rephrase_failed_fallback_to_master",
        );
        const fallbackBullets = masterBullets.map((text, masterIdx) => {
          const id = masterBulletId(roleIndex, masterIdx);
          // No ledger entry for fallback — these aren't changes. They're untouched master.
          return { id, text, parentMasterBulletId: id };
        });
        return {
          title: role.title ?? null,
          company: role.company ?? null,
          startDate: role.startDate ?? null,
          endDate: role.endDate ?? null,
          bullets: fallbackBullets,
        };
      }
    }),
  );

  // ---------- Step 3: assemble tailoredJson ----------
  // Skills order: matched skills first (job-relevance signal), then the rest
  // of the user's skills in original order. Driven by code, not LLM.
  const matchedSet = new Set(matchedSkills.map((s) => s.toLowerCase()));
  const remainingUserSkills = userSkills.filter((s) => !matchedSet.has(s.toLowerCase()));
  const orderedSkills = [...matchedSkills, ...remainingUserSkills];

  const tailoredJson: TailoredJson = {
    summary: finalSummary,
    skills: orderedSkills,
    workHistory: tailoredRoles,
  };

  // Validate against the canonical schema before writing.
  const validated = TailoredJsonSchema.parse(tailoredJson);

  // ---------- Step 4: write to DB ----------
  const created = await prisma.tailoredResume.create({
    data: {
      matchId: input.matchId,
      userId: input.userId,
      masterResumeId: master.id,
      jobId: match.jobId,
      tailoredJson: validated,
      changeLedger: ledger,
      status: "generated",
      generationVersion: TAILORING_VERSION,
      tokensUsed: totalTokens || null,
    },
  });

  logger.info(
    {
      tailoredResumeId: created.id,
      matchId: input.matchId,
      roles: tailoredRoles.length,
      ledgerEntries: ledger.length,
    },
    "tailor.generated",
  );

  return {
    tailoredResumeId: created.id,
    tailoredJson: validated,
    changeLedger: ledger,
    status: "generated",
    tokensUsed: totalTokens || null,
    generationVersion: TAILORING_VERSION,
    resumed: false,
  };
}

// ============================================================
// GAP-CLOSING
// ============================================================
// User confirms a gap skill is true + supplies evidence. AI classifies
// new_bullet vs augment_bullet and writes the line. Verified against the
// evidence + parent. On verified success:
//   1. tailoredJson updated, ledger appended
//   2. skill written back to master parsedJson (confirm-time, locked decision)
// No fallback path — if generation can't ground the evidence after one
// retry, we error and the UI asks the user to rephrase their evidence.

export async function generateBulletFromEvidence(
  input: GapClosingInput,
): Promise<GapClosingResult> {
  const row = await prisma.tailoredResume.findUnique({
    where: { matchId: input.matchId },
  });
  if (!row) throw new Error("No tailored resume for this match — generate first");
  if (row.userId !== input.userId) throw new Error("Not your tailored resume");

  const master = await prisma.resumeVersion.findUnique({
    where: { id: row.masterResumeId },
  });
  if (!master) throw new Error("Master resume not found");
  const parsed = readMasterParsed(master.parsedJson);
  const workHistory = (parsed.workHistory ?? []).map((r) => ({
    title: r.title ?? null,
    company: r.company ?? null,
    bullets: r.bullets ?? [],
  }));

  const cerebras = new CerebrasProvider();

  // Generate with one retry on verification failure.
  let output: z.infer<typeof GapClosingOutputSchema> | null = null;
  let verifyReasons: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const retryNote =
      attempt > 0
        ? `\n\nPREVIOUS ATTEMPT WAS REJECTED FOR THESE VIOLATIONS:\n${verifyReasons.map((r) => "- " + r).join("\n")}\nRemove every violation. Use ONLY what the evidence states.`
        : "";
    const candidate = await cerebras.generate({
      system: __internals.GAP_CLOSING_SYSTEM_PROMPT,
      user:
        __internals.buildGapClosingUserPrompt({
          skill: input.skill,
          evidence: input.evidence,
          workHistory,
        }) + retryNote,
      schema: GapClosingOutputSchema,
      maxTokens: 2048,
    });

    // Structural validation: indices must point at real content.
    const role = workHistory[candidate.parentRoleIndex];
    if (!role) {
      verifyReasons = [`parentRoleIndex ${candidate.parentRoleIndex} does not exist`];
      continue;
    }
    if (candidate.move === "augment_bullet") {
      if (
        candidate.parentBulletIndex === null ||
        role.bullets[candidate.parentBulletIndex] === undefined
      ) {
        verifyReasons = [`augment_bullet with invalid parentBulletIndex`];
        continue;
      }
    }
    if (candidate.move === "new_bullet" && candidate.parentBulletIndex !== null) {
      verifyReasons = [`new_bullet must have null parentBulletIndex`];
      continue;
    }

    // Integrity verification: truth source = evidence (+ parent bullet for augment).
    const truthSource =
      candidate.move === "augment_bullet"
        ? `${input.evidence}\n${role.bullets[candidate.parentBulletIndex!]}`
        : input.evidence;
    const v = await verifyBullet(cerebras, truthSource, candidate.bulletText);
    if (v.ok) {
      output = candidate;
      break;
    }
    verifyReasons = v.reasons;
    logger.warn(
      { matchId: input.matchId, skill: input.skill, attempt, violations: v.reasons },
      "tailor.gap_closing_drift_flagged",
    );
  }

  if (!output) {
    throw new Error(
      `Couldn't ground a bullet in your evidence (violations: ${verifyReasons.join("; ")}). Try rephrasing your evidence with more specifics.`,
    );
  }

  // Apply to tailoredJson.
  const tailoredJson = row.tailoredJson as TailoredJson;
  const targetRole = tailoredJson.workHistory[output.parentRoleIndex];
  if (!targetRole) throw new Error("Target role missing from tailoredJson");

  let targetBulletIndex: number | null;
  let beforeText: string | null;
  if (output.move === "augment_bullet") {
    targetBulletIndex = output.parentBulletIndex!;
    beforeText = targetRole.bullets[targetBulletIndex]?.text ?? null;
    targetRole.bullets[targetBulletIndex] = {
      ...targetRole.bullets[targetBulletIndex],
      text: output.bulletText,
    };
  } else {
    beforeText = null;
    targetRole.bullets.push({
      id: `n:${Date.now()}`,
      text: output.bulletText,
      parentMasterBulletId: null,
    });
    targetBulletIndex = targetRole.bullets.length - 1;
  }

  const newLedgerEntry: ChangeLedgerRecord = {
    move: output.move,
    skillClosed: input.skill,
    evidence: input.evidence,
    targetRoleIndex: output.parentRoleIndex,
    targetBulletIndex,
    parentMasterBulletId:
      output.move === "augment_bullet"
        ? masterBulletId(output.parentRoleIndex, output.parentBulletIndex!)
        : null,
    beforeText,
    afterText: output.bulletText,
    reverted: false,
    conversation: input.conversation ?? null,
  };
  const ledger = [...(row.changeLedger as ChangeLedgerRecord[]), newLedgerEntry];

  // Write-back: skill flows into master parsedJson at confirm-time (locked).
  const masterSkills = parsed.skills ?? [];
  const skillExists = masterSkills.some((s) => s.toLowerCase() === input.skill.toLowerCase());
  if (!skillExists) {
    await prisma.resumeVersion.update({
      where: { id: master.id },
      data: {
        parsedJson: { ...(master.parsedJson as object), skills: [...masterSkills, input.skill] },
      },
    });
    logger.info(
      { masterResumeId: master.id, skill: input.skill },
      "tailor.skill_written_back_to_master",
    );
  }

  // Persist tailoredJson + ledger.
  await prisma.tailoredResume.update({
    where: { id: row.id },
    data: { tailoredJson, changeLedger: ledger },
  });

  logger.info(
    { matchId: input.matchId, skill: input.skill, move: output.move },
    "tailor.gap_closed",
  );

  return {
    move: output.move,
    targetRoleIndex: output.parentRoleIndex,
    targetBulletIndex,
    bulletText: output.bulletText,
    tailoredJson,
    newLedgerEntry,
  };
}

// ============================================================
// EVIDENCE INTERVIEWER (2G.2 amendment)
// ============================================================
// Conversational gap-closing. One call per turn: decide whether the
// accumulated evidence is enough to ground a strong bullet, ask ONE
// targeted follow-up, or refuse. Never leads the witness — open
// questions only (suggesting answers would feed fabrication).

export const InterviewTurnSchema = z.object({
  action: z.enum(["ask", "generate", "refuse"]),
  question: z.string().nullable(),
});
export type InterviewTurn = z.infer<typeof InterviewTurnSchema>;

export type ConversationMessage = { role: "ai" | "user"; text: string };

const INTERVIEWER_SYSTEM_PROMPT = `\
You are gathering evidence from a job candidate about ONE specific skill, so a
truthful resume bullet can be written from their answers. You ask short, open
questions. You NEVER suggest answers, examples, or scenarios — suggesting
("did you deploy it in production?") would put words in their mouth and lead
to fabrication. Open questions only ("what did you do with it?").

Decide each turn:
- "ask": evidence so far is too thin to ground a strong bullet. Ask ONE short
  targeted follow-up. Good follow-ups dig for: where they used it, what they
  actually did, rough duration or scope. One question at a time.
- "generate": the answers contain enough concrete detail (a place + what they
  did + some scope/duration) to write a grounded bullet. Stop asking.
- "refuse": the candidate's answers show they do NOT actually have this skill
  ("I don't know it", "never used it") or are entirely off-topic.

You may ask at most 3 questions total across the conversation. If the
conversation already contains 3 AI questions, you MUST choose "generate"
(if anything groundable exists) or "refuse" (if nothing does).

Output strict JSON: { "action": "ask"|"generate"|"refuse", "question": "<text or null>" }
question must be null unless action is "ask".`;

function buildInterviewerUserPrompt(skill: string, conversation: ConversationMessage[]): string {
  const thread =
    conversation.length === 0
      ? "(conversation has not started — ask the opening question)"
      : conversation
          .map((m) => `${m.role === "ai" ? "YOU ASKED" : "CANDIDATE"}: ${m.text}`)
          .join("\n");
  const aiQuestionCount = conversation.filter((m) => m.role === "ai").length;
  return `\
SKILL BEING DISCUSSED: ${skill}

CONVERSATION SO FAR:
${thread}

AI QUESTIONS ASKED SO FAR: ${aiQuestionCount} of 3 max.

Decide: ask / generate / refuse. Output JSON.`;
}

export async function interviewForEvidence(input: {
  skill: string;
  conversation: ConversationMessage[];
}): Promise<InterviewTurn> {
  const cerebras = new CerebrasProvider();
  const result = await cerebras.generate({
    system: INTERVIEWER_SYSTEM_PROMPT,
    user: buildInterviewerUserPrompt(input.skill, input.conversation),
    schema: InterviewTurnSchema,
    maxTokens: 1024,
  });
  // Enforce the cap in code too — never trust the model alone.
  const aiQuestions = input.conversation.filter((m) => m.role === "ai").length;
  if (result.action === "ask" && aiQuestions >= 3) {
    return { action: "generate", question: null };
  }
  return result;
}

// Concatenate the user's answers into the evidence string for
// generateBulletFromEvidence. The full thread is stored in the ledger.
export function conversationToEvidence(conversation: ConversationMessage[]): string {
  return conversation
    .filter((m) => m.role === "user")
    .map((m) => m.text)
    .join(" ");
}
