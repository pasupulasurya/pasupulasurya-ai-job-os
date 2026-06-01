# AI Job OS — Session Context

> **Paste this file at the start of every new session with Claude.**
> Last updated: 2026-05-29 evening session (Phase 2E.3.B wave 2 shipped)

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
- **FREE TIER ONLY.** No paid APIs. No credit cards. Paying a penny for inference is the defeat condition for this project. Every model choice, every architecture decision honors this. If a problem requires paid services to solve, we redesign or accept the constraint — we do not pay.

**Tone of voice** — Direct, calm, never apologetic. No emojis in UI.

**Product principle** — **Never fabricate content.** Resume tailoring rewrites and re-emphasizes, but cannot invent facts. Locked/Tailored split enforces this in architecture. The matcher's signal text is machine-generated from its own logic (not LLM-fabricated). Suggested skill chips surface only what the resume parser extracted — never invented.

---

## 2. WHAT WE'VE BUILT (cumulative — all shipped to main)

- **Foundation (F1-F7):** VISION, ADRs, design tokens, observability, quality gates, command palette (Cmd+K with navigate + theme + sign out)
- **Phase 2A:** 10-table schema, 30 US companies seeded, 12 owner rules
- **Phase 2B:** Supabase Auth + Resend SMTP + DB triggers + auth pages + middleware + onboarding
- **Phase 2C:** Greenhouse + Ashby scrapers, cleanup script, daily cron, per-job parse refactor — 1,337 real US jobs
- **Phase 2D:** LLM provider abstraction, Groq impl with retry+throttle, enrichment orchestrator, CLI, split cron workflows
- **Phase 2E.1:** Schema expansion (UserPreference +7, ResumeVersion +7), expanded Zod, updated Server Actions, resume parser, upload Server Action, CLI smoke test
- **Phase 2E.2.A:** Matcher backend — 6 weighted dimensions, saturating title curve, word-boundary keyword matching, conditional relevance gate, sparsity dampening
- **Phase 2E.2.A-fix:** Per-task LLM model override; enrichment to llama-3.1-8b-instant (5× TPD ceiling); descriptions truncated 4000→2000 chars
- **Phase 2E.2.B:** Match reason generator — batched per-user (one LLM call returns reasons for top-10). 70b after 8b followed style poorly. Integrity rule honored.
- **Phase 2E.3.A:** Functional dashboard at `/dashboard`. Top-10 match cards with score badge, LLM reason, three actions. Server Actions enforce ownership. Empty state with rotating progress phrases + auto-trigger.
- **Phase 2E.3.B wave 1 (2026-05-29 morning):**
  - **Score reveal animation** — 48px circular ring, count-up via `useMotionValue` + `animate()`, spring physics
  - **Autocomplete on ChipInput** — extended with optional `suggestions` prop
  - **Curated suggestion data** — `role-suggestions.ts` (~80 roles), `location-suggestions.ts` (~40 US cities + Remote)
  - **`/settings` hub** — profile header + resume card + activity stats + redesigned preferences form with all 14 UserPreference fields
  - **AppShell + route group migration** — `src/app/(app)/` with shared layout, 220px left nav rail, UserMenu dropdown
  - **Server Action made redirect-configurable** — `savePreferencesAction(input, redirectTo?)` so settings stays on page while onboarding redirects
- **Phase 2E.3.B wave 2 (2026-05-29 evening):**
  - **Stagger-in card entrance** — 80ms stagger via Framer Motion variants on MatchList container; survivors don't re-animate on dismiss (parent hidden→visible transition runs once on mount). New `match-list.tsx` Client Component wraps the cards; page.tsx remains a Server Component.
  - **Why-this-score expandable view** — clickable "Why this score?" link in each card footer reveals matcher's per-dimension breakdown. ScoreBreakdown component renders 6 rows (sorted by weighted contribution desc): label, weighted/max ratio, animated bar (0→score×100%), matcher's signal text ("3/4 job skills in resume"). Bars stagger-fill on expand. Independent per-card state — multiple can be expanded simultaneously.
  - **AI-suggested keywords from parsed resume** — new `SuggestedChipsRow` above the Keywords ChipInput. Surfaces up to 15 skills from `parsedJson.skills` (47 extracted, 15 visible per UI cap). Reactive dedup (case-insensitive) — selecting a chip causes it to fade out via AnimatePresence and appear instantly as a Keywords chip. Outline style differentiates suggestions from selected chips. Honors integrity rule: surfaces only what parser extracted, never invents.

