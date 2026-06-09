import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { prisma } from "@/server/lib/prisma";
import { getNextOnboardingStep } from "@/server/lib/onboarding";
import { logger } from "@/server/lib/logger";

/**
 * Auth callback route.
 *
 * Handles two verification flows:
 *   - token_hash + type  → verifyOtp  (email links: confirm signup, magic link)
 *     No PKCE verifier cookie needed, so it works when the link is opened
 *     in a different browser than it was requested from (mobile mail apps).
 *   - code               → exchangeCodeForSession  (PKCE fallback, OAuth)
 *
 * After a session is established, redirects based on real onboarding state:
 *   - explicit ?next= wins (if safe)
 *   - fresh user (no firstName) → /onboarding/welcome
 *   - partially onboarded → next incomplete step
 *   - fully onboarded → /dashboard
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const explicitNext = url.searchParams.get("next");

  const supabase = await createSupabaseServerClient();

  // Resolve the session via whichever flow the link used.
  let userId: string | null = null;

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error || !data.user) {
      logger.warn({ err: error?.message, type }, "auth.callback.verify_otp_failed");
      return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
    }
    userId = data.user.id;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      logger.warn({ err: error?.message }, "auth.callback.exchange_failed");
      return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
    }
    userId = data.user.id;
  } else {
    logger.warn({ url: request.url }, "auth.callback.missing_token");
    return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
  }

  // If caller passed an explicit ?next=, honor it (e.g., deep links).
  if (explicitNext) {
    logger.info({ next: explicitNext }, "auth.callback.success.explicit_next");
    return NextResponse.redirect(new URL(explicitNext, request.url));
  }

  // Otherwise, compute destination from real onboarding state.
  const appUser = await prisma.user.findUnique({
    where: { authId: userId },
    select: {
      firstName: true,
      lastName: true,
      resumes: { where: { isMaster: true }, select: { id: true }, take: 1 },
      preferences: { select: { keywords: true } },
    },
  });

  // Fresh user just out of signup: trigger created the User row but
  // firstName is NULL. Send to welcome page (intro).
  const isFreshUser = !appUser?.firstName;
  if (isFreshUser) {
    logger.info({ userId }, "auth.callback.success.fresh_user");
    return NextResponse.redirect(new URL("/onboarding/welcome", request.url));
  }

  const nextStep = getNextOnboardingStep({
    firstName: appUser?.firstName ?? null,
    lastName: appUser?.lastName ?? null,
    masterResumeExists: (appUser?.resumes.length ?? 0) > 0,
    preferenceKeywordsCount: appUser?.preferences?.keywords.length ?? 0,
  });

  const dest = nextStep ?? "/dashboard";
  logger.info({ userId, dest }, "auth.callback.success.computed");
  return NextResponse.redirect(new URL(dest, request.url));
}
