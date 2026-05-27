"use server";

import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { matchJobsForUser, MATCH_VERSION } from "@/server/services/matcher/match";

type ActionResult = { error: string } | { success: true };
type TriggerResult = { error: string } | { success: true; matchCount: number };

/**
 * Resolve the current auth user → app user, or return null if unauthenticated.
 * Mirrors the pattern in preferences.ts / resume.ts.
 */
async function getCurrentAppUser(): Promise<{ id: string } | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;
  return prisma.user.findUnique({ where: { authId: authUser.id }, select: { id: true } });
}

/**
 * Mark a match as viewed. Idempotent — re-calling on an already-viewed match is a no-op.
 * Verifies ownership before any mutation.
 */
export async function markMatchViewedAction(matchId: string): Promise<ActionResult> {
  const appUser = await getCurrentAppUser();
  if (!appUser) return { error: "Not authenticated" };

  const match = await prisma.userJobMatch.findFirst({
    where: { id: matchId, userId: appUser.id },
    select: { id: true, viewedAt: true, status: true },
  });
  if (!match) return { error: "Match not found" };

  if (match.viewedAt) return { success: true }; // already viewed, no-op

  await prisma.userJobMatch.update({
    where: { id: matchId },
    data: { status: "viewed", viewedAt: new Date() },
  });
  logger.info({ userId: appUser.id, matchId }, "match.viewed");
  return { success: true };
}

/**
 * Dismiss a match. Sets both status='dismissed' and dismissed=true.
 * dismissed is the hard boolean used for filtering ("don't show this anymore");
 * status tracks the workflow state.
 */
export async function dismissMatchAction(matchId: string): Promise<ActionResult> {
  const appUser = await getCurrentAppUser();
  if (!appUser) return { error: "Not authenticated" };

  const match = await prisma.userJobMatch.findFirst({
    where: { id: matchId, userId: appUser.id },
    select: { id: true },
  });
  if (!match) return { error: "Match not found" };

  await prisma.userJobMatch.update({
    where: { id: matchId },
    data: { status: "dismissed", dismissed: true, dismissedAt: new Date() },
  });
  logger.info({ userId: appUser.id, matchId }, "match.dismissed");
  return { success: true };
}

/**
 * Record that the user applied to this job. Sets status='applied'.
 * The full Application row (resume version, notes, etc.) is a Phase 2H+ concern;
 * for now this is just a status flag.
 */
export async function markMatchAppliedAction(matchId: string): Promise<ActionResult> {
  const appUser = await getCurrentAppUser();
  if (!appUser) return { error: "Not authenticated" };

  const match = await prisma.userJobMatch.findFirst({
    where: { id: matchId, userId: appUser.id },
    select: { id: true },
  });
  if (!match) return { error: "Match not found" };

  await prisma.userJobMatch.update({
    where: { id: matchId },
    data: { status: "applied" },
  });
  logger.info({ userId: appUser.id, matchId }, "match.applied");
  return { success: true };
}

/**
 * Triggers the matcher synchronously for the current user.
 * Called from the dashboard empty state when stored matches = 0.
 * Returns immediately on completion (typically <3s for current data sizes).
 *
 * Per CONTEXT.md decision 3B: only triggered when user has 0 stored matches.
 * Dashboard page is responsible for that check; this action is the trigger.
 */
export async function triggerMatcherAction(): Promise<TriggerResult> {
  const appUser = await getCurrentAppUser();
  if (!appUser) return { error: "Not authenticated" };

  try {
    const summary = await matchJobsForUser({ userId: appUser.id });
    logger.info(
      { userId: appUser.id, upserted: summary.upserted, version: MATCH_VERSION },
      "match.trigger.complete",
    );
    return { success: true, matchCount: summary.upserted };
  } catch (err) {
    logger.error({ userId: appUser.id, err: (err as Error).message }, "match.trigger.failed");
    return { error: "Couldn't find matches right now. Try refreshing the page." };
  }
}
