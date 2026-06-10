"use server";

import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { after } from "next/server";
import {
  startTailoring,
  runGenerationIntoLock,
  generateBulletFromEvidence,
  interviewForEvidence,
  conversationToEvidence,
  type TailoringResult,
  type GapClosingResult,
  type ConversationMessage,
  type InterviewTurn,
  type TailoredJson,
  type ChangeLedgerRecord,
} from "@/server/services/ai/tailor";

// Shared auth helper for all tailor actions: resolves the app user or null.
async function getAppUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;
  return prisma.user.findUnique({ where: { authId: authUser.id } });
}

/**
 * Generate (or resume) the tailored resume for a match. Long-running
 * (~60s fresh generation under Cerebras rate limits); the page shows a
 * progress state. Idempotent — re-invocation returns the existing draft.
 */
export type StartTailorActionResult =
  | { error: string }
  | { success: true; kind: "ready" | "in_progress" | "started"; tailoredResumeId: string };

/**
 * Fire-and-poll: creates the generating lock row and schedules generation
 * AFTER the response (next/server after()). Returns instantly. The client
 * polls tailorStatusAction until status leaves "generating".
 */
export async function tailorForMatchAction(matchId: string): Promise<StartTailorActionResult> {
  if (!matchId || typeof matchId !== "string") return { error: "Invalid match id" };
  const appUser = await getAppUser();
  if (!appUser) return { error: "Not authenticated" };

  try {
    const start = await startTailoring({ userId: appUser.id, matchId });
    if (start.kind === "failed") return { error: start.errorMessage };
    if (start.kind === "started") {
      after(() =>
        runGenerationIntoLock({
          userId: appUser.id,
          matchId,
          lockRowId: start.tailoredResumeId,
        }),
      );
    }
    return { success: true, kind: start.kind, tailoredResumeId: start.tailoredResumeId };
  } catch (err) {
    logger.error(
      { userId: appUser.id, matchId, err: (err as Error).message },
      "tailor.action.start_failed",
    );
    return { error: (err as Error).message };
  }
}

export type TailorStatusActionResult =
  | { error: string }
  | {
      success: true;
      status: "generating" | "generated" | "verified" | "saved" | "failed";
      errorMessage: string | null;
      tailoredJson: TailoredJson | null;
      changeLedger: ChangeLedgerRecord[] | null;
    };

/** Light polling read: row status + content once ready. */
export async function tailorStatusAction(matchId: string): Promise<TailorStatusActionResult> {
  if (!matchId) return { error: "Invalid match id" };
  const appUser = await getAppUser();
  if (!appUser) return { error: "Not authenticated" };

  const row = await prisma.tailoredResume.findUnique({ where: { matchId } });
  if (!row || row.userId !== appUser.id) return { error: "Not found" };

  const ready = ["generated", "verified", "saved"].includes(row.status);
  return {
    success: true,
    status: row.status as "generating" | "generated" | "verified" | "saved" | "failed",
    errorMessage: row.errorMessage,
    tailoredJson: ready ? (row.tailoredJson as TailoredJson) : null,
    changeLedger: ready ? (row.changeLedger as ChangeLedgerRecord[]) : null,
  };
}

type InterviewActionResult = { error: string } | { success: true; turn: InterviewTurn };

/**
 * One turn of the evidence interview for a gap skill. The client holds the
 * conversation state and sends the full thread each turn.
 */
export async function interviewTurnAction(
  matchId: string,
  skill: string,
  conversation: ConversationMessage[],
): Promise<InterviewActionResult> {
  if (!matchId || !skill) return { error: "Invalid input" };
  if (!Array.isArray(conversation) || conversation.length > 20)
    return { error: "Invalid conversation" };
  const appUser = await getAppUser();
  if (!appUser) return { error: "Not authenticated" };

  try {
    const turn = await interviewForEvidence({ skill, conversation });
    return { success: true, turn };
  } catch (err) {
    logger.error(
      { userId: appUser.id, matchId, skill, err: (err as Error).message },
      "tailor.action.interview_failed",
    );
    return { error: "Couldn't process that. Try again." };
  }
}

type CloseGapActionResult = { error: string } | { success: true; result: GapClosingResult };

/**
 * Close a gap: the interview reached "generate", convert the thread into
 * evidence and run grounded generation. Writes the verified bullet into
 * tailoredJson, appends the ledger entry (with the conversation), and
 * writes the confirmed skill back to master.
 */
export async function closeGapAction(
  matchId: string,
  skill: string,
  conversation: ConversationMessage[],
): Promise<CloseGapActionResult> {
  if (!matchId || !skill) return { error: "Invalid input" };
  if (!Array.isArray(conversation) || conversation.length === 0)
    return { error: "No evidence provided" };
  const appUser = await getAppUser();
  if (!appUser) return { error: "Not authenticated" };

  const evidence = conversationToEvidence(conversation);
  if (evidence.trim().length < 10)
    return { error: "Not enough detail to write a truthful bullet. Add more specifics." };

  try {
    const result = await generateBulletFromEvidence({
      matchId,
      userId: appUser.id,
      skill,
      evidence,
      conversation,
    });
    return { success: true, result };
  } catch (err) {
    // The engine's "couldn't ground" error is user-facing by design.
    logger.warn(
      { userId: appUser.id, matchId, skill, err: (err as Error).message },
      "tailor.action.close_gap_failed",
    );
    return { error: (err as Error).message };
  }
}

type SaveActionResult = { error: string } | { success: true };

/**
 * Persist the user's curation (bullet selection / skill order / reverts)
 * and mark the tailored resume saved. The client sends the full updated
 * tailoredJson + ledger; ownership is verified server-side.
 */
export async function saveTailoredResumeAction(
  matchId: string,
  tailoredJson: TailoredJson,
  changeLedger: ChangeLedgerRecord[],
): Promise<SaveActionResult> {
  if (!matchId) return { error: "Invalid match id" };
  const appUser = await getAppUser();
  if (!appUser) return { error: "Not authenticated" };

  const row = await prisma.tailoredResume.findUnique({ where: { matchId } });
  if (!row || row.userId !== appUser.id) return { error: "Tailored resume not found" };

  try {
    await prisma.tailoredResume.update({
      where: { id: row.id },
      data: { tailoredJson, changeLedger, status: "saved" },
    });
    logger.info({ userId: appUser.id, matchId }, "tailor.action.saved");
    return { success: true };
  } catch (err) {
    logger.error(
      { userId: appUser.id, matchId, err: (err as Error).message },
      "tailor.action.save_failed",
    );
    return { error: "Couldn't save. Try again." };
  }
}