**Total in DB: 1,337 real US jobs. Enrichment backfill running daily via cron, ~120 jobs/day. Approximately 280-300+ jobs enriched under groq-llama-3.1-8b-v2.**

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
- `onboardingComplete` (Boolean default false) — present in schema but NOT used by dashboard gate; dashboard checks `keywords.length > 0` instead

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
Enrichment metadata: `enrichedAt`, `enrichmentVersion` (current: `groq-llama-3.1-8b-v2`)

### UserJobMatch (2E.2 expanded)

Core: `id, userId, jobId, matchScore, status, matchedAt, viewedAt, dismissedAt, dismissed, autoDismissed`
2E.2 fields:

- `scoreBreakdown` (Json?) — per-dimension `{score, signal, weighted}` shape; rendered by ScoreBreakdown component in 2E.3.B wave 2
- `reason` (Text?) — LLM-generated paragraph
- `matchVersion` (String?) — current: `matcher-v1`
- Index: `[userId, matchVersion]`
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

| Decision                        | Value                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **FREE TIER ONLY**              | **No paid APIs ever. Paying a penny is the defeat condition.**                                                                                                           |
| Job TTL                         | 30 days for unmatched jobs                                                                                                                                               |
| UserJobMatch auto-dismiss       | 7 days unviewed                                                                                                                                                          |
| Application archival            | 90 days after rejection                                                                                                                                                  |
| Dedup window                    | 14 days (sha256 of company\|title\|location)                                                                                                                             |
| Cleanup model                   | **User-driven, not time-driven**                                                                                                                                         |
| Repository pattern              | NO — direct Prisma                                                                                                                                                       |
| **AI architecture**             | **Per-task free-tier model selection via `params.model` override**                                                                                                       |
| Enrichment model                | `llama-3.1-8b-instant` (Groq free, 500k TPD)                                                                                                                             |
| Resume parsing model            | `llama-3.3-70b-versatile` (Groq free, quality matters)                                                                                                                   |
| Reason generator model          | `llama-3.3-70b-versatile` (8b followed style poorly)                                                                                                                     |
| Resume tailoring model          | `llama-3.3-70b-versatile` split 50/50 across Groq + Cerebras (planned)                                                                                                   |
| Skill match                     | String intersection (lowercase + word boundary). Embeddings deferred to Phase 2H+.                                                                                       |
| Groq free tier (8b-instant)     | 14,400 RPD / 30,000 TPM / 500,000 TPD                                                                                                                                    |
| Groq free tier (70b)            | 1,000 RPD / 6,000 TPM / 100,000 TPD                                                                                                                                      |
| Enrichment version              | `groq-llama-3.1-8b-v2`                                                                                                                                                   |
| Enrichment throttle             | 500ms between successful jobs                                                                                                                                            |
| Enrichment max_tokens           | 512                                                                                                                                                                      |
| Enrichment truncation           | 2,000 chars                                                                                                                                                              |
| Resume parse version            | `groq-llama-3.3-70b-resume-v2`                                                                                                                                           |
| Resume parse max_tokens         | 4096                                                                                                                                                                     |
| Resume parse truncation         | 12,000 chars                                                                                                                                                             |
| Resume MAX_SKILLS               | 80                                                                                                                                                                       |
| Reason version                  | `groq-llama-3.3-70b-reason-v1`                                                                                                                                           |
| Reason max_tokens               | 2048                                                                                                                                                                     |
| Reason batch size               | 10 jobs per LLM call                                                                                                                                                     |
| Reason per-row length cap       | 900 chars                                                                                                                                                                |
| LLM error handling              | Auth/rate-limit → abort batch; validation/transport → log+continue                                                                                                       |
| LLM cron schedules              | scrape+cleanup 11:00 UTC, enrich 12:00 UTC                                                                                                                               |
| **Master/Tailored split**       | Master locked truth; tailoring rewrites summary/skills/bullets only                                                                                                      |
| Master switching                | Non-destructive (preserve provenance)                                                                                                                                    |
| **Matcher version**             | `matcher-v1`                                                                                                                                                             |
| **Matcher weights**             | titleKeywords=25, skills=20, seniority=15, sponsorship=15, location=15, salary=10                                                                                        |
| **Matcher saturation**          | 1 kw match=0.7, 2=0.9, 3+=1.0                                                                                                                                            |
| **Matcher skill dampen**        | <3 job skills → score scaled by (count/3)                                                                                                                                |
| **Matcher relevance gate**      | Cap at 35 if titleKw=0 AND skills=0 AND both have data                                                                                                                   |
| **Matcher word matching**       | Word-boundary regex                                                                                                                                                      |
| MIN_SCORE_TO_PERSIST            | 40                                                                                                                                                                       |
| **Dashboard onboarding gate**   | `keywords.length > 0` (NOT `onboardingComplete`)                                                                                                                         |
| **Empty state UX**              | Auto-trigger matcher + rotating progress phrases + AnimatePresence                                                                                                       |
| **Action ownership check**      | All match Server Actions filter on BOTH matchId AND userId before mutation                                                                                               |
| **Settings vs onboarding save** | `savePreferencesAction(input, redirectTo)` — settings passes null to stay on page                                                                                        |
| **Route group `(app)/`**        | Shared `AppShell` layout for all authenticated routes; URLs unchanged                                                                                                    |
| **AppShell nav items**          | Dashboard / Applications (coming soon) / Settings                                                                                                                        |
| **Cmd+K command palette**       | Power-user velocity surface (Foundation F7); nav rail is for discovery — both ship together                                                                              |
| **Score ring animation**        | 48px SVG, spring stiffness 120 damping 20, ring + count-up driven by same `useMotionValue`                                                                               |
| **Stagger-in pattern**          | Parent variants `hidden`→`visible` with `staggerChildren: 0.08`; animates once on mount, survivors don't re-animate on re-render                                         |
| **Why-this-score breakdown**    | Inline expand below reason; height 0→auto via AnimatePresence; per-dimension rows sorted by weighted desc; bars stagger-fill 50ms per row; independent per-card state    |
| **Suggested chips integrity**   | Surface only what resume parser extracted into `parsedJson.skills`. Never invent. Cap visible at 15. Reactive dedup (case-insensitive) against current `keywords` state. |
| Resume file types accepted      | PDF + plain text (DOCX deferred); 5 MB max                                                                                                                               |
| Schema strictness               | Strict on fields we use; permissive on metadata                                                                                                                          |

