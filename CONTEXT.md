# AI Job OS — Session Context

> **Paste this file at the start of every new session with Claude.**
> Last updated: 2026-05-27 (Phase 2E.2.A shipped — matcher backend functional)

For wider context, also point readers at:

- `README.md` — front door / quickstart
- `ARCHITECTURE.md` — how the system thinks
- `COLLABORATION.md` — how we work together
- `AI_JOB_OS_SESSION_JOURNAL.md` — build narrative

---

## 1. THE BAR (non-negotiable)

**Frontend — cinematic, Apple-grade**
True OLED black (`#000000`). Inter Display + Inter fonts. Spring motion only
(`snappy`, `smooth`, `gentle` from `src/styles/tokens.ts`). 8px grid.
One accent: `#0A84FF`. Lucide icons at stroke 1.5. Dark default, light is a port.

**Backend — Stripe-grade**

- NO `any` types in TypeScript — ever
- Every external input through Zod (not just typed)
- Every async operation has Pino structured logging
- No `console.log` in production code (Pino only; CLI scripts excepted)
- Every API endpoint idempotent OR explicitly documented as not
- Every secret in env vars, no hardcoding
- **System stays correct under partial failure** — per-item try/catch at every boundary

**Tone of voice** — Direct, calm, never apologetic. No emojis in UI.

**Product principle** — **Never fabricate content.** Resume tailoring rewrites and re-emphasizes, but cannot invent facts. Locked/Tailored split enforces this in architecture.

---

## 2. WHAT WE'VE BUILT (cumulative — all shipped to main)

- **Foundation (F1-F7):** VISION, ADRs, design tokens, observability, quality gates, command palette
- **Phase 2A:** 10-table schema, 30 US companies seeded, 12 owner rules
- **Phase 2B:** Supabase Auth + Resend SMTP + DB triggers + auth pages + middleware + onboarding
- **Phase 2C:** Greenhouse + Ashby scrapers, cleanup script, daily cron, per-job parse refactor — 1,337 real US jobs
- **Phase 2D:** LLM provider abstraction, Groq impl with retry+throttle, enrichment orchestrator, CLI, split cron workflows (`daily-cron.yml` + `daily-enrich.yml`)
- **Phase 2E.1:** Schema expansion (UserPreference +7, ResumeVersion +7), expanded Zod, updated Server Actions, resume parser (`parse-resume.ts`), upload Server Action (`uploadMasterResumeAction`), CLI smoke test (`npm run parse:resume`). Verified end-to-end on real PDF.
- **Phase 2E.2.A:** Matcher backend — scoring engine, hard filters, orchestrator, CLI. 6 weighted dimensions, saturating title curve, word-boundary keyword matching, conditional relevance gate, sparsity dampening. Verified against real user (top 3 are real ML engineering jobs ranked above sales noise).

**Total in DB right now: 1,337 real US jobs. ~123 jobs enriched. 4 jobs stored as matches for test user.**

**The enrichment rate problem (acknowledged, not fixed):**
At Groq free tier (~30-100 jobs/day with throttle), full backfill of 1,200 unenriched jobs takes 12-40 days. **This blocks 2E.3 from showing dense data.** The architectural fix is one of: (1) Groq Developer tier (add credit card, $0 actual cost at our volume, 10× throughput), (2) Claude API swap (~$0.50-2 to backfill, one-file change via provider abstraction), (3) accept 40-day timeline. **Decision: keep current setup tonight, swap to Claude/Developer-Groq before/during 2E.3.**

---

## 3. EXACT SCHEMA FIELDS (Prisma 7 cheat sheet)

**Source of truth:** `prisma/schema.prisma`.

### User

`id, authId, email (unique), name, role, createdAt, updatedAt`

- relations: preferences, applications, jobMatches, blockedCompanies, resumes

### UserPreference (2E.1 expanded)

Core: `keywords[], excludeKeywords[], locations[], jobTypes[], experienceMin, experienceMax, visaSponsorship, stemOptOnly, dailyApplyLimit`
2E.1 fields:

- `visaType` (String?) — "h1b" | "f1_opt" | "stem_opt" | "green_card" | "citizen" | "other"
- `workAuthStatus` (String?) — "needs_sponsorship" | "current_h1b" | "ead" | "citizen_or_gc"
- `salaryMin` (Int?) — annual USD
- `currentEmployment` (String?) — "employed" | "unemployed" | "student" | "freelance"
- `targetRoles` (String[] default []), `avoidCompanies` (String[] default [])
- `onboardingComplete` (Boolean default false)

Canonical enums in `src/shared/schemas/preferences.ts`: `visaTypeValues`, `workAuthStatusValues`, `currentEmploymentValues`.

