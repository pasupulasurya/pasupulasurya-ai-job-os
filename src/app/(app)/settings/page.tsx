import { redirect } from "next/navigation";
import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { signOutAction } from "@/server/actions/auth";
import { Briefcase, Eye } from "lucide-react";
import { PersonalInfoSection } from "./_components/personal-info-section";
import { PreferencesForm } from "./_components/preferences-form";
import { SettingsSection } from "./_components/settings-section";
import { ResumeSection, type ResumeRow } from "./_components/resume-section";

export const dynamic = "force-dynamic";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const appUser = await prisma.user.findUnique({
    where: { authId: authUser.id },
    include: {
      preferences: true,
      resumes: { orderBy: { createdAt: "desc" } },
      jobMatches: { select: { status: true } },
    },
  });
  if (!appUser) {
    logger.error({ authId: authUser.id }, "settings.user_not_found");
    redirect("/login");
  }

  const masterResume = appUser.resumes.find((r) => r.isMaster) ?? null;
  type ParsedResume = {
    totalYearsExperience?: number | null;
    skills?: unknown;
    currentRole?: unknown;
    workHistory?: unknown;
  } | null;
  const parsed = (masterResume?.parsedJson as ParsedResume) ?? null;

  const suggestedSkills: string[] = Array.isArray(parsed?.skills)
    ? Array.from(
        new Set(
          (parsed.skills as unknown[])
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .map((s) => s.trim()),
        ),
      ).slice(0, 15)
    : [];

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

  const appliedCount = appUser.jobMatches.filter((m) => m.status === "applied").length;
  const viewedCount = appUser.jobMatches.filter((m) => m.status === "viewed").length;

  const displayName = appUser.firstName ?? "There";
  const memberSince = formatDate(appUser.createdAt);

  return (
    <main className="bg-background min-h-screen px-4 py-10 text-white md:px-8 md:py-16">
      <div className="mx-auto max-w-4xl space-y-12 md:space-y-16">
        {/* Account header — full width */}
        <header>
          <p className="text-text-tertiary mb-1 text-xs tracking-widest uppercase">Account</p>
          <h1 className="text-2xl font-medium tracking-tight md:text-3xl">{displayName}</h1>
          <p className="text-text-secondary mt-1 text-sm">{authUser.email}</p>
          <p className="text-text-tertiary mt-2 text-xs">Member since {memberSince}</p>
        </header>

        <SettingsSection title="Personal info" description="Your name, country, and phone number.">
          <PersonalInfoSection
            initialValues={{
              firstName: appUser.firstName ?? "",
              lastName: appUser.lastName ?? "",
              phone: appUser.phone ?? "",
              country: appUser.country,
            }}
          />
        </SettingsSection>

        <SettingsSection
          title="Resume"
          description="Upload, view, and choose which resume is your master."
        >
          <ResumeSection
            resumes={appUser.resumes.map(
              (r): ResumeRow => ({
                id: r.id,
                fileName: r.fileName,
                isMaster: r.isMaster,
                parsedAt: r.parsedAt,
                fileSize: r.fileSize,
                createdAt: r.createdAt,
              }),
            )}
          />
        </SettingsSection>

        <SettingsSection title="Activity" description="What you've done on AI Job OS so far.">
          <div className="bg-card border-border grid grid-cols-2 gap-px overflow-hidden rounded-2xl border">
            <div className="flex items-start gap-3 p-5">
              <div className="bg-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <Briefcase size={18} strokeWidth={1.5} className="text-text-secondary" />
              </div>
              <div>
                <p className="text-text-primary text-2xl font-medium tabular-nums">
                  {appliedCount}
                </p>
                <p className="text-text-tertiary mt-0.5 text-xs">Applied</p>
              </div>
            </div>
            <div className="bg-card flex items-start gap-3 p-5">
              <div className="bg-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                <Eye size={18} strokeWidth={1.5} className="text-text-secondary" />
              </div>
              <div>
                <p className="text-text-primary text-2xl font-medium tabular-nums">{viewedCount}</p>
                <p className="text-text-tertiary mt-0.5 text-xs">Viewed</p>
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="Preferences"
          description="What you want, where you want it, who sponsors."
        >
          <PreferencesForm
            suggestedKeywords={suggestedSkills}
            suggestedTargetRoles={suggestedTargetRoles}
            initialValues={{
              keywords: appUser.preferences?.keywords ?? [],
              excludeKeywords: appUser.preferences?.excludeKeywords ?? [],
              targetRoles: appUser.preferences?.targetRoles ?? [],
              locations: appUser.preferences?.locations ?? [],
              jobTypes: (appUser.preferences?.jobTypes ?? []) as Array<
                "full-time" | "internship" | "contract" | "part-time"
              >,
              experienceMin: appUser.preferences?.experienceMin ?? null,
              experienceMax: appUser.preferences?.experienceMax ?? null,
              visaSponsorship: appUser.preferences?.visaSponsorship ?? true,
              stemOptOnly: appUser.preferences?.stemOptOnly ?? false,
              visaType: (appUser.preferences?.visaType ?? null) as
                | "h1b"
                | "f1_opt"
                | "stem_opt"
                | "green_card"
                | "citizen"
                | "other"
                | null,
              workAuthStatus: (appUser.preferences?.workAuthStatus ?? null) as
                | "needs_sponsorship"
                | "current_h1b"
                | "ead"
                | "citizen_or_gc"
                | null,
              salaryMin: appUser.preferences?.salaryMin ?? null,
              currentEmployment: (appUser.preferences?.currentEmployment ?? null) as
                | "employed"
                | "unemployed"
                | "student"
                | "freelance"
                | null,
              avoidCompanies: appUser.preferences?.avoidCompanies ?? [],
            }}
          />
        </SettingsSection>

        {/* Sign out — quiet, at the bottom, after everything else */}
        <div className="border-border flex justify-end border-t pt-8">
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-text-tertiary hover:text-text-primary text-sm transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
