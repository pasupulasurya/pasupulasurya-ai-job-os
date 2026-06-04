"use server";

import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { profileSchema } from "@/shared/schemas/profile";

type ActionResult = { error: string } | { success: true };

/**
 * Save the current user's profile info (firstName, lastName, phone).
 * Reads auth user via Supabase, updates the matching public.User.
 * Phone is normalized to E.164 in the Zod schema before reaching here.
 */
export async function saveProfileAction(input: unknown): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
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
    const appUser = await prisma.user.findUnique({
      where: { authId: authUser.id },
      select: { id: true },
    });

    if (!appUser) {
      logger.error({ authId: authUser.id }, "profile.save.user_not_found");
      return {
        error: "Couldn't find your account. Try signing out and back in.",
      };
    }

    await prisma.user.update({
      where: { id: appUser.id },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        country: parsed.data.country,
        phone: parsed.data.phone,
      },
    });

    logger.info(
      { userId: appUser.id, hasPhone: parsed.data.phone !== null, country: parsed.data.country },
      "profile.save.success",
    );

    return { success: true };
  } catch (err) {
    logger.error({ err: (err as Error).message, authId: authUser.id }, "profile.save.failed");
    return { error: "Couldn't save. Try again in a moment." };
  }
}