---

## 5. SERVICE ARCHITECTURE

### Scrapers (`src/server/services/scrapers/`)

greenhouse.ts/schema.ts, ashby.ts/schema.ts, location.ts, hash.ts, rules.ts

### AI services (`src/server/services/ai/`)

- `llm.ts` — provider-agnostic interface with per-call `model?` override
- `groq-provider.ts` — Groq impl with retry, timeout, Retry-After
- `enrich.ts` — job enrichment orchestrator
- `parse-resume.ts` — resume parser (no model override; uses provider default 70b)

### Matcher (`src/server/services/matcher/`)

- `score.ts` — pure scoring functions (6 dimensions, weighted composition)
- `filters.ts` — hard pre-filters
- `match.ts` — orchestrator (idempotency, upsert, status preservation)
- `reason.ts` — batched per-user reason generator (70b, integrity rule)

### Server Actions (`src/server/actions/`)

- `auth.ts` — signup/signin/signout (signOutAction is form action)
- `preferences.ts` — savePreferencesAction(input, redirectTo?) — null skips redirect
- `resume.ts` — uploadMasterResumeAction (5MB cap, atomic master-switch)
- `match.ts` — markViewed / dismiss / markApplied / triggerMatcher (all ownership-checked)

### App routes (`src/app/`)

