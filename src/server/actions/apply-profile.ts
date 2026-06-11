"use server";

import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { applyProfileSchema } from "@/shared/schemas/apply-profile";

type ActionResult = { error: string } | { success: true };

/**
 * Save the current user's standing application answers (ApplyProfile).
 * Upsert: the row is created lazily on first save, never by trigger.
 * NEVER triggers the matcher — apply answers are not match inputs.
 */
export async function saveApplyProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = applyProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { error: "Not authenticated" };
  }

  try {
    const appUser = await prisma.user.findUnique({ where: { authId: authUser.id } });
    if (!appUser) {
      logger.error({ authId: authUser.id }, "apply_profile.save.user_not_found");
      return { error: "Couldn't find your account. Try signing out and back in." };
    }

    await prisma.applyProfile.upsert({
      where: { userId: appUser.id },
      create: { userId: appUser.id, ...parsed.data },
      update: parsed.data,
    });

    logger.info(
      {
        userId: appUser.id,
        answered: Object.values(parsed.data).filter((v) => v !== null).length,
      },
      "apply_profile.save.completed",
    );
    return { success: true };
  } catch (err) {
    logger.error({ err }, "apply_profile.save.exception");
    return { error: "Something went wrong saving your application answers." };
  }
}
