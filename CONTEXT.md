# AI Job OS — Session Context

> **Paste this file at the start of every new session with Claude.**
> Last updated: 2026-05-24

---

## 1. THE BAR (non-negotiable)

**Frontend — cinematic, Apple-grade**
True OLED black (`#000000`). Inter Display + Inter fonts. Spring motion only
(`snappy`, `smooth`, `gentle` from `src/styles/tokens.ts`). 8px grid, no exceptions.
One accent: `#0A84FF`. Lucide icons at stroke 1.5. Dark default, light is a port.

**Backend — Stripe-grade**

- NO `any` types in TypeScript — ever
- Every external input through Zod (not just typed)
- Every async operation has Pino structured logging
- No `console.log` in production code (Pino only)
- Every API endpoint idempotent OR explicitly documented as not
- Every secret in env vars, no hardcoding

**Tone of voice**
"Done" not "Yay! All done!" — direct, calm, never apologetic.
No emojis in production UI. We are precise, never cute.

---

## 2. WHAT WE'VE BUILT (cumulative)

### Foundation (F1–F7) — shipped to main

- VISION.md, ADRs (0001 stack, 0002 auth, 0003 data lifecycle)
- Design system: tokens.ts, principles.md
- Layered architecture: `src/server/` + `src/lib/` + `src/shared/`
- Observability: Pino + Sentry + PostHog (verified live)
- Quality gates: Prettier + Husky + lint-staged + commitlint
- Command palette (cinematic reference component)

### Phase 2A — shipped to main

- 10-table schema on Supabase
- 30 US companies seeded, 12 owner rules seeded
- Prisma 7 + `@prisma/adapter-pg`

### Phase 2B — shipped to main

- Supabase Auth + Resend SMTP
- DB triggers: `on_auth_user_created`, `on_auth_user_deleted`
  (file: `prisma/sql/0001_auth_signup_trigger.sql`)
- Auth pages: `/login`, `/signup`, `/auth/callback`, `/auth/auth-code-error`
- Onboarding: `/onboarding/preferences` (chip inputs, presets, toggles)
- Middleware route protection
- Command palette wired to real auth + PostHog identify

### Phase 2C.0 — on `feat/scraper-and-cleanup`

- Schema additions: `expiresAt`, `deletedAt`, `UserJobMatch.status/viewedAt/dismissedAt/autoDismissed`, `Application.archivedAt`, new `UserBlockedCompany` model

### Phase 2C.1 — on `feat/scraper-and-cleanup`

- Greenhouse scraper end-to-end (5 files in `src/server/services/scrapers/`)
- CLI runner: `npm run scrape:gh`
- **913 real US jobs in DB from 11 companies**
- Idempotency verified (running twice → 0 new inserts)

---

## 3. EXACT SCHEMA FIELDS (cheat sheet — Prisma 7)

---

## 4. LOCKED DECISIONS (do not re-discuss)

| Decision                  | Value                                                  |
| ------------------------- | ------------------------------------------------------ |
| Job TTL                   | 30 days                                                |
| UserJobMatch auto-dismiss | 7 days unviewed                                        |
| Application archival      | 90 days after rejection                                |
| Dedup window              | 14 days (sha256 of company\|title\|location)           |
| Cleanup cron              | Daily 04:00 PT via GitHub Actions                      |
| Repository pattern        | NO — direct Prisma calls                               |
| AI hosting (beta)         | Groq free tier (Llama 3.3 70B)                         |
| Vercel deploy             | After Phase 2E (full dashboard)                        |
| US-only filter            | Multi-office OK (any segment US → accept)              |
| Rule patterns             | Regex (case-insensitive)                               |
| Server-only guard         | Only on supabase-server.ts (not prisma/logger/posthog) |

---

## 5. WHAT REMAINS

### Phase 2C (continued)

- Phase 2C.2 — Lever scraper (estimated 30 min, copy Greenhouse pattern)
- Phase 2C.3 — Ashby scraper (CRITICAL: OpenAI, Notion, Linear, Plaid, Snowflake, Ramp, Supabase, Perplexity, Rippling all queued — ~9 more companies)
- Phase 2C.4 — Daily cleanup script (`scripts/cleanup.ts` — 4 SQL ops)
- Phase 2C.5 — GitHub Actions cron for scrape + cleanup
- Phase 2C.6 — Airbnb Zod bug (1,224 jobs hidden, deferred)
- Phase 2C.7 — Coinbase 404 (anti-bot, may need User-Agent tweak)

### Phase 2D — AI enrichment via Groq

- LLM abstraction layer (model-agnostic: Groq | Claude | OpenAI via env var)
- Extract per job: seniority, experienceYears, skills, sponsorsVisa, stemOptFriendly
- ~$0/month using Groq free tier (14k req/day)

### Phase 2E — Matcher + Dashboard

- Populate `UserJobMatch` per user
- Build `/dashboard` to Apple-grade bar
- Match by keywords + (later) pgvector semantic match

### Phase 2F — Deploy to Vercel

### Phase 2G+ — Resume tailoring, PDF gen, Playwright auto-fill (review-only), Gmail intelligence

---

## 6. KNOWN ISSUES (small)

1. ~3-5 Greenhouse jobs per scrape fail with `\u0000` byte (~0.3% — accepted)
2. Airbnb returns 0 fetched despite 1,224 jobs in API (deferred)
3. Coinbase Greenhouse API returns 404 (likely IP-based, deferred)

---

## 7. CRITICAL FILES (in current repo)

| Concern            | Path                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| Architecture       | `VISION.md`, `docs/adr/*.md`, `docs/design/principles.md`                            |
| Design tokens      | `src/styles/tokens.ts`, `src/app/globals.css`                                        |
| Prisma schema      | `prisma/schema.prisma`                                                               |
| SQL triggers       | `prisma/sql/0001_auth_signup_trigger.sql`                                            |
| Auth               | `src/server/actions/auth.ts`, `src/app/login/*`, `src/app/signup/*`, `middleware.ts` |
| Preferences        | `src/server/actions/preferences.ts`, `src/app/onboarding/preferences/*`              |
| Command palette    | `src/components/command-palette.tsx`                                                 |
| Greenhouse scraper | `src/server/services/scrapers/*.ts`                                                  |
| CLI                | `scripts/scrape.ts`                                                                  |

---

## 8. HOW TO RESUME

Start a new session with:
Then paste this file. I will:

1. Re-read the bar
2. Confirm the schema field names
3. Plan in plain English BEFORE writing code
4. Write code in ≤30-line chunks you can audit
5. Never re-derive context from memory
