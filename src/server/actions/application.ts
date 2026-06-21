"use server";

import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { isApplicationStatus } from "@/shared/data/application-status";

type ActionResult = { error: string } | { success: true };

async function getCurrentAppUser(): Promise<{ id: string } | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;
  return prisma.user.findUnique({ where: { authId: authUser.id }, select: { id: true } });
}

/**
 * Move an application to a new status. Ownership-checked.
 * Powers reconsidering a mistaken rejection — any state can move to any other.
 */
export async function updateApplicationStatusAction(
  applicationId: string,
  newStatus: string,
): Promise<ActionResult> {
  const appUser = await getCurrentAppUser();
  if (!appUser) return { error: "Not authenticated" };

  if (!isApplicationStatus(newStatus)) {
    return { error: "Invalid status" };
  }

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: appUser.id },
    select: { id: true },
  });
  if (!application) return { error: "Application not found" };

  await prisma.application.update({
    where: { id: applicationId },
    data: { status: newStatus },
  });

  logger.info({ userId: appUser.id, applicationId, newStatus }, "application.status_changed");
  return { success: true };
}

/**
 * Reverse an apply: the user marked a job applied (or it was auto-marked) but
 * didn't actually apply. Moves it back to the dashboard. Atomically flips the
 * UserJobMatch status back to 'viewed' (they had seen it) and deletes the
 * Application row so it leaves the tracker. Ownership-checked.
 */
export async function unapplyApplicationAction(applicationId: string): Promise<ActionResult> {
  const appUser = await getCurrentAppUser();
  if (!appUser) return { error: "Not authenticated" };

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: appUser.id },
    select: { id: true, jobId: true },
  });
  if (!application) return { error: "Application not found" };

  await prisma.$transaction([
    prisma.userJobMatch.updateMany({
      where: { userId: appUser.id, jobId: application.jobId },
      data: { status: "viewed" },
    }),
    prisma.application.delete({ where: { id: applicationId } }),
  ]);

  logger.info(
    { userId: appUser.id, applicationId, jobId: application.jobId },
    "application.unapplied",
  );
  return { success: true };
}
