import { redirect } from "next/navigation";
import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { signOutAction } from "@/server/actions/auth";
import { FileText, Briefcase, Eye } from "lucide-react";
import { PreferencesForm } from "./_components/preferences-form";

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
      resumes: { where: { isMaster: true }, take: 1 },
      jobMatches: { select: { status: true } },
    },
  });
  if (!appUser) {
    logger.error({ authId: authUser.id }, "settings.user_not_found");
    redirect("/login");
  }

  const masterResume = appUser.resumes[0] ?? null;
  type ParsedResume = {
    totalYearsExperience?: number | null;
    skills?: unknown;
  } | null;
  const parsed = (masterResume?.parsedJson as ParsedResume) ?? null;

  // Surface resume-extracted skills as suggested chips above the Keywords input.
  // Defensive: parsedJson is Json? so we narrow at the boundary. Cap visible at 15.
  const suggestedSkills: string[] = Array.isArray(parsed?.skills)
    ? Array.from(
        new Set(
          (parsed.skills as unknown[])
            .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
            .map((s) => s.trim()),
        ),
      ).slice(0, 15)
    : [];

  const appliedCount = appUser.jobMatches.filter((m) => m.status === "applied").length;
  const viewedCount = appUser.jobMatches.filter((m) => m.status === "viewed").length;

  const displayName = appUser.name?.split(" ")[0] ?? authUser.email?.split("@")[0] ?? "there";
  const memberSince = formatDate(appUser.createdAt);

  return (
    <main className="bg-background min-h-screen px-6 py-12 text-white">
      <div className="mx-auto max-w-2xl space-y-10">
        {/* Profile header */}
        <section className="flex items-start justify-between">
          <div>
            <p className="text-text-tertiary mb-1 text-xs tracking-widest uppercase">Account</p>
            <h1 className="text-3xl font-medium tracking-tight">{displayName}</h1>
            <p className="text-text-secondary mt-1 text-sm">{authUser.email}</p>
            <p className="text-text-tertiary mt-2 text-xs">Member since {memberSince}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-text-tertiary hover:text-text-primary text-sm transition-colors"
            >
              Sign out
            </button>
          </form>
        </section>

        {/* Resume card */}
        <section>
          <h2 className="text-text-secondary mb-3 text-xs font-medium tracking-widest uppercase">
            Your resume
          </h2>
          <div className="bg-card border-border rounded-2xl border p-5">
            {masterResume ? (
              <div className="flex items-start gap-4">
                <div className="bg-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                  <FileText size={18} strokeWidth={1.5} className="text-text-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary truncate text-sm font-medium">
                    {masterResume.fileName ?? "Master resume"}
                  </p>
                  <p className="text-text-tertiary mt-1 text-xs">
                    Parsed {formatDate(masterResume.parsedAt)}
                    {parsed?.totalYearsExperience != null &&
                      ` · ${parsed.totalYearsExperience} years experience`}
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  className="text-text-tertiary text-xs opacity-50"
                  title="Upload UI coming soon"
                >
                  Upload new
                </button>
              </div>
            ) : (
              <p className="text-text-secondary text-sm">No master resume uploaded yet.</p>
            )}
          </div>
        </section>

        {/* Activity stats */}
        <section>
          <h2 className="text-text-secondary mb-3 text-xs font-medium tracking-widest uppercase">
            Activity
          </h2>
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
        </section>

        {/* Preferences form */}
        <section>
          <h2 className="text-text-secondary mb-3 text-xs font-medium tracking-widest uppercase">
            Preferences
          </h2>
          <PreferencesForm
            suggestedKeywords={suggestedSkills}
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
        </section>
      </div>
    </main>
  );
}
