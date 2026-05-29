import { redirect } from "next/navigation";
import { prisma } from "@/server/lib/prisma";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { AppShell } from "./_components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const appUser = await prisma.user.findUnique({
    where: { authId: authUser.id },
    select: { id: true, name: true, email: true },
  });
  if (!appUser) {
    logger.error({ authId: authUser.id }, "appshell.user_not_found");
    redirect("/login");
  }

  const email = appUser.email ?? authUser.email ?? "";
  const initialSource = appUser.name?.trim() || email;
  const initial = initialSource.charAt(0).toUpperCase() || "?";

  return (
    <AppShell email={email} initial={initial}>
      {children}
    </AppShell>
  );
}
