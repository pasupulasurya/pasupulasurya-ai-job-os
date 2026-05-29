import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { EmptyState } from "./_components/empty-state";
import { MatchList } from "./_components/match-list";

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

  const hasMasterResume = appUser.resumes.length > 0 && appUser.resumes[0].parsedJson !== null;
  const hasPreferences = appUser.preferences !== null && appUser.preferences.keywords.length > 0;

  // Routing state machine — but inline rather than separate routes for today.
  // 2E.3.B will refactor into proper /onboarding/resume + /onboarding/preferences flow.

  if (!hasMasterResume) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-3 text-3xl font-medium tracking-tight">Welcome.</h1>
          <p className="mb-8 text-white/60">
            Upload your resume to begin. We&apos;ll read it once, then match you against new jobs
            every day.
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="mb-4 text-sm text-white/60">
              Resume upload UI ships in the next iteration. For now, please contact the team to seed
              your master resume manually.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (!hasPreferences) {
    redirect("/onboarding/preferences");
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

  const firstName = appUser.name?.split(" ")[0] ?? authUser.email?.split("@")[0] ?? "there";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <p className="mb-1 text-xs tracking-widest text-white/40 uppercase">{today}</p>
          <h1 className="text-3xl font-medium tracking-tight">Good to see you, {firstName}.</h1>
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