### Company

`id, slug (unique), name, ats, active, knownToSponsor, notes, lastScrapedAt, lastJobCount, createdAt, updatedAt`

- **WATCH:** `ats` not `source`; `active` not `isActive`

### ScrapingRule

`id, name, ruleType, pattern, enabled, appliesTo, createdAt, updatedAt`

- **WATCH:** `ruleType`, `appliesTo`, `enabled` (not `action`/`field`/`isActive`)

### Job

Core: `id, source, sourceUrl (UNIQUE), externalId, title, company, companySlug, location, remote, description, rawJson, hash, scrapedAt, expiresAt, deletedAt, updatedAt`
AI-filled: `seniority (entry/mid/senior/staff), experienceYears (0-40), skills[], sponsorsVisa (tri-state), stemOptFriendly (tri-state), postedAt`
Enrichment metadata: `enrichedAt`, `enrichmentVersion` (current: `groq-llama-3.3-70b-v1`)

### UserJobMatch (2E.2 expanded)

Core: `id, userId, jobId, matchScore, status, matchedAt, viewedAt, dismissedAt, dismissed, autoDismissed`
2E.2 fields:

- `scoreBreakdown` (Json?) — per-dimension contributions for "why this score" UX
- `reason` (Text?) — LLM-generated paragraph (NULL until 2E.2.B ships)
- `matchVersion` (String?) — current: `matcher-v1`
- New index: `[userId, matchVersion]`
- `status`: "fresh" | "viewed" | "applied" | "dismissed" | "rejected"

### Application

`id, userId, jobId, status, resumeId, appliedAt, notes, createdAt, updatedAt, archivedAt`

### ResumeVersion (2E.1 expanded)

Core: `id, userId (REQUIRED), jobId (optional), contentJson, pdfUrl, docxUrl, createdAt, applications[]`
2E.1 fields:

- `isMaster` (Boolean default false) — one master per user
- `parsedJson` (Json?) — AI-extracted: { fullName, email, phone, location, summary, totalYearsExperience, currentRole, currentCompany, education[], workHistory[], skills[], links{} }
- `parsedAt` (DateTime?), `parseVersion` (String?) — current: `groq-llama-3.3-70b-resume-v2`
- `fileName` (String?), `fileSize` (Int?)
- Indexes: `[userId]`, `[userId, isMaster]`

### UserBlockedCompany

`id, userId, companyId, reason, blockedAt`

### Log

`id, action, payload, level, createdAt`

---

## 4. LOCKED DECISIONS (do not re-discuss)

| Decision                   | Value                                                                             |
| -------------------------- | --------------------------------------------------------------------------------- |
| Job TTL                    | 30 days for unmatched jobs                                                        |
| UserJobMatch auto-dismiss  | 7 days unviewed                                                                   |
| Application archival       | 90 days after rejection                                                           |
| Dedup window               | 14 days (sha256 of company\|title\|location)                                      |
| Cleanup model              | **User-driven, not time-driven**                                                  |
| Repository pattern         | NO — direct Prisma                                                                |
| AI provider (beta)         | Groq free tier (`llama-3.3-70b-versatile`)                                        |
| Groq free tier limits      | 30 RPM / 6,000 TPM / 1,000 RPD                                                    |
| Enrichment version         | `groq-llama-3.3-70b-v1`                                                           |
| Enrichment throttle        | 500ms between successful jobs                                                     |
| Enrichment max_tokens      | 512                                                                               |
| Resume parse version       | `groq-llama-3.3-70b-resume-v2`                                                    |
| Resume parse max_tokens    | 4096                                                                              |
| Resume parse truncation    | 12,000 chars                                                                      |
| Resume MAX_SKILLS          | 80 (was 50; some senior resumes have 60+)                                         |
| LLM error handling         | Auth/rate-limit → abort batch; validation/transport → log+continue                |
| LLM cron schedules         | scrape+cleanup 11:00 UTC, enrich 12:00 UTC                                        |
| **Master/Tailored split**  | Master locked truth; tailoring rewrites summary/skills/bullets only               |
| Master switching           | Non-destructive (preserve provenance)                                             |
| **Matcher version**        | `matcher-v1`                                                                      |
| **Matcher weights**        | titleKeywords=25, skills=20, seniority=15, sponsorship=15, location=15, salary=10 |
| **Matcher saturation**     | 1 kw match=0.7, 2=0.9, 3+=1.0                                                     |
| **Matcher skill dampen**   | <3 job skills → score scaled by (count/3)                                         |
| **Matcher relevance gate** | Cap at 35 if titleKw=0 AND skills=0 AND both have data                            |
| **Matcher word matching**  | Word-boundary regex (prevents "llm" matching "fulfillment")                       |
| MIN_SCORE_TO_PERSIST       | 40 (calibrated for current data sparsity; revisit when enrichment ≥50%)           |
| Resume file types accepted | PDF + plain text (DOCX deferred); 5 MB max                                        |
| Schema strictness          | Strict on fields we use; permissive on metadata                                   |

