// 2H.1 — fill payload for the apply extension.
// Session-gated, ownership-checked. Composes existing pieces:
// fetchGHQuestions + decideAnswers (the lab's exact decision path)
// + profile fill values. PDF via the existing tailored-pdf route.
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { prisma } from "@/server/lib/prisma";
import { logger } from "@/server/lib/logger";
import { fetchGHQuestions } from "@/server/services/apply/gh-job-questions";
import { decideAnswers, type GHAnswerProfile } from "@/apply/gh-questions";

export async function GET(_req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const appUser = await prisma.user.findUnique({
    where: { authId: user.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      country: true,
      applyProfile: true,
    },
  });
  if (!appUser) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { matchId } = await params;
  const match = await prisma.userJobMatch.findFirst({
    where: { id: matchId, userId: appUser.id },
    select: { job: { select: { source: true, companySlug: true, externalId: true } } },
  });
  if (!match) return NextResponse.json({ error: "not found" }, { status: 404 });

  const u = appUser;
  const { job } = match;
  const ap = u.applyProfile;

  let decisions: unknown[] = [];
  if (job.source === "greenhouse" && job.companySlug && job.externalId) {
    const questions = await fetchGHQuestions(job.companySlug, job.externalId);
    const ghProfile: GHAnswerProfile = {
      workAuthorizedUS: ap?.workAuthorizedUS ?? null,
      requiresSponsorship: ap?.requiresSponsorship ?? null,
      previouslyEmployed: ap?.previouslyEmployed ?? null,
      gender: ap?.gender ?? null,
      hispanicLatino: ap?.hispanicLatino ?? null,
      raceEthnicity: ap?.raceEthnicity ?? null,
      veteranStatus: ap?.veteranStatus ?? null,
      disabilityStatus: ap?.disabilityStatus ?? null,
      linkedinUrl: ap?.linkedinUrl ?? null,
      githubUrl: ap?.githubUrl ?? null,
      portfolioUrl: ap?.portfolioUrl ?? null,
      location: null,
    };
    decisions = decideAnswers(questions, ghProfile);
  }

  logger.info({ matchId, decisionCount: decisions.length }, "apply.payload.served");
  return NextResponse.json({
    identity: {
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      country: u.country,
    },
    decisions,
    education: {
      schoolName: ap?.schoolName ?? null,
      degreeLevel: ap?.degreeLevel ?? null,
    },
    pdfUrl: `/api/tailored/${matchId}/pdf`,
  });
}