- `/login`, `/signup` (Phase 2B) — outside (app) group
- `/onboarding/preferences` (Phase 2B) — outside (app) group
- `/dashboard` (Phase 2E.3.A + B) — inside (app)/ — daily briefing with stagger-in + score reveal + expandable breakdown
- `/settings` (Phase 2E.3.B) — inside (app)/ — configuration hub with AI-suggested keywords
- Future: `/applications` (Phase 2I), `/onboarding/resume` (Phase 2E.3.B)

### AppShell (`src/app/(app)/`)

- `layout.tsx` — Server Component, single Prisma query, passes email + initial to AppShell
- `_components/app-shell.tsx` — left rail 220px, wordmark, three nav items, UserMenu at bottom
- `_components/user-menu.tsx` — avatar dropdown trigger, opens upward, click-outside + Escape close

### Dashboard components (`src/app/(app)/dashboard/_components/`)

- `match-card.tsx` — score ring + title + reason + Why this score? toggle + actions; optimistic UI; independent expand state
- `match-list.tsx` — Client Component, Framer Motion stagger container; runs once on mount
- `empty-state.tsx` — auto-triggers matcher; cycles 6 progress phrases
- `score-ring.tsx` — 48px SVG ring with count-up animation, prefers-reduced-motion aware
- `score-breakdown.tsx` — six-dimension expandable view with animated bars and matcher's signal text

### Settings components (`src/app/(app)/settings/`)

- `page.tsx` — Server Component shell, profile header + resume card + activity stats + form; extracts and passes `suggestedSkills` from `parsedJson.skills`
- `_components/preferences-form.tsx` — client form with 6 sections, FormSection + RadioCardGroup + SegmentedSelect + SuggestedChipsRow inline components

### Shared (`src/components/onboarding/`)

- `chip-input.tsx` — chip input WITH optional autocomplete (suggestions prop)
- `experience-range.tsx` — segmented experience buttons
- `job-type-select.tsx` — toggle pills for job types
- `preference-toggle.tsx` — switch with label/description (takes `value` not `checked`)

### Data files (`src/shared/data/`)

- `role-suggestions.ts` — curated job titles/skills for ChipInput autocomplete
- `location-suggestions.ts` — curated US cities + Remote

### CLI scripts (`scripts/`)

- `scrape.ts`, `cleanup.ts`, `enrich.ts`
- `parse-resume.ts`, `seed-master-resume.ts`
- `match.ts`, `top-matches.ts`
- `reasons.ts`, `show-reasons.ts`
- `show-breakdown.ts` — dev helper, prints scoreBreakdown JSON for top match
- `show-parsed-skills.ts` — dev helper, prints fileName + skills array from parsed resume
- `undismiss-all.ts` — dev helper to reset matches for repeated testing

### GitHub Actions

- `daily-cron.yml` — 11:00 UTC, 15-min timeout, scrape + cleanup
- `daily-enrich.yml` — 12:00 UTC, 60-min timeout, enrich only

---

## 6. WHAT REMAINS

### Phase 2E.3.B continued (cinematic polish, multi-session, ~8-10h)

Items still remaining (mobile responsive + AI-suggested onboarding + drag-drop resume route all shipped Monday):

1. **Full accessibility pass** — ARIA, keyboard nav, focus management (~3h)
2. **Keyboard shortcuts in dashboard** — save/dismiss/next via keyboard (~2h)
3. **Loading skeletons + error boundaries** at polish level (~2h)
4. **Suggested target roles from resume's currentRole** — same UX as suggested keywords (~1h)
5. **AI-suggested locations from resume.location** — separate ship (~1h)

Note: "Choreographed multi-step onboarding" promoted to dedicated Phase 2E.5 below.

### Phase 2E.4 — ✅ SHIPPED (Monday)

Daily cron now runs enrich → match → reasons sequentially via `daily-enrich.yml`. Both `match.ts --all-users` and `reasons.ts --all-users` are wired in. Product is self-sustaining — new matches appear daily without manual intervention.