---

## 5. SERVICE ARCHITECTURE

### Scrapers (`src/server/services/scrapers/`)

greenhouse.ts/schema.ts, ashby.ts/schema.ts, location.ts, hash.ts, rules.ts

### AI services (`src/server/services/ai/`)

- `llm.ts` — provider-agnostic interface, typed error hierarchy, factory
- `groq-provider.ts` — Groq impl with retry, timeout, Retry-After
- `enrich.ts` — job enrichment orchestrator
- `parse-resume.ts` — resume parser with non-fabrication integrity rule

### Matcher (`src/server/services/matcher/`)

- `score.ts` — pure scoring functions (6 dimensions, weighted composition)
- `filters.ts` — hard pre-filters (exclude keywords, avoid companies, sponsorship)
- `match.ts` — orchestrator (idempotency, upsert, status preservation)

### Server Actions (`src/server/actions/`)

- `auth.ts` — signup/signin/signout
- `preferences.ts` — save UserPreference (15 fields total)
- `resume.ts` — uploadMasterResumeAction (5MB cap, atomic master-switch)

### CLI scripts (`scripts/`)

- `scrape.ts` — `scrape:gh`, `scrape:ashby`
- `cleanup.ts` — `cleanup`, `cleanup -- --dry-run`
- `enrich.ts` — `enrich`, `enrich -- --force --limit=N --dry-run`
- `parse-resume.ts` — `parse:resume -- <path>` (CLI smoke test)
- `seed-master-resume.ts` — `seed:resume -- --user=<id> --file=<path>` (dev helper)
- `match.ts` — `match`, `match -- --user=<id> --force --limit=N --dry-run`
- `top-matches.ts` — inspect top N stored matches

### GitHub Actions

- `daily-cron.yml` — 11:00 UTC, 15-min timeout, scrape + cleanup
- `daily-enrich.yml` — 12:00 UTC, 60-min timeout, enrich only

---

## 6. WHAT REMAINS

### Phase 2E.2.B — Reason generator (next, ~4-5h)

- `src/server/services/matcher/reason.ts` — LLM call per top-N matched job
- Produces 2-3 sentence "why this job, why now" paragraph stored in `UserJobMatch.reason`
- **Gate for cinematic dashboard** — the reason text IS the card content
- Prompt iteration is the long pole
- Will likely swap to Claude API for quality

### Phase 2E.3 — Cinematic dashboard (~30-40h, multi-session)

