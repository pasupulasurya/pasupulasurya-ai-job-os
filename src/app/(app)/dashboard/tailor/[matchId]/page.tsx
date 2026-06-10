import { redirect, notFound } from "next/navigation";
import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { TailorView } from "./_components/tailor-view";
import type { TailoredJson, ChangeLedgerRecord } from "@/server/services/ai/tailor";

export const dynamic = "force-dynamic";

type MasterParsedView = {
  summary?: string | null;
  skills?: string[] | null;
  workHistory?: Array<{
    title?: string | null;
    company?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    bullets?: string[] | null;
  }> | null;
};

export default async function TailorPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const appUser = await prisma.user.findUnique({ where: { authId: authUser.id } });
  if (!appUser) redirect("/login");

  const match = await prisma.userJobMatch.findUnique({
    where: { id: matchId },
    include: {
      job: { select: { title: true, company: true, skills: true } },
      tailoredResume: true,
    },
  });
  if (!match || match.userId !== appUser.id) notFound();

  const master = await prisma.resumeVersion.findFirst({
    where: { userId: appUser.id, isMaster: true },
    select: { parsedJson: true },
  });
  if (!master?.parsedJson) redirect("/onboarding/resume");

  const parsed = master.parsedJson as MasterParsedView;
  const userSkills = (parsed.skills ?? []).map((s) => s.toLowerCase());
  const gapSkills = (match.job.skills ?? []).filter((s) => !userSkills.includes(s.toLowerCase()));

  const existing = match.tailoredResume;

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white md:px-6 md:py-12">
      <div className="mx-auto max-w-6xl">
        <TailorView
          matchId={matchId}
          jobTitle={match.job.title}
          jobCompany={match.job.company}
          matchScore={match.matchScore}
          gapSkills={gapSkills}
          masterParsed={{
            summary: parsed.summary ?? "",
            skills: parsed.skills ?? [],
            workHistory: (parsed.workHistory ?? []).map((r) => ({
              title: r.title ?? null,
              company: r.company ?? null,
              startDate: r.startDate ?? null,
              endDate: r.endDate ?? null,
              bullets: r.bullets ?? [],
            })),
          }}
          initialTailored={
            existing && ["generated", "verified", "saved"].includes(existing.status)
              ? {
                  tailoredJson: existing.tailoredJson as TailoredJson,
                  changeLedger: existing.changeLedger as ChangeLedgerRecord[],
                  status: existing.status as "generated" | "verified" | "saved",
                }
              : null
          }
          initialGenerating={existing?.status === "generating"}
          initialError={
            existing?.status === "failed"
              ? (existing.errorMessage ?? "Generation failed. Try again.")
              : null
          }
        />
      </div>
    </main>
  );
}
