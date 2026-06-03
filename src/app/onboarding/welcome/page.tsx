import { redirect } from "next/navigation";
import Link from "next/link";
import { User as UserIcon, FileText, Sliders } from "lucide-react";
import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingProgress } from "@/components/onboarding/progress";

export const dynamic = "force-dynamic";

export default async function OnboardingWelcomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const appUser = await prisma.user.findUnique({
    where: { authId: authUser.id },
    include: {
      preferences: true,
      resumes: { where: { isMaster: true }, take: 1, select: { id: true } },
    },
  });
  if (!appUser) {
    logger.error({ authId: authUser.id }, "onboarding_welcome.user_not_found");
    redirect("/login");
  }

  // If onboarding is genuinely complete, send to dashboard.
  const hasProfile = appUser.firstName !== null;
  const hasResume = appUser.resumes.length > 0;
  const hasPrefs = appUser.preferences !== null && appUser.preferences.keywords.length >= 3;
  if (hasProfile && hasResume && hasPrefs) {
    redirect("/dashboard");
  }

  const steps = [
    { icon: UserIcon, label: "Tell us about yourself" },
    { icon: FileText, label: "Upload your resume" },
    { icon: Sliders, label: "Set your preferences" },
  ];

  return (
    <AuthShell
      title="Welcome to AI Job OS"
      subtitle="Let's set up your profile in 3 quick steps."
      header={<OnboardingProgress current={1} total={4} />}
    >
      <div className="space-y-8">
        <ol className="space-y-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.label}
                className="border-border bg-card flex items-center gap-4 rounded-xl border p-4"
              >
                <span className="bg-surface text-text-tertiary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium tabular-nums">
                  {i + 1}
                </span>
                <Icon size={18} strokeWidth={1.5} className="text-text-secondary shrink-0" />
                <span className="text-text-primary text-sm">{step.label}</span>
              </li>
            );
          })}
        </ol>

        <Link
          href="/onboarding/profile"
          className="bg-accent hover:bg-accent-hover block w-full rounded-md px-6 py-3 text-center text-sm font-medium text-white transition-colors"
        >
          Get started
        </Link>
      </div>
    </AuthShell>
  );
}
