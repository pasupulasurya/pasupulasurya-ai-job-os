import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { prisma } from "@/server/lib/prisma";
import { getNextOnboardingStep } from "@/server/lib/onboarding";
import { logger } from "@/server/lib/logger";

/**
 * Auth callback route.
 *
 * Called when:
 *   - User clicks confirmation link after signup
 *   - User clicks magic link
 *   - OAuth provider redirects back (future)
 *
 * Exchanges the `code` query param for a session cookie, then
 * redirects based on the user's real onboarding state:
 *   - explicit ?next= param wins (if provided and safe)
 *   - else: fresh user (no firstName) → /onboarding/welcome
 *   - else: partially onboarded → next incomplete step
 *   - else: fully onboarded → /dashboard
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const explicitNext = url.searchParams.get("next");

  if (!code) {
    logger.warn({ url: request.url }, "auth.callback.missing_code");
    return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logger.warn({ err: error.message }, "auth.callback.exchange_failed");
    return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
  }

  // If caller passed an explicit ?next=, honor it (e.g., deep links).
  if (explicitNext) {
    logger.info({ next: explicitNext }, "auth.callback.success.explicit_next");
    return NextResponse.redirect(new URL(explicitNext, request.url));
  }

  // Otherwise, compute destination from real onboarding state.
  const authUser = data.user;
  if (!authUser) {
    // Defensive: exchange succeeded but no user? Send to login.
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const appUser = await prisma.user.findUnique({
    where: { authId: authUser.id },
    select: {
      firstName: true,
      lastName: true,
      resumes: { where: { isMaster: true }, select: { id: true }, take: 1 },
      preferences: { select: { keywords: true } },
    },
  });

  // Fresh user just out of signup: trigger created the User row but
  // firstName is NULL. Send to welcome page (intro), not directly to
  // /onboarding/profile, so they get a friendly hand-off.
  const isFreshUser = !appUser?.firstName;
  if (isFreshUser) {
    logger.info({ userId: authUser.id }, "auth.callback.success.fresh_user");
    return NextResponse.redirect(new URL("/onboarding/welcome", request.url));
  }

  const nextStep = getNextOnboardingStep({
    firstName: appUser?.firstName ?? null,
    lastName: appUser?.lastName ?? null,
    masterResumeExists: (appUser?.resumes.length ?? 0) > 0,
    preferenceKeywordsCount: appUser?.preferences?.keywords.length ?? 0,
  });

  const dest = nextStep ?? "/dashboard";
  logger.info({ userId: authUser.id, dest }, "auth.callback.success.computed");
  return NextResponse.redirect(new URL(dest, request.url));
}