Real scope (don't underestimate):

1. **Choreographed onboarding flow** (~6-8h) — 5-step with animations, resume upload + AI prefill, settings collection, "building your briefing" reveal
2. **Daily briefing UI** (~4-6h) — hero job card, score reveal, stagger-in animations, all states
3. **Why this score expandable view** (~2-3h) — dimensional breakdown bars
4. **Action layer** (~2-3h) — Save/Dismiss/Apply with optimistic UI
5. **Settings page** (~3-4h) — all UserPreference fields
6. **Mobile responsive** (~4-6h) — every state needs mobile
7. **Keyboard shortcuts + command palette integration** (~2-3h)
8. **Accessibility** (~3-4h) — ARIA, keyboard nav, focus management
9. **Auth-gated routing** (~2-3h) — state machine: no resume → upload, no prefs → onboarding, matcher hasn't run → "first match coming"
10. **Real loading/empty/error states** (~2-3h)

### Phase 2F — Vercel deploy (~3-4h)

- env var migration, edge vs node runtime decisions, upload limits, cold-start handling

### Phase 2G — Resume tailoring (Locked/Tailored split, both PDF + DOCX, single-page, ATS-friendly)

### Phase 2H+ — Email digest, application auto-fill (Playwright, review-only), Gmail intelligence

### Critical pre-2E.3 decision

**Add Groq Developer tier OR swap to Claude API.** Current enrichment rate (~30-100 jobs/day) means dashboard ships with insufficient data. Both fix this; Groq Developer is $0 at our volume.

---

## 7. KNOWN ISSUES (live, accepted)

1. **Null bytes** — ~0.3% of Greenhouse jobs. Stripped at write; nested JSON occasionally slips. Accepted.
2. **Coinbase** — Greenhouse 404 from GH Actions IPs.
3. **Linear/Supabase (ashby)** — non-US, correctly rejected.
4. **GitHub Actions Node 20 deprecation** — June 2026, bump actions/checkout + actions/setup-node.
5. **Non-technical roles return `skills: []`** — ~60% of jobs. Matcher conditional relevance gate handles correctly.
6. **DOCX resume upload** — not implemented, clear error returned.
7. **Enrichment data-rate bottleneck** — see Section 2. **This is the blocker for 2E.3 ship readiness.**
8. **Matcher data-limited** — only 4 stored matches for test user. Algorithm correct; coverage gated by enrichment.

### Recently resolved

- ✅ Phase 2D shipped (LLM abstraction, Groq, enrichment, CLI, cron)
- ✅ Cron timeout — split into two workflows
- ✅ Phase 2E.1 backend shipped
- ✅ Phase 2E.2.A backend shipped — matcher engine functional, correctness verified
- ✅ Multiple matcher algorithm bugs caught and fixed: neutral-default inflation, sparsity-100% artifact, linear-divide penalty, "llm" matching inside "fulfillment"
- ✅ MAX_SKILLS bumped 50→80 (Zod was rejecting valid senior resumes)

---

## 8. CRITICAL FILES (current repo state)

| Concern         | Path                                                                                   |
| --------------- | -------------------------------------------------------------------------------------- |
| Front door      | `README.md`                                                                            |
| System map      | `ARCHITECTURE.md`                                                                      |
| Working rhythm  | `COLLABORATION.md`                                                                     |
| Build narrative | `AI_JOB_OS_SESSION_JOURNAL.md`                                                         |
| Vision          | `VISION.md`                                                                            |
| Decisions       | `docs/adr/*.md`                                                                        |
| Design DNA      | `docs/design/principles.md`                                                            |
| Cron runbook    | `docs/runbooks/cron.md`                                                                |
| Design tokens   | `src/styles/tokens.ts`, `src/app/globals.css`                                          |
| Prisma schema   | `prisma/schema.prisma`                                                                 |
| SQL triggers    | `prisma/sql/0001_auth_signup_trigger.sql`                                              |
| Auth            | `src/server/actions/auth.ts`, `src/app/login/*`, `src/app/signup/*`, `middleware.ts`   |
| Preferences     | `src/server/actions/preferences.ts`, `src/app/onboarding/preferences/*`                |
| Resume upload   | `src/server/actions/resume.ts`                                                         |
| Resume parser   | `src/server/services/ai/parse-resume.ts`                                               |
| Zod schemas     | `src/shared/schemas/preferences.ts`                                                    |
| Command palette | `src/components/command-palette.tsx`                                                   |
| Scrapers        | `src/server/services/scrapers/{greenhouse,ashby,location,hash,rules}.ts`               |
| LLM provider    | `src/server/services/ai/{llm,groq-provider}.ts`                                        |
| Job enrichment  | `src/server/services/ai/enrich.ts`                                                     |
| Matcher         | `src/server/services/matcher/{score,filters,match}.ts`                                 |
| CLIs            | `scripts/{scrape,cleanup,enrich,parse-resume,seed-master-resume,match,top-matches}.ts` |
| GitHub Actions  | `.github/workflows/{daily-cron,daily-enrich}.yml`                                      |

---

## 9. HOW TO RESUME

Start a new session with:

> "Read CONTEXT.md first. Confirm schema field names before any code. Phase 2E.2.A is shipped. Next is 2E.2.B (reason generator) and pre-2E.3 prep (Groq Developer or Claude swap)."

Then paste CONTEXT.md (or load it via Claude Projects — see Section 10).

I will:

1. Re-read the bar
2. Confirm schema fields (Section 3)
3. Plan in plain English before code
4. Write code in ≤30-line chunks
5. Never re-derive context from memory

If fresh Claude (different account): also paste README.md, ARCHITECTURE.md, COLLABORATION.md.

---

## 10. CLAUDE PROJECTS (recommended setup going forward)

If you have Claude Pro, create a Project for AI Job OS. Upload README.md, ARCHITECTURE.md, CONTEXT.md, COLLABORATION.md as project knowledge. New chats in that project auto-include all four — no pasting per session.

When you update CONTEXT.md, re-upload to the project to replace.

---

## 11. NEXT SESSION CHECKLIST (priority order)

1. **Decide: Groq Developer tier OR Claude API swap.** Both fix the enrichment-rate bottleneck. Required before 2E.3.
2. **Ship 2E.2.B (reason generator)** — ~4-5h, prompt iteration is the long pole. Locked/Tailored integrity rule applies (no fabrication).
3. **Re-run matcher with `--force --all-users`** to repopulate UserJobMatch with reasons.
4. **Begin 2E.3 design** — onboarding flow first (most complex piece). Plan it cinematically before any code.

---