### Phase 2E.5 — First-time onboarding flow (PARTIAL SHIP Monday, ~6-10h remaining)

Shipped Monday in one session: schema migration + 3 new routes + real end-to-end resume upload pipeline. New user flow now works: `/onboarding/welcome` → `/onboarding/profile` (firstName + lastName + phone) → `/onboarding/resume` (drag-drop PDF, unpdf extract, Groq 70b parse) → `/onboarding/preferences` (AI-suggested chips from parsed resume) → `/dashboard`.

Already shipped:

- ✅ Schema split: User.name → firstName + lastName + phone (E.164). Backfilled existing row. `prisma db push` workflow.
- ✅ `/onboarding/welcome` — 3-step preview, "Get started" CTA, redirects fully-onboarded users to /dashboard
- ✅ `/onboarding/profile` — server+client split, prefill from existing user, Y-lenient phone normalization (accepts any common format, normalizes to E.164, US +1 default if no country code), Zod validation
- ✅ `/onboarding/resume` — native HTML5 drag-and-drop (no react-dropzone), 5-state state machine (idle/uploading/success/error), drag-counter avoids onDragLeave flicker, calls existing uploadMasterResumeAction
- ✅ PDF parser swap: pdf-parse v2 had a Next.js worker module bug. Replaced with `unpdf` (serverless-friendly, no worker). Updated 3 files: resume.ts action, parse-resume.ts CLI, seed-master-resume.ts CLI.
- ✅ `saveProfileAction` Server Action + `profileSchema` Zod schema with phone normalization

Remaining (~6-10h, dedicated next session):

- **Progress indicator UI** — "Step 2 of 4" header across onboarding routes (~1h)
- **Country picker for phone** — currently defaults to +1 if no country code, but international workers need a proper picker (~2h)
- **Tighten firstName/lastName to non-null** — once new users always go through profile step (~30min migration)
- **Edit personal info section in /settings** — so users can update name/phone after onboarding (~1.5h)
- **DOCX upload support** — currently PDF only, known issue #6 (~2h)
- **Parser prompt tightening** — current parser extracts noise like 'coursera' (cert provider) and 'chrodadb' (misread of 'ChromaDB'). Real quality issue worth fixing. (~1.5h)
- **Routing guard hardening** — what if user uploads, leaves at preferences step, comes back later? (~1h)

### Phase 2F — Vercel deploy (~3-4h)

- env var migration, edge vs node runtime decisions, upload limits, cold-start handling

### Phase 2G — Resume tailoring (Locked/Tailored split, PDF + DOCX, single-page, ATS-friendly)

- Uses `llama-3.3-70b-versatile` split 50/50 Groq + Cerebras
- Add Cerebras provider following same interface

### Phase 2H+ — Email digest, application auto-fill (Playwright), Gmail intelligence

### Phase 2I — Application tracker

- New `/applications` route (nav placeholder already in AppShell)
- Kanban or list view with status (applied → interview → offer → rejected)
- Notes per application, dates, analytics

---

## 7. KNOWN ISSUES (live, accepted)

