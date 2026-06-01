import { redirect } from "next/navigation";
import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { ProfileClientForm } from "./_components/profile-client-form";

export const dynamic = "force-dynamic";

export default async function OnboardingProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const appUser = await prisma.user.findUnique({
    where: { authId: authUser.id },
    select: { firstName: true, lastName: true, phone: true },
  });
  if (!appUser) {
    logger.error({ authId: authUser.id }, "onboarding_profile.user_not_found");
    redirect("/login");
  }

  return (
    <ProfileClientForm
      initialValues={{
        firstName: appUser.firstName ?? "",
        lastName: appUser.lastName ?? "",
        phone: appUser.phone ?? "",
      }}
    />
  );
}
