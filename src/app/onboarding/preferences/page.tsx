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
  type ParsedResume = { skills?: unknown; currentRole?: unknown; workHistory?: unknown } | null;
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

  // Surface resume-extracted role titles as suggested chips above the target roles input.
  const roleCandidates: string[] = [];
  if (typeof parsed?.currentRole === "string" && parsed.currentRole.trim().length > 0) {
    roleCandidates.push(parsed.currentRole.trim());
  }
  if (Array.isArray(parsed?.workHistory)) {
    for (const role of parsed.workHistory as unknown[]) {
      if (role && typeof role === "object" && "title" in role) {
        const t = (role as { title: unknown }).title;
        if (typeof t === "string" && t.trim().length > 0) roleCandidates.push(t.trim());
      }
    }
  }
  const suggestedTargetRoles: string[] = Array.from(
    new Set(roleCandidates.map((c) => c.toLowerCase())),
  ).slice(0, 5);

  return (
    <PreferencesClientForm
      suggestedKeywords={suggestedSkills}
      suggestedTargetRoles={suggestedTargetRoles}
    />
  );
}