1. **Null bytes** — ~0.3% of Greenhouse jobs. Stripped at write; nested JSON occasionally slips. Accepted.
2. **Coinbase** — Greenhouse 404 from GH Actions IPs.
3. **Linear/Supabase (ashby)** — non-US, correctly rejected.
4. **GitHub Actions Node 20 deprecation** — June 2026, bump actions/checkout + actions/setup-node.
5. **Non-technical roles return `skills: []`** — ~60% of jobs. Matcher conditional relevance gate handles correctly.
6. **DOCX resume upload** — not implemented, clear error returned. Phase 2E.5 continued work.
7. **Dashboard greeting falls back to email prefix when User.firstName is null** — acceptable until firstName tightened to non-null in Phase 2E.5 continued.
8. **Enrichment log misleading** — `log.model` shows provider default (70b) while API actually receives override (8b-instant). Cosmetic only.
9. **Hydration warning from Grammarly browser extension** — dev-only, cosmetic.
10. **Settings page resume card is read-only** — drag-drop upload exists at /onboarding/resume but not yet wired into /settings as a "replace resume" surface. Phase 2E.5 continued work.
11. **Resume parser extracts noise** — pulls cert providers ('coursera') and misreads ('chrodadb' for 'ChromaDB') as skills. Parser prompt tightening is Phase 2E.5 continued work.
12. **pdf-parse v2 incompatible with Next.js bundled runtime** — fake worker .mjs module not found at runtime. Resolved Monday by switching to unpdf (serverless-friendly). Documented for future reference if anyone considers swapping back.
13. **Cron cleanup occasionally times out on cold-start connection.** Self-healing on next run. Free-tier Supabase behavior, accepted.
14. **LLM enrichment quality during v3 backfill** — v2 hallucinated tech skills on non-technical roles got bumped to v3 with tightened prompt (Monday). Re-enrichment runs ~120/day via cron, ~4 days for full backfill. Old v2 hallucinated matches will linger on dashboard until each job's v3 re-enrichment lands.

### Recently resolved

- ✅ Phase 2D shipped (LLM abstraction, Groq, enrichment, CLI, cron)
- ✅ Phase 2E.1 backend shipped (resume parser + upload)
- ✅ Phase 2E.2.A backend shipped (matcher engine)
- ✅ Phase 2E.2.A-fix: enrichment model switch + truncation
- ✅ Phase 2E.2.B shipped (reason generator)
- ✅ Phase 2E.3.A shipped (functional dashboard)
- ✅ Phase 2E.3.B wave 1 (score reveal + autocomplete + settings hub + AppShell + route migration)
- ✅ Phase 2E.3.B wave 2 (stagger-in + why-this-score expandable + AI-suggested keywords)
- ✅ Phase 2E.4 shipped Monday (cron wires matcher + reasons after enrichment)
- ✅ Prefs overwrite prevention shipped Monday (schema min(3) keywords + form dirty-field counter)
- ✅ Enrichment v3 shipped Monday (tightened prompt, stops LLM hallucinating skills on non-technical roles)
- ✅ Phase 2E.3.B mobile responsive shipped Monday (AppShell hamburger + dashboard + settings)

---

## 8. CRITICAL FILES (current repo state)

| Concern              | Path                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Front door           | `README.md`                                                                                                                                                 |
| System map           | `ARCHITECTURE.md`                                                                                                                                           |
| Working rhythm       | `COLLABORATION.md`                                                                                                                                          |
| Build narrative      | `AI_JOB_OS_SESSION_JOURNAL.md`                                                                                                                              |
| Vision               | `VISION.md`                                                                                                                                                 |
| Decisions            | `docs/adr/*.md`                                                                                                                                             |
| Design DNA           | `docs/design/principles.md`                                                                                                                                 |
| Cron runbook         | `docs/runbooks/cron.md`                                                                                                                                     |
| Design tokens        | `src/styles/tokens.ts`, `src/app/globals.css`                                                                                                               |
| Prisma schema        | `prisma/schema.prisma`                                                                                                                                      |
| SQL triggers         | `prisma/sql/0001_auth_signup_trigger.sql`                                                                                                                   |
| Auth                 | `src/server/actions/auth.ts`, `src/app/login/*`, `src/app/signup/*`, `middleware.ts`                                                                        |
| Preferences action   | `src/server/actions/preferences.ts` (takes optional redirectTo)                                                                                             |
| Onboarding form      | `src/app/onboarding/preferences/page.tsx` (still uses default /dashboard redirect)                                                                          |
| AppShell layout      | `src/app/(app)/layout.tsx`                                                                                                                                  |
| AppShell components  | `src/app/(app)/_components/{app-shell,user-menu}.tsx`                                                                                                       |
| Dashboard route      | `src/app/(app)/dashboard/page.tsx`                                                                                                                          |
| Dashboard components | `src/app/(app)/dashboard/_components/{match-card,match-list,empty-state,score-ring,score-breakdown}.tsx`                                                    |
| Settings route       | `src/app/(app)/settings/page.tsx`                                                                                                                           |
| Settings form        | `src/app/(app)/settings/_components/preferences-form.tsx`                                                                                                   |
| Match Server Actions | `src/server/actions/match.ts`                                                                                                                               |
| Resume upload action | `src/server/actions/resume.ts`                                                                                                                              |
| Resume parser        | `src/server/services/ai/parse-resume.ts`                                                                                                                    |
| Zod schemas          | `src/shared/schemas/preferences.ts`                                                                                                                         |
| Suggestion data      | `src/shared/data/{role,location}-suggestions.ts`                                                                                                            |
| Reusable inputs      | `src/components/onboarding/{chip-input,experience-range,job-type-select,preference-toggle}.tsx`                                                             |
| Command palette      | `src/components/command-palette.tsx`                                                                                                                        |
| Scrapers             | `src/server/services/scrapers/{greenhouse,ashby,location,hash,rules}.ts`                                                                                    |
| LLM provider         | `src/server/services/ai/{llm,groq-provider}.ts`                                                                                                             |
| Job enrichment       | `src/server/services/ai/enrich.ts`                                                                                                                          |
| Matcher              | `src/server/services/matcher/{score,filters,match,reason}.ts`                                                                                               |
| CLIs                 | `scripts/{scrape,cleanup,enrich,parse-resume,seed-master-resume,match,top-matches,reasons,show-reasons,show-breakdown,show-parsed-skills,undismiss-all}.ts` |
| GitHub Actions       | `.github/workflows/{daily-cron,daily-enrich}.yml`                                                                                                           |

