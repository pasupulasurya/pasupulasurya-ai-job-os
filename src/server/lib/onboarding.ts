/**
 * Centralized onboarding-progression rules.
 *
 * Truth source: the User row + their ResumeVersion + their UserPreference.
 * Reading those is the caller's job (each route's page.tsx already does its
 * own Prisma fetch). This module computes "where should this user be"
 * given those values.
 *
 * Strict ordering: users can't skip ahead past incomplete steps. They can
 * revisit completed steps (profile/resume/preferences pages don't bounce
 * users who already finished them — they can edit), but they can't jump
 * forward to a step whose prior dependencies are missing.
 *
 * Welcome is intentionally NOT a gate. It's intro-only — we don't bounce
 * users with no data back to welcome. The first real gate is profile.
 */

type OnboardingState = {
  firstName: string | null;
  lastName: string | null;
  masterResumeExists: boolean;
  preferenceKeywordsCount: number;
};

export type OnboardingStep =
  | "/onboarding/profile"
  | "/onboarding/resume"
  | "/onboarding/preferences";

/**
 * Returns the path of the next incomplete onboarding step,
 * or null if fully onboarded.
 *
 * Step order:
 *   1. profile (firstName + lastName required, non-empty)
 *   2. resume  (a master ResumeVersion must exist)
 *   3. preferences (>= 3 keywords — matches MIN_KEYWORDS schema rule)
 *
 * Phone + country are NOT onboarding gates: they're optional fields
 * within the profile step. firstName + lastName are the required ones
 * (non-null in DB after Tuesday's schema tightening, but we double-check
 * for empty strings here defensively).
 */
export function getNextOnboardingStep(state: OnboardingState): OnboardingStep | null {
  const hasName =
    !!state.firstName &&
    state.firstName.trim().length > 0 &&
    !!state.lastName &&
    state.lastName.trim().length > 0;
  if (!hasName) return "/onboarding/profile";

  if (!state.masterResumeExists) return "/onboarding/resume";

  if (state.preferenceKeywordsCount < 3) return "/onboarding/preferences";

  return null;
}

/**
 * Step-specific "is the user allowed to be here" check.
 *
 * The rule: a user can be on step X only if all steps BEFORE X are complete.
 * They can be on step X if X itself is complete (revisit-to-edit is allowed).
 *
 * Use this in each onboarding route's page.tsx to redirect users who tried
 * to skip ahead.
 */
export function canAccessStep(
  step: OnboardingStep,
  state: OnboardingState,
): { allowed: true } | { allowed: false; redirectTo: OnboardingStep } {
  const hasName =
    !!state.firstName &&
    state.firstName.trim().length > 0 &&
    !!state.lastName &&
    state.lastName.trim().length > 0;
  const hasResume = state.masterResumeExists;

  if (step === "/onboarding/profile") {
    return { allowed: true };
  }

  if (step === "/onboarding/resume") {
    if (!hasName) return { allowed: false, redirectTo: "/onboarding/profile" };
    return { allowed: true };
  }

  if (step === "/onboarding/preferences") {
    if (!hasName) return { allowed: false, redirectTo: "/onboarding/profile" };
    if (!hasResume) return { allowed: false, redirectTo: "/onboarding/resume" };
    return { allowed: true };
  }

  return { allowed: true };
}
