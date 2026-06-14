import { redirect } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { prisma } from "@/server/lib/prisma";
import { getNextOnboardingStep } from "@/server/lib/onboarding";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { EmptyState } from "./_components/empty-state";
import { MatchList } from "./_components/match-list";
import { FilterHeader } from "./_components/filter-header";
import { GreetingDate } from "./_components/greeting-date";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

function cutoffDate(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

const filterSchema = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
  sort: z.enum(["score", "newest", "company"]).catch("score"),
  minScore: z.coerce.number().min(0).max(100).optional().catch(undefined),
  postedWithin: z.coerce.number().int().positive().optional().catch(undefined),
  remote: z.enum(["true", "false"]).optional().catch(undefined),
  company: z.string().trim().min(1).optional().catch(undefined),
  location: z.string().trim().min(1).optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(1),
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = filterSchema.parse(await searchParams);

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

  const nextStep = getNextOnboardingStep({
    firstName: appUser.firstName,
    lastName: appUser.lastName,
    masterResumeExists: appUser.resumes.length > 0 && appUser.resumes[0].parsedJson !== null,
    preferenceKeywordsCount: appUser.preferences?.keywords.length ?? 0,
  });
  if (nextStep !== null) {
    redirect(nextStep);
  }

  const postedCutoff = sp.postedWithin ? cutoffDate(sp.postedWithin) : null;

  const jobWhere = {
    ...(sp.remote === "true" ? { remote: true } : {}),
    ...(sp.remote === "false" ? { remote: false } : {}),
    ...(sp.company ? { company: sp.company } : {}),
    ...(sp.location ? { location: { contains: sp.location, mode: "insensitive" as const } } : {}),
    ...(postedCutoff ? { OR: [{ postedAt: { gte: postedCutoff } }, { postedAt: null }] } : {}),
    ...(sp.q
      ? {
          OR: [
            { title: { contains: sp.q, mode: "insensitive" as const } },
            { company: { contains: sp.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const matchWhere = {
    userId: appUser.id,
    dismissed: false,
    ...(sp.minScore !== undefined ? { matchScore: { gte: sp.minScore } } : {}),
    ...(Object.keys(jobWhere).length > 0 ? { job: jobWhere } : {}),
  };

  const orderBy =
    sp.sort === "newest"
      ? { job: { postedAt: "desc" as const } }
      : sp.sort === "company"
        ? { job: { company: "asc" as const } }
        : { matchScore: "desc" as const };

  const [totalCount, matches, companyRows] = await Promise.all([
    prisma.userJobMatch.count({ where: matchWhere }),
    prisma.userJobMatch.findMany({
      where: matchWhere,
      orderBy,
      skip: (sp.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
        tailoredResume: { select: { status: true } },
      },
    }),
    prisma.userJobMatch.findMany({
      where: { userId: appUser.id, dismissed: false },
      select: { job: { select: { company: true } } },
      distinct: ["jobId"],
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const companies = Array.from(
    new Set(companyRows.map((r) => r.job.company).filter(Boolean)),
  ).sort();

  const hasFilters =
    sp.q !== undefined ||
    sp.minScore !== undefined ||
    sp.postedWithin !== undefined ||
    sp.remote !== undefined ||
    sp.company !== undefined ||
    sp.location !== undefined;

  const pageHref = (n: number) => {
    const qp = new URLSearchParams();
    if (sp.q) qp.set("q", sp.q);
    if (sp.sort !== "score") qp.set("sort", sp.sort);
    if (sp.minScore !== undefined) qp.set("minScore", String(sp.minScore));
    if (sp.postedWithin !== undefined) qp.set("postedWithin", String(sp.postedWithin));
    if (sp.remote !== undefined) qp.set("remote", sp.remote);
    if (sp.company) qp.set("company", sp.company);
    if (sp.location) qp.set("location", sp.location);
    if (n > 1) qp.set("page", String(n));
    const qs = qp.toString();
    return qs ? `/dashboard?${qs}` : "/dashboard";
  };

  const firstName = appUser.firstName;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-10 border-b border-white/[0.07] bg-black/75 backdrop-blur-xl">
        <div className="mx-auto max-w-[1080px] px-6 py-5 md:px-12 md:py-6">
          <div className="mb-5 flex items-baseline justify-between gap-5">
            <div>
              <GreetingDate />
              <h1 className="text-2xl font-semibold tracking-tight md:text-[26px]">
                Good to see you, {firstName}.
              </h1>
            </div>
            <span className="shrink-0 text-sm text-white/40">
              {totalCount} {totalCount === 1 ? "match" : "matches"}
            </span>
          </div>
          <FilterHeader companies={companies} />
        </div>
      </div>

      <div className="mx-auto max-w-[1080px] px-6 py-8 md:px-12 md:py-8">
        {totalCount === 0 ? (
          hasFilters ? (
            <p className="py-16 text-center text-sm text-white/40">
              No matches with these filters.{" "}
              <Link href="/dashboard" className="text-[#0A84FF] hover:underline">
                Clear filters
              </Link>
            </p>
          ) : (
            <EmptyState />
          )
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
                hasTailoredResume: ["generated", "verified", "saved"].includes(
                  m.tailoredResume?.status ?? "",
                ),
              }))}
            />
            {totalPages > 1 && (
              <nav className="flex items-center justify-center gap-1 pt-6" aria-label="Pagination">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <Link
                    key={n}
                    href={pageHref(n)}
                    aria-current={n === sp.page ? "page" : undefined}
                    className={
                      n === sp.page
                        ? "min-w-9 rounded-lg bg-[#0A84FF] px-3 py-1.5 text-center text-sm font-medium text-white"
                        : "min-w-9 rounded-lg border border-white/15 px-3 py-1.5 text-center text-sm text-white/60 transition-colors hover:border-white/30 hover:text-white"
                    }
                  >
                    {n}
                  </Link>
                ))}
              </nav>
            )}
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
