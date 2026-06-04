import { redirect } from "next/navigation";
import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { canAccessStep } from "@/server/lib/onboarding";
import { ResumeUploadForm } from "./_components/resume-upload-form";

export const dynamic = "force-dynamic";

export default async function OnboardingResumePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const appUser = await prisma.user.findUnique({
    where: { authId: authUser.id },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!appUser) {
    logger.error({ authId: authUser.id }, "onboarding_resume.user_not_found");
    redirect("/login");
  }

  // Prior-step guard: profile must be complete before resume step.
  // Master resume existence isn't checked — users can be on this page to
  // upload, or to re-upload over an existing master.
  const access = canAccessStep("/onboarding/resume", {
    firstName: appUser.firstName,
    lastName: appUser.lastName,
    masterResumeExists: false,
    preferenceKeywordsCount: 0,
  });
  if (!access.allowed) redirect(access.redirectTo);

  const existingMaster = await prisma.resumeVersion.findFirst({
    where: { userId: appUser.id, isMaster: true },
    select: { fileName: true, parsedAt: true },
  });

  return <ResumeUploadForm existingFileName={existingMaster?.fileName ?? null} />;
}
