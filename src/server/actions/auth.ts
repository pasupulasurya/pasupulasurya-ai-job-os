"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/server/lib/supabase-server";
import { logger } from "@/server/lib/logger";
import { signupSchema, loginSchema, magicLinkSchema } from "@/shared/schemas/auth";
import { prisma } from "@/server/lib/prisma";
import { getNextOnboardingStep } from "@/server/lib/onboarding";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type ActionResult = { error: string } | { success: true };

/**
 * Sign up a new user with email + password.
 * Sends a confirmation email; user must click link before logging in.
 */
export async function signUpAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${SITE_URL}/auth/callback?next=/onboarding/preferences`,
    },
  });

  if (error) {
    logger.warn({ err: error.message, email: parsed.data.email }, "auth.signup.failed");
    return { error: error.message };
  }

  logger.info({ userId: data.user?.id, email: parsed.data.email }, "auth.signup.completed");
  return { success: true };
}

/**
 * Log in with email + password.
 */
export async function loginAction(formData: FormData): Promise<ActionResult> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    logger.warn({ err: error.message, email: parsed.data.email }, "auth.login.failed");
    return { error: error.message };
  }

  logger.info({ userId: data.user.id, email: parsed.data.email }, "auth.login.completed");

  // Compute next onboarding step from real user state (or null = fully onboarded → dashboard)
  const user = await prisma.user.findUnique({
    where: { authId: data.user.id },
    select: {
      firstName: true,
      lastName: true,
      resumes: { where: { isMaster: true }, select: { id: true }, take: 1 },
      preferences: { select: { keywords: true } },
    },
  });

  const next = getNextOnboardingStep({
    firstName: user?.firstName ?? null,
    lastName: user?.lastName ?? null,
    masterResumeExists: (user?.resumes.length ?? 0) > 0,
    preferenceKeywordsCount: user?.preferences?.keywords.length ?? 0,
  });

  redirect(next ?? "/dashboard");
}

/**
 * Send a magic link to the user's email.
 */
export async function magicLinkAction(formData: FormData): Promise<ActionResult> {
  const raw = { email: formData.get("email") };
  const parsed = magicLinkSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${SITE_URL}/auth/callback?next=/onboarding/preferences`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    logger.warn({ err: error.message, email: parsed.data.email }, "auth.magic_link.failed");
    return { error: error.message };
  }

  logger.info({ email: parsed.data.email }, "auth.magic_link.sent");
  return { success: true };
}

/**
 * Sign out the current user.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.auth.signOut();

  if (user) {
    logger.info({ userId: user.id }, "auth.signout.completed");
  }

  redirect("/login");
}