---

## 9. HOW TO RESUME

Start a new session with:

> "Read CONTEXT.md first. Confirm schema field names before any code. Free-tier-only is a locked decision — never propose paid APIs."

Then paste CONTEXT.md (or load it via Claude Projects — see Section 10).

I will:

1. Re-read the bar (especially the FREE TIER ONLY rule)
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

Today (2026-05-29 evening) shipped: stagger-in card entrance, why-this-score expandable view, AI-suggested keywords from parsed resume. Three commits to main. Dashboard now feels properly cinematic on every load — cards cascade in, scores reveal, breakdowns expand on demand. Settings form actively surfaces what the system knows about the user.

**Next session priorities:**

1. **Verify enrichment backfill progress.** Check job count where `enrichmentVersion = "groq-llama-3.1-8b-v2"`. Tracking ~120/day, should reach full ~1,300 by ~June 5-6.
2. **Re-run matcher with `--force --all-users`** to repopulate against newly-enriched data. Expect more matches per user and higher top scores as data densifies.
3. **Re-run reasons with `--force --all-users --limit=10`** for newly-promoted matches.
4. **Phase 2E.3.B wave 3 — pick in order of impact:**
   - **Mobile responsive** — biggest remaining gap, real users on phones (~6h, can split across sessions)
   - **Suggested target roles from currentRole** — quick win pairing with today's AI-suggested keywords (~1h)
   - **Proper /onboarding/resume route** with drag-drop (~3h)
5. **Phase 2E.4 — wire matcher + reasons to daily cron** (~2h)
6. **Phase 2I — application tracker** — the nav item placeholder needs a real route eventually

**Not on critical path:**

- Cerebras provider (Phase 2G dependency)
- Vercel deploy (Phase 2F)
- Resume tailoring (Phase 2G)

**Reflection notes for future sessions:**

Today's pattern continued working: budget honestly (6h given), use what's needed (~2.5h actual), ship clean, stop. Three of today's items came in dramatically under estimate because the architecture from previous sessions was already in place — design tokens, motion patterns, the score breakdown data, the parsed resume data. **Discipline compounds. Decisions made well in earlier sessions made today's session fast.**

Two specific patterns worth remembering:

1. **Multi-line Node `-e` scripts have backtick escape problems.** Write `.mjs` scripts to disk instead, then `node /tmp/patch.mjs`. Safer for multi-anchor patches.
2. **Commitlint enforces subject-case lowercase.** "ai-suggested" not "AI-suggested" in commit subjects, even when the feature name uses caps.

---
