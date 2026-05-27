"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { preferencesSchema } from "@/shared/schemas/preferences";

type ActionResult = { error: string } | { success: true };

/**
 * Save the current user's preferences.
 * Reads auth user via Supabase, finds matching public.User, updates UserPreference.
 */
export async function savePreferencesAction(input: unknown): Promise<ActionResult> {
  const parsed = preferencesSchema.safeParse(input);
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
      include: { preferences: true },
    });

    if (!appUser) {
      logger.error({ authId: authUser.id }, "preferences.save.user_not_found");
      return {
        error: "Couldn't find your account. Try signing out and back in.",
      };
    }

    if (!appUser.preferences) {
      logger.error({ userId: appUser.id }, "preferences.save.no_pref_row");
      return { error: "Preferences row missing. Contact support." };
    }

    await prisma.userPreference.update({
      where: { userId: appUser.id },
      data: {
        keywords: parsed.data.keywords,
        excludeKeywords: parsed.data.excludeKeywords,
        locations: parsed.data.locations,
        jobTypes: parsed.data.jobTypes,
        experienceMin: parsed.data.experienceMin,
        experienceMax: parsed.data.experienceMax,
        visaSponsorship: parsed.data.visaSponsorship,
        stemOptOnly: parsed.data.stemOptOnly,
        visaType: parsed.data.visaType,
        workAuthStatus: parsed.data.workAuthStatus,
        salaryMin: parsed.data.salaryMin,
        currentEmployment: parsed.data.currentEmployment,
        targetRoles: parsed.data.targetRoles,
        avoidCompanies: parsed.data.avoidCompanies,
        onboardingComplete: parsed.data.onboardingComplete,
      },
    });

    logger.info(
      {
        userId: appUser.id,
        keywords: parsed.data.keywords.length,
        locations: parsed.data.locations.length,
        visaType: parsed.data.visaType,
        onboardingComplete: parsed.data.onboardingComplete,
      },
      "preferences.save.completed",
    );
  } catch (err) {
    logger.error({ err }, "preferences.save.exception");
    return { error: "Something went wrong saving your preferences." };
  }

  redirect("/dashboard");
}
