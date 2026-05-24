# ADR 0002: Authentication Architecture

**Status:** Accepted
**Date:** 2026-05-24
**Authors:** Surya Pasupula

## Context

We are building a multi-user platform where 10 beta friends — and later
the public — sign up, set job preferences, and view personalized feeds.
Authentication needs to be secure, friction-light, and integrated with
our existing observability stack.

## Decisions

### Provider

- **Supabase Auth** (already on our stack)
- Free tier covers 50,000 monthly active users; we will not pay for
  auth during beta or early launch

### Methods (v1)

- **Email + password** — familiar, works offline-first
- **Magic link** — passwordless, cinematic default — single click in email

### Session

- **Cookie-based** sessions via `@supabase/ssr`
- Required for Next.js Server Components to read auth state
- HTTP-only cookies, SameSite=Lax, secure in production

### Email confirmation

- **Required.** Users must click confirmation link before they can log in
- Reduces spam signups during beta

### User record creation

- A Postgres trigger on `auth.users` insert auto-creates:
  - A `User` row (linking authId → User.authId)
  - An empty `UserPreference` row tied to that user
- Single source of truth — works even if our API code fails

### Route protection

- **Middleware-based** (`middleware.ts` at project root)
- Runs on every request, before the page renders
- Edge-fast; no per-page guard duplication
- Unauthenticated → redirect to `/login?from=<original-path>`

### Onboarding gate

- After sign-up + email confirmation, users land on `/onboarding/preferences`
- They cannot access the dashboard until preferences are set
  (at least keywords + experience range)
- This guarantees the matcher has something to work with on day one

### Observability hooks

- On successful login → `posthog.identify(user.id, { email, signup_date })`
- On signup → server event `user.signup.completed`
- On logout → `posthog.reset()` + server event `user.signout`
- Sentry user context set via `Sentry.setUser({ id, email })`

## What we are NOT doing in v1

| Skipped                      | Reason                                             | When to revisit                       |
| ---------------------------- | -------------------------------------------------- | ------------------------------------- |
| Password reset UI            | Beta has 10 known users; can do via Supabase admin | Before public launch                  |
| Social login (Google/GitHub) | Adds OAuth config complexity                       | If beta friends ask                   |
| 2FA / TOTP                   | Overkill for beta                                  | When we onboard first paying customer |
| Avatar upload                | Not a job-platform feature                         | Phase 3+                              |
| Account deletion UI          | Manual via support email for now                   | Before public launch                  |

## Consequences

### Positive

- Beta users can sign up in < 30 seconds with magic link
- Server Components can render personalized data without client roundtrips
- Database trigger guarantees consistency — no orphaned auth.users
- All auth events flow into PostHog and Sentry automatically

### Trade-offs accepted

- Cookie-based sessions add complexity vs. JWT-only, but enable SSR
- Required email confirmation blocks instant-onboarding friends — mitigated
  by clear copy ("Check your email") and magic link being one-tap
- Trigger-based user creation requires SQL knowledge to debug — mitigated
  by good logging + Sentry alerting on auth failures

### Risks

- Supabase free tier outage = total auth failure (no fallback) —
  acceptable for beta; add status page integration before public launch
- Email deliverability (magic links to Gmail spam) — mitigated by
  configuring custom SMTP via Resend before public launch
