import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { SettingsSection } from "../settings/_components/settings-section";
import { ApplyProfileForm } from "./_components/apply-profile-form";
import type { ApplyProfileInput } from "@/shared/schemas/apply-profile";

export default async function ApplyProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const appUser = await prisma.user.findUnique({
    where: { authId: authUser.id },
    include: {
      applyProfile: true,
      resumes: { where: { isMaster: true }, select: { parsedJson: true }, take: 1 },
    },
  });
  if (!appUser) redirect("/login");

  const p = appUser.applyProfile;
  const initial: ApplyProfileInput = {
    workAuthorizedUS: p?.workAuthorizedUS ?? null,
    requiresSponsorship: p?.requiresSponsorship ?? null,
    over18: p?.over18 ?? null,
    degreeLevel: (p?.degreeLevel ?? null) as ApplyProfileInput["degreeLevel"],
    schoolName: p?.schoolName ?? null,
    graduationYear: p?.graduationYear ?? null,
    gender: (p?.gender ?? null) as ApplyProfileInput["gender"],
    hispanicLatino: (p?.hispanicLatino ?? null) as ApplyProfileInput["hispanicLatino"],
    raceEthnicity: (p?.raceEthnicity ?? null) as ApplyProfileInput["raceEthnicity"],
    veteranStatus: (p?.veteranStatus ?? null) as ApplyProfileInput["veteranStatus"],
    disabilityStatus: (p?.disabilityStatus ?? null) as ApplyProfileInput["disabilityStatus"],
    linkedinUrl: p?.linkedinUrl ?? null,
    githubUrl: p?.githubUrl ?? null,
    portfolioUrl: p?.portfolioUrl ?? null,
    salaryExpectation: p?.salaryExpectation ?? null,
    earliestStartDate: p?.earliestStartDate ?? null,
    willingToRelocate: p?.willingToRelocate ?? null,
    previouslyEmployed: p?.previouslyEmployed ?? null,
    referredByEmployee: p?.referredByEmployee ?? null,
    howDidYouHear: p?.howDidYouHear ?? null,
  };

  const parsed = (appUser.resumes[0]?.parsedJson ?? null) as {
    education?: Array<{ school?: string | null }> | null;
    links?: { linkedin?: string | null; github?: string | null; website?: string | null } | null;
  } | null;
  const suggestedSchool = parsed?.education?.[0]?.school ?? null;
  const suggestedLinks = {
    linkedin: parsed?.links?.linkedin ?? null,
    github: parsed?.links?.github ?? null,
    portfolio: parsed?.links?.website ?? null,
  };

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-text-primary text-xl font-semibold">Apply profile</h1>
        <p className="text-text-tertiary text-sm">
          Standing answers to the standard questions job applications ask. Unanswered questions are
          left for you on each form — nothing is ever guessed.
        </p>
      </header>
      <SettingsSection
        title="Identity & contact"
        description="Used on applications exactly as set in Settings."
      >
        <div className="bg-card border-border rounded-md border p-5 text-sm">
          <div className="text-text-primary">
            {[appUser.firstName, appUser.lastName].filter(Boolean).join(" ") || "—"}
          </div>
          <div className="text-text-secondary mt-1">{appUser.email}</div>
          <div className="text-text-secondary">{appUser.phone ?? "No phone set"}</div>
          <Link href="/settings" className="text-accent mt-3 inline-block text-xs">
            Edit in Settings
          </Link>
        </div>
      </SettingsSection>
      <SettingsSection title="Application answers" description="Copied verbatim onto forms.">
        <ApplyProfileForm
          initial={initial}
          suggestedSchool={suggestedSchool}
          suggestedLinks={suggestedLinks}
        />
      </SettingsSection>
    </div>
  );
}
