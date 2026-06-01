import { redirect } from "next/navigation";
import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
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
    select: { id: true },
  });
  if (!appUser) {
    logger.error({ authId: authUser.id }, "onboarding_resume.user_not_found");
    redirect("/login");
  }

  const existingMaster = await prisma.resumeVersion.findFirst({
    where: { userId: appUser.id, isMaster: true },
    select: { fileName: true, parsedAt: true },
  });

  return <ResumeUploadForm existingFileName={existingMaster?.fileName ?? null} />;
}
