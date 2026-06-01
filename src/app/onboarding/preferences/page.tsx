import { redirect } from "next/navigation";
import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { PreferencesClientForm } from "./_components/preferences-client-form";

export const dynamic = "force-dynamic";

export default async function OnboardingPreferencesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const appUser = await prisma.user.findUnique({
    where: { authId: authUser.id },
    include: {
      resumes: { where: { isMaster: true }, take: 1, select: { parsedJson: true } },
    },
  });
  if (!appUser) {
    logger.error({ authId: authUser.id }, "onboarding_prefs.user_not_found");
    redirect("/login");
  }

  // Surface resume-extracted skills as suggested chips above the Keywords input.
  // Same defensive narrowing pattern as settings page.
  type ParsedResume = { skills?: unknown } | null;
  const parsed = (appUser.resumes[0]?.parsedJson as ParsedResume) ?? null;
  const suggestedSkills: string[] = Array.isArray(parsed?.skills)
    ? Array.from(
        new Set(
          (parsed.skills as unknown[])
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .map((s) => s.trim()),
        ),
      ).slice(0, 15)
    : [];

  return <PreferencesClientForm suggestedKeywords={suggestedSkills} />;
}
