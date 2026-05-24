import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
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
 * redirects to the `next` query param (or onboarding by default).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/onboarding/preferences";

  if (!code) {
    logger.warn({ url: request.url }, "auth.callback.missing_code");
    return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    logger.warn({ err: error.message }, "auth.callback.exchange_failed");
    return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
  }

  logger.info({ next }, "auth.callback.success");
  return NextResponse.redirect(new URL(next, request.url));
}
