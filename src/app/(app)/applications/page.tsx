import { redirect } from "next/navigation";
import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { ApplicationsList } from "./_components/applications-list";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const appUser = await prisma.user.findUnique({
    where: { authId: authUser.id },
    select: { id: true },
  });
  if (!appUser) redirect("/login");

  const applications = await prisma.application.findMany({
    where: { userId: appUser.id, archivedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      status: true,
      appliedAt: true,
      job: { select: { title: true, company: true, location: true, sourceUrl: true } },
    },
  });

  const dismissedMatches = await prisma.userJobMatch.findMany({
    where: { userId: appUser.id, dismissed: true },
    orderBy: { dismissedAt: "desc" },
    select: {
      id: true,
      matchScore: true,
      job: { select: { title: true, company: true, location: true, sourceUrl: true } },
    },
  });

  const dismissed = dismissedMatches.map((m) => ({
    id: m.id,
    score: Math.round(m.matchScore),
    title: m.job.title,
    company: m.job.company,
    location: m.job.location,
    sourceUrl: m.job.sourceUrl,
  }));

  const items = applications.map((a) => ({
    id: a.id,
    status: a.status,
    appliedAt: a.appliedAt?.toISOString() ?? null,
    title: a.job.title,
    company: a.job.company,
    location: a.job.location,
    sourceUrl: a.job.sourceUrl,
  }));

  return <ApplicationsList items={items} dismissed={dismissed} />;
}
