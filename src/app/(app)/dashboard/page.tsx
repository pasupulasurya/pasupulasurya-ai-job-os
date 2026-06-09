import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/server/lib/prisma";
import { getNextOnboardingStep } from "@/server/lib/onboarding";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { EmptyState } from "./_components/empty-state";
import { MatchList } from "./_components/match-list";
import { GreetingDate } from "./_components/greeting-date";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const appUser = await prisma.user.findUnique({
    where: { authId: authUser.id },
    include: {
      preferences: true,
      resumes: { where: { isMaster: true }, take: 1, select: { id: true, parsedJson: true } },
    },
  });

  if (!appUser) {
    logger.error({ authId: authUser.id }, "dashboard.user_not_found");
    redirect("/login");
  }

  // Onboarding gate: redirect to whichever step is incomplete, in strict order.
  // Profile -> Resume -> Preferences. Centralized in @/server/lib/onboarding.
  const nextStep = getNextOnboardingStep({
    firstName: appUser.firstName,
    lastName: appUser.lastName,
    masterResumeExists: appUser.resumes.length > 0 && appUser.resumes[0].parsedJson !== null,
    preferenceKeywordsCount: appUser.preferences?.keywords.length ?? 0,
  });
  if (nextStep !== null) {
    redirect(nextStep);
  }

  const matches = await prisma.userJobMatch.findMany({
    where: { userId: appUser.id, dismissed: false },
    orderBy: { matchScore: "desc" },
    take: 10,
    include: {
      job: {
        select: {
          title: true,
          company: true,
          location: true,
          remote: true,
          sourceUrl: true,
        },
      },
    },
  });

  const firstName = appUser.firstName;

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white md:px-6 md:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 md:mb-10">
          <GreetingDate />
          <h1 className="text-2xl font-medium tracking-tight md:text-3xl">
            Good to see you, {firstName}.
          </h1>
          {matches.length > 0 && (
            <p className="mt-2 text-sm text-white/60">
              {matches.length} {matches.length === 1 ? "match" : "matches"} ready for you today.
            </p>
          )}
        </header>

        {matches.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            <MatchList
              matches={matches.map((m) => ({
                matchId: m.id,
                score: m.matchScore,
                status: m.status,
                reason: m.reason,
                scoreBreakdown: m.scoreBreakdown,
                job: m.job,
              }))}
            />
            <div className="pt-8 text-center">
              <Link
                href="/settings"
                className="text-sm text-white/40 transition-colors hover:text-white/80"
              >
                Adjust preferences →
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
