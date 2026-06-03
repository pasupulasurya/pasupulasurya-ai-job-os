# AI Job OS — Session Context

> **Paste this file at the start of every new session with Claude.**
> Last updated: 2026-06-02 evening session (parser architectural fix + Phase 2E.5 polish shipped)

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

`id, authId, email (unique), firstName, lastName, phone, role, createdAt, updatedAt`

- `firstName`, `lastName` non-null (tightened 2026-06-02); `phone` nullable E.164 (US +1 default normalization)
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
- `parsedAt` (DateTime?), `parseVersion` (String?) — current: `groq-llama-3.3-70b-resume-v3`
- `fileName` (String?), `fileSize` (Int?)
- Indexes: `[userId]`, `[userId, isMaster]`

### UserBlockedCompany

`id, userId, companyId, reason, blockedAt`

### Log

`id, action, payload, level, createdAt`

---

## 4. LOCKED DECISIONS (do not re-discuss)

| Decision                          | Value                                                                                                                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **FREE TIER ONLY**                | **No paid APIs ever. Paying a penny is the defeat condition.**                                                                                                                                                                                                           |
| Job TTL                           | 30 days for unmatched jobs                                                                                                                                                                                                                                               |
| UserJobMatch auto-dismiss         | 7 days unviewed                                                                                                                                                                                                                                                          |
| Application archival              | 90 days after rejection                                                                                                                                                                                                                                                  |
| Dedup window                      | 14 days (sha256 of company\|title\|location)                                                                                                                                                                                                                             |
| Cleanup model                     | **User-driven, not time-driven**                                                                                                                                                                                                                                         |
| Repository pattern                | NO — direct Prisma                                                                                                                                                                                                                                                       |
| **AI architecture**               | **Per-task free-tier model selection via `params.model` override**                                                                                                                                                                                                       |
| Enrichment model                  | `llama-3.1-8b-instant` (Groq free, 500k TPD)                                                                                                                                                                                                                             |
| Resume parsing model              | `llama-3.3-70b-versatile` (Groq free, quality matters)                                                                                                                                                                                                                   |
| Reason generator model            | `llama-3.3-70b-versatile` (8b followed style poorly)                                                                                                                                                                                                                     |
| Resume tailoring model            | `llama-3.3-70b-versatile` split 50/50 across Groq + Cerebras (planned)                                                                                                                                                                                                   |
| Skill match                       | String intersection (lowercase + word boundary). Embeddings deferred to Phase 2H+.                                                                                                                                                                                       |
| Groq free tier (8b-instant)       | 14,400 RPD / 30,000 TPM / 500,000 TPD                                                                                                                                                                                                                                    |
| Groq free tier (70b)              | 1,000 RPD / 6,000 TPM / 100,000 TPD                                                                                                                                                                                                                                      |
| Enrichment version                | `groq-llama-3.1-8b-v3` (bumped Mon after tightened anti-hallucination prompt; v2 re-enrich runs ~120/day for ~4 days)                                                                                                                                                    |
| Enrichment throttle               | 500ms between successful jobs                                                                                                                                                                                                                                            |
| Enrichment max_tokens             | 512                                                                                                                                                                                                                                                                      |
| Enrichment truncation             | 2,000 chars                                                                                                                                                                                                                                                              |
| Resume parse version              | `groq-llama-3.3-70b-resume-v3` (bumped 2026-06-02 alongside code-side blocklist+canonical-map cleaning)                                                                                                                                                                  |
| Resume parse max_tokens           | 4096                                                                                                                                                                                                                                                                     |
| Resume parse truncation           | 12,000 chars                                                                                                                                                                                                                                                             |
| Resume MAX_SKILLS                 | 80                                                                                                                                                                                                                                                                       |
| Reason version                    | `groq-llama-3.3-70b-reason-v1`                                                                                                                                                                                                                                           |
| Reason max_tokens                 | 2048                                                                                                                                                                                                                                                                     |
| Reason batch size                 | 10 jobs per LLM call                                                                                                                                                                                                                                                     |
| Reason per-row length cap         | 900 chars                                                                                                                                                                                                                                                                |
| LLM error handling                | Auth/rate-limit → abort batch; validation/transport → log+continue                                                                                                                                                                                                       |
| LLM cron schedules                | scrape+cleanup 11:00 UTC, enrich 12:00 UTC                                                                                                                                                                                                                               |
| **Master/Tailored split**         | Master locked truth; tailoring rewrites summary/skills/bullets only                                                                                                                                                                                                      |
| Master switching                  | Non-destructive (preserve provenance)                                                                                                                                                                                                                                    |
| **Matcher version**               | `matcher-v1`                                                                                                                                                                                                                                                             |
| **Matcher weights**               | titleKeywords=25, skills=20, seniority=15, sponsorship=15, location=15, salary=10                                                                                                                                                                                        |
| **Matcher saturation**            | 1 kw match=0.7, 2=0.9, 3+=1.0                                                                                                                                                                                                                                            |
| **Matcher skill dampen**          | <3 job skills → score scaled by (count/3)                                                                                                                                                                                                                                |
| **Matcher relevance gate**        | Cap at 35 if titleKw=0 AND skills=0 AND both have data                                                                                                                                                                                                                   |
| **Matcher word matching**         | Word-boundary regex                                                                                                                                                                                                                                                      |
| MIN_SCORE_TO_PERSIST              | 40                                                                                                                                                                                                                                                                       |
| **Min preference keywords**       | 3 (was 1; bumped Mon after overwrite incident — schema rejects fewer with explanatory error)                                                                                                                                                                             |
| **PDF text extraction**           | `unpdf` (serverless-friendly, no worker). Replaced pdf-parse v2 Mon (Next.js worker .mjs not found at runtime).                                                                                                                                                          |
| **Phone validation**              | Y-lenient: accept any common format on input, normalize to E.164 in Zod transform (strip non-digits, prepend +1 if no leading +). Empty becomes null.                                                                                                                    |
| **Drag-drop pattern**             | Native HTML5 onDragEnter/Leave/Over/Drop. `useRef` counter avoids onDragLeave flicker when entering child elements. No react-dropzone dep.                                                                                                                               |
| **Upload state machine**          | 4 discriminated-union states: `idle` \| `uploading` \| `success` \| `error`. AnimatePresence drives state transitions with spring.snappy.                                                                                                                                |
| **Mobile breakpoints**            | `md` (768px) for nav rail collapse; `sm` (640px) for content stacking. Hamburger top bar appears below md.                                                                                                                                                               |
| **Mobile nav menu**               | Slide-in panel from left, 280px wide, dimmed backdrop (bg-black/60). Body scroll-lock while open. Escape + backdrop tap + nav item tap all close.                                                                                                                        |
| **Score ring mobile**             | 40px above title on mobile (own row, right-aligned); 48px right of title on desktop. ScoreRing accepts `size?` prop, two instances with md:hidden / hidden md:block.                                                                                                     |
| **Dashboard onboarding gate**     | `keywords.length > 0` (NOT `onboardingComplete`)                                                                                                                                                                                                                         |
| **Empty state UX**                | Auto-trigger matcher + rotating progress phrases + AnimatePresence                                                                                                                                                                                                       |
| **Action ownership check**        | All match Server Actions filter on BOTH matchId AND userId before mutation                                                                                                                                                                                               |
| **Settings vs onboarding save**   | `savePreferencesAction(input, redirectTo)` — settings passes null to stay on page                                                                                                                                                                                        |
| **Route group `(app)/`**          | Shared `AppShell` layout for all authenticated routes; URLs unchanged                                                                                                                                                                                                    |
| **AppShell nav items**            | Dashboard / Applications (coming soon) / Settings                                                                                                                                                                                                                        |
| **Cmd+K command palette**         | Power-user velocity surface (Foundation F7); nav rail is for discovery — both ship together                                                                                                                                                                              |
| **Score ring animation**          | 48px SVG, spring stiffness 120 damping 20, ring + count-up driven by same `useMotionValue`                                                                                                                                                                               |
| **Stagger-in pattern**            | Parent variants `hidden`→`visible` with `staggerChildren: 0.08`; animates once on mount, survivors don't re-animate on re-render                                                                                                                                         |
| **Why-this-score breakdown**      | Inline expand below reason; height 0→auto via AnimatePresence; per-dimension rows sorted by weighted desc; bars stagger-fill 50ms per row; independent per-card state                                                                                                    |
| **Suggested chips integrity**     | Surface only what resume parser extracted into `parsedJson.skills`. Never invent. Cap visible at 15. Reactive dedup (case-insensitive) against current `keywords` state.                                                                                                 |
| **Skill cleaning architecture**   | LLM extracts everything verbatim; cleaning happens in code via `SKILL_BLOCKLIST` (Set) and `SKILL_CANONICAL` (Record) in `parse-resume.ts`. Deterministic, auditable, generalizes via blocklist; canonical map currently personalized to one user's corruption patterns. |
| **Onboarding progress indicator** | Thin horizontal bar (4px tall, max-w-md), bg-border track + bg-accent fill, width = (current/total)\*100. Spring.snappy fill animation on mount. Step label + percentage in text-xs uppercase tracking-widest below bar.                                                 |
| **AuthShell header prop**         | Optional `header?: ReactNode` slot between brand mark and title block in `auth-shell.tsx`. Centered alignment. Used by onboarding routes to inject progress indicator. Backward compatible — pages without `header` render unchanged.                                    |
| Resume file types accepted        | PDF + plain text (DOCX deferred); 5 MB max                                                                                                                                                                                                                               |
| Schema strictness                 | Strict on fields we use; permissive on metadata                                                                                                                                                                                                                          |

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
- `profile.ts` — saveProfileAction (firstName/lastName/phone, Zod-normalized phone to E.164)
- `resume.ts` — uploadMasterResumeAction (5MB cap, atomic master-switch, unpdf extraction)
- `match.ts` — markViewed / dismiss / markApplied / triggerMatcher (all ownership-checked)

### App routes (`src/app/`)

- `/login`, `/signup` (Phase 2B) — outside (app) group
- `/onboarding/welcome` (Phase 2E.5) — outside (app); 3-step preview, "Get started" CTA, redirects fully-onboarded users to /dashboard
- `/onboarding/profile` (Phase 2E.5) — outside (app); firstName + lastName + phone collection with Y-lenient normalization
- `/onboarding/resume` (Phase 2E.5) — outside (app); native HTML5 drag-drop + click-to-browse, 4-state state machine, calls uploadMasterResumeAction
- `/onboarding/preferences` (Phase 2B + 2E.3.B) — outside (app); 8-field form with AI-suggested chips from parsedJson.skills
- `/dashboard` (Phase 2E.3.A + B) — inside (app)/ — daily briefing with stagger-in + score reveal + expandable breakdown
- `/settings` (Phase 2E.3.B) — inside (app)/ — configuration hub with AI-suggested keywords + dirty field counter
- Future: `/applications` (Phase 2I)

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

- `page.tsx` — Server Component shell, profile header + personal info edit + resume card + activity stats + form; extracts and passes `suggestedSkills` from `parsedJson.skills`
- `_components/personal-info-section.tsx` — Client Component, read-only view by default with Edit toggle; edit mode shows firstName/lastName/phone inputs, useTransition save via saveProfileAction, AnimatePresence between view/edit modes
- `_components/preferences-form.tsx` — client form with 6 sections, FormSection + RadioCardGroup + SegmentedSelect + SuggestedChipsRow inline components

### Shared (`src/components/onboarding/`)

- `chip-input.tsx` — chip input WITH optional autocomplete (suggestions prop)
- `experience-range.tsx` — segmented experience buttons
- `job-type-select.tsx` — toggle pills for job types
- `preference-toggle.tsx` — switch with label/description (takes `value` not `checked`)
- `progress.tsx` — 4px-tall horizontal bar, max-w-md, bg-border track + bg-accent fill; `current` (1-indexed) / `total` props compute pct; spring.snappy fill animation on mount; step label + percentage row below in uppercase tracking-widest

### Onboarding components (`src/app/onboarding/`)

- `welcome/page.tsx` — Server Component, 3-step preview cards with numbered circles + icons, completion-check redirect
- `profile/page.tsx` — Server Component, prefill from existing user, renders `<ProfileClientForm>`
- `profile/_components/profile-client-form.tsx` — Client form, useTransition save, motion.button with isPending spinner
- `resume/page.tsx` — Server Component, fetches existing master fileName, renders `<ResumeUploadForm>`
- `resume/_components/resume-upload-form.tsx` — Native HTML5 drag-drop, 4-state state machine, AnimatePresence transitions
- `preferences/page.tsx` — Server Component, computes suggestedSkills from parsedJson, renders `<PreferencesClientForm>`
- `preferences/_components/preferences-client-form.tsx` — Client form, inline SuggestedChipsRow above Keywords ChipInput

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
- `show-prefs.ts` — dev helper, prints UserPreference row as JSON
- `show-bad-match.ts` — dev helper, prints job + match breakdown for a low-quality match
- `show-cluster.ts` — dev helper, lists matches in a score range with skills arrays
- `match-diagnostics.ts` — dev helper, total/enriched counts + match score distribution
- `test-enrich-prompt.ts` — A/B tests enrichment prompts against known-bad DB jobs without DB writes
- `undismiss-all.ts` — dev helper to reset matches for repeated testing

### GitHub Actions

- `daily-cron.yml` — 11:00 UTC, 15-min timeout, scrape + cleanup
- `daily-enrich.yml` — 12:00 UTC, 60-min timeout, runs enrich → match → reasons sequentially

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

### Phase 2E.5 — First-time onboarding flow (MOSTLY SHIPPED, ~5h remaining)

Phase 2E.5 covers the new-user onboarding pipeline. Schema, routes, and most polish are shipped. End-to-end working: `/onboarding/welcome` → `/onboarding/profile` (firstName + lastName + phone) → `/onboarding/resume` (drag-drop PDF, unpdf extract, Groq 70b parse) → `/onboarding/preferences` (AI-suggested chips from parsed resume) → `/dashboard`.

Already shipped:

- ✅ Schema split: User.name → firstName + lastName + phone (E.164). Backfilled existing row. `prisma db push` workflow. (Monday)
- ✅ `/onboarding/welcome` — 3-step preview, "Get started" CTA, redirects fully-onboarded users to /dashboard (Monday)
- ✅ `/onboarding/profile` — server+client split, prefill from existing user, Y-lenient phone normalization (accepts any common format, normalizes to E.164, US +1 default if no country code), Zod validation (Monday)
- ✅ `/onboarding/resume` — native HTML5 drag-and-drop (no react-dropzone), 4-state state machine (idle/uploading/success/error), drag-counter avoids onDragLeave flicker, calls existing uploadMasterResumeAction (Monday)
- ✅ PDF parser swap: pdf-parse v2 had a Next.js worker module bug. Replaced with `unpdf` (serverless-friendly, no worker). Updated 3 files: resume.ts action, parse-resume.ts CLI, seed-master-resume.ts CLI. (Monday)
- ✅ `saveProfileAction` Server Action + `profileSchema` Zod schema with phone normalization (Monday)
- ✅ Edit personal info in /settings — new PersonalInfoSection Client Component with view/edit toggle, useTransition save (Tuesday)
- ✅ Progress indicator UI across all four onboarding routes — thin bar + step label + percentage, AuthShell now accepts `header` prop (Tuesday)
- ✅ Tighten User.firstName/lastName to non-null — schema migration + removed email-prefix fallbacks in dashboard/settings greetings (Tuesday)
- ✅ Parser prompt tightening — became architectural fix: LLM extracts everything verbatim, code-side `SKILL_BLOCKLIST` + `SKILL_CANONICAL` clean output. RESUME_PARSE_VERSION bumped v2 → v3. Test harness at `scripts/test-parse-prompt.ts`. (Tuesday)

Remaining (~5h, future sessions):

- **Country picker for phone** — currently defaults to +1 if no country code, but international workers need a proper picker. Curated country list with dial codes + searchable dropdown. (~2h)
- **DOCX upload support** — currently PDF only, known issue #6. Mammoth or similar for .docx text extraction. (~2h)
- **Routing guard hardening** — what if user uploads, leaves at preferences step, comes back later? Currently the welcome page redirect handles fully-onboarded users, but partial-completion edge cases aren't all covered. (~1h)
- **Fuzzy-matching whitelist for parser cleaning** (post-deploy work) — replace the personalized `SKILL_CANONICAL` map with Levenshtein-distance matching against a curated known-technologies whitelist (~5000 entries). Generalizes cleanly to any user's OCR errors. Deferred until real user data informs tuning. (~4-6h)

### Phase 2F — Vercel deploy (~3-4h)

- env var migration, edge vs node runtime decisions, upload limits, cold-start handling

### Phase 2G — Resume tailoring (multi-session, ~25-35h total)

**Product thesis:**

A match score of 60% means the job is worth pursuing — but the missing 40% is what gets the resume screened out. Resume tailoring closes that gap not by lying, but by surfacing relevant truth that the master resume buries beneath other content. The tailored resume must convince two readers:

1. **The ATS keyword parser** — keyword density on job-required skills, role-title alignment, technologies surfaced in the first half of the document
2. **A senior recruiter with decades of experience** — readable, credible, no obvious AI noise, no fabricated claims that fall apart under questioning

The bar: a senior recruiter reading the tailored resume should think "yeah, this person fits" — not "this was clearly AI-generated."

**What the LLM CAN change (allowed transformations):**

- Reorder skills array to put job-relevant skills first
- Reorder work history bullets within a role to emphasize matching experience
- Rewrite the summary/objective to use the job's terminology — but every claim must trace to master content
- Rewrite individual bullet text to use job's vocabulary (e.g., "machine learning models" -> "ML/AI systems" if the job uses that phrasing) — but the underlying fact must exist in master
- Decide which 6-10 bullets per role get included (single-page constraint forces selection)
- Truncate/select which work history rows to include if too long for one page

**What the LLM CANNOT change (forbidden — produces fabrication):**

- Add a skill not present in master.parsedJson.skills
- Add a bullet that doesn't trace to a master bullet (1:1 or split allowed; invention forbidden)
- Change a company name, job title, or dates
- Change education details (school, degree, dates)
- Claim experience the master doesn't claim

**The hard problem: verification, not generation.**

Generation is the easy 30%. The hard 70% is detecting when the LLM crosses the line into fabrication. The architecture must catch this BEFORE the user sees fabricated content.

**Architecture:**

1. **TailoredResume model** (new Prisma table):
   - id, userId, masterResumeId (FK), jobId (FK), createdAt, updatedAt
   - tailoredJson (parsedJson shape, same schema as master)
   - changesJson (structured diff against master)
   - userOverridesJson (per-change accept/revert state)
   - status: "draft" | "accepted" | "downloaded"
   - llmModel, llmVersion (provenance)

2. **Generation flow** (Server Action: `tailorResumeForMatch(matchId)`):
   - Load master.parsedJson + job (title + description + extractedSkills from enrichment)
   - LLM call with system prompt: "rewrite this resume for this job, following these rules: [allowed/forbidden list]"
   - LLM returns tailoredJson in same parsedJson shape
   - **Verification pass (the critical step):**
     - Every skill in tailoredJson.skills MUST exist (case-insensitive) in masterJson.skills. Reject otherwise.
     - Every bullet in tailoredJson.workHistory MUST be derivable from a master bullet — use string similarity (Levenshtein or cosine over embeddings) with a threshold. Bullets below threshold are flagged as "possibly fabricated."
     - Every company + title + date triple must match a master row exactly.
   - If verification fails on >0 fabrication flags: either auto-retry with stronger constraints, or surface to user as "AI produced fabrication, please regenerate."
   - **Structural diff computation:**
     - Mechanical comparison master.parsedJson vs tailoredJson — NOT LLM self-report
     - Produces changesJson: array of typed changes
       - { type: "skill_reorder", old: [...], new: [...] }
       - { type: "skill_added_from_master", skill: "..." } (allowed)
       - { type: "skill_removed", skill: "..." } (allowed — they didn't include it)
       - { type: "bullet_reword", company, title, bulletIndex, oldText, newText, similarity }
       - { type: "bullet_reorder", company, title, oldOrder: [0,1,2], newOrder: [2,0,1] }
       - { type: "summary_rewrite", oldText, newText }
       - { type: "section_omitted", section: "education[2]" } (single-page constraint)
   - Persist tailoredJson + changesJson to TailoredResume row

3. **UI: `/dashboard/tailor/[matchId]` route** (new):
   - Two clean documents side-by-side: master (left, read-only), tailored (right, editable)
   - Each rendered from parsedJson — NOT raw PDF text — so they look identical in style
   - Below: "What changed" panel — list of changes from changesJson
   - Each change has: "Keep" (default) and "Revert to master" buttons
   - Reverting a change updates the tailored render in real time (client state, persisted to userOverridesJson on save)
   - Bottom buttons:
     - "Regenerate" — calls tailorResumeForMatch again with fresh LLM call
     - "Download PDF" — renders tailoredJson with applied user overrides to PDF (using existing PDF skill or a new renderer)
     - "Download DOCX" — same, DOCX output (Phase 2G.2, later)

4. **LLM strategy:**
   - Primary: `llama-3.3-70b-versatile` (current)
   - Once Cerebras provider added: split 50/50 across Groq and Cerebras for daily quota expansion
   - Verification is the limiter, not generation — even if quota constrains us to 10 tailorings/day, that's plenty for the early phase

**Sub-phases:**

- **Phase 2G.0** (~2-3h): Cerebras provider implementing LLMProvider interface, same shape as Groq. Free-tier quota check. No tailoring yet, just the provider.
- **Phase 2G.1** (~10-12h): TailoredResume table + tailorResumeForMatch action + verification pass + structural diff computation. Test against 5-10 jobs from current dashboard. No UI yet, just the engine.
- **Phase 2G.2** (~8-10h): /dashboard/tailor/[matchId] route, side-by-side preview from parsedJson, "what changed" panel with per-change revert, real-time tailored re-render on revert.
- **Phase 2G.3** (~5-8h): PDF rendering from tailoredJson using existing PDF skill. ATS-friendly layout (no multi-column tricks, no fancy fonts, semantic structure). Download flow.
- **Phase 2G.4** (~3-5h, optional): DOCX rendering. Same content, .docx output for users who need to upload to ATS systems that prefer DOCX.

**Failure modes to handle:**

- LLM produces tailored content that doesn't fit on one page → render shows overflow warning, suggest user remove some bullets
- LLM fabricates a skill → verification catches, blocks save, surfaces to user
- LLM removes a critical bullet user wanted → "Revert this change" puts it back
- ATS parser still rejects → out of scope for v1, document as known limitation, log which job's ATS failed for future research

**Dependencies (must ship before Phase 2G.1 can start):**

- Phase 2F (Vercel deploy) — tailoring is a feature users do on production, not localhost
- Cerebras provider (Phase 2G.0) — for 70b quota capacity
- v3 enrichment backfill complete — for high-quality skills array on job rows that tailoring will target

**Not in scope for Phase 2G (deferred to Phase 2H+):**

- Auto-apply (Playwright automation submitting the tailored resume) — separate massive phase
- Resume version history beyond master + most-recent-tailored — keep it simple
- Multi-master support (different masters for different career tracks)
- A/B testing different tailoring strategies — too early, no signal yet

**Defining "done" for Phase 2G:**

A user can click a match on their dashboard, click "Tailor for this job," see the master and tailored versions side-by-side with all changes highlighted, revert any change they disagree with, and download a clean PDF that a senior recruiter would read and not immediately suspect was AI-generated. Verification catches 100% of fabricated skills and >95% of fabricated bullets (measured against a hand-labeled test set of 50 generations).

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
7. **Enrichment log misleading** — `log.model` shows provider default (70b) while API actually receives override (8b-instant). Cosmetic only.
8. **Hydration warning from Grammarly browser extension** — dev-only, cosmetic.
9. **Settings page resume card is read-only** — drag-drop upload exists at /onboarding/resume but not yet wired into /settings as a "replace resume" surface. Phase 2E.5 continued work.
10. **pdf-parse v2 incompatible with Next.js bundled runtime** — fake worker .mjs module not found at runtime. Resolved Monday by switching to unpdf (serverless-friendly). Documented for future reference if anyone considers swapping back.
11. **Cron cleanup occasionally times out on cold-start connection.** Self-healing on next run. Free-tier Supabase behavior, accepted.
12. **LLM enrichment quality during v3 backfill** — v2 hallucinated tech skills on non-technical roles got bumped to v3 with tightened prompt (Monday). Re-enrichment runs ~120/day via cron, ~4 days for full backfill. Old v2 hallucinated matches will linger on dashboard until each job's v3 re-enrichment lands.

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
- ✅ AI-suggested keywords on onboarding form shipped Monday (server+client split on /onboarding/preferences)
- ✅ Phase 2E.5 partial shipped Monday (User schema split + welcome + profile + drag-drop resume upload, all end-to-end with unpdf + 70b parse)
- ✅ Edit personal info in /settings shipped Tuesday (PersonalInfoSection with view/edit toggle, useTransition save, AnimatePresence transitions)
- ✅ Parser architectural fix shipped Tuesday (SKILL_BLOCKLIST + SKILL_CANONICAL code-side cleaning, RESUME_PARSE_VERSION v2→v3, test harness for A/B verification)
- ✅ Phase 2G architectural spec documented Tuesday (expanded from 4-line placeholder to full 5-sub-phase plan, ~25-35h total estimate)
- ✅ Onboarding progress indicator shipped Tuesday (thin bar across all 4 routes, AuthShell.header prop)
- ✅ User.firstName + lastName tightened to non-null Tuesday (schema migration + email-prefix fallback removed from dashboard + settings)

---

## 8. CRITICAL FILES (current repo state)

| Concern              | Path                                                                                                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Front door           | `README.md`                                                                                                                                                                                                                             |
| System map           | `ARCHITECTURE.md`                                                                                                                                                                                                                       |
| Working rhythm       | `COLLABORATION.md`                                                                                                                                                                                                                      |
| Build narrative      | `AI_JOB_OS_SESSION_JOURNAL.md`                                                                                                                                                                                                          |
| Vision               | `VISION.md`                                                                                                                                                                                                                             |
| Decisions            | `docs/adr/*.md`                                                                                                                                                                                                                         |
| Design DNA           | `docs/design/principles.md`                                                                                                                                                                                                             |
| Cron runbook         | `docs/runbooks/cron.md`                                                                                                                                                                                                                 |
| Design tokens        | `src/styles/tokens.ts`, `src/app/globals.css`                                                                                                                                                                                           |
| Prisma schema        | `prisma/schema.prisma`                                                                                                                                                                                                                  |
| SQL triggers         | `prisma/sql/0001_auth_signup_trigger.sql`                                                                                                                                                                                               |
| Auth                 | `src/server/actions/auth.ts`, `src/app/login/*`, `src/app/signup/*`, `middleware.ts`                                                                                                                                                    |
| Preferences action   | `src/server/actions/preferences.ts` (takes optional redirectTo)                                                                                                                                                                         |
| Profile action       | `src/server/actions/profile.ts` (saveProfileAction with Zod-normalized phone)                                                                                                                                                           |
| Onboarding prefs     | `src/app/onboarding/preferences/{page,_components/preferences-client-form}.tsx` (server+client split, suggested chips)                                                                                                                  |
| Onboarding welcome   | `src/app/onboarding/welcome/page.tsx` (3-step preview, completion check)                                                                                                                                                                |
| Onboarding profile   | `src/app/onboarding/profile/{page,_components/profile-client-form}.tsx` (firstName/lastName/phone with Y-lenient normalization)                                                                                                         |
| Onboarding resume    | `src/app/onboarding/resume/{page,_components/resume-upload-form}.tsx` (native HTML5 drag-drop, 4-state machine)                                                                                                                         |
| AppShell layout      | `src/app/(app)/layout.tsx`                                                                                                                                                                                                              |
| AppShell components  | `src/app/(app)/_components/{app-shell,user-menu}.tsx`                                                                                                                                                                                   |
| AuthShell            | `src/components/auth/auth-shell.tsx` (brand mark + title + children + optional `header` slot for onboarding progress)                                                                                                                   |
| Dashboard route      | `src/app/(app)/dashboard/page.tsx`                                                                                                                                                                                                      |
| Dashboard components | `src/app/(app)/dashboard/_components/{match-card,match-list,empty-state,score-ring,score-breakdown}.tsx`                                                                                                                                |
| Settings route       | `src/app/(app)/settings/page.tsx`                                                                                                                                                                                                       |
| Settings form        | `src/app/(app)/settings/_components/{preferences-form,personal-info-section}.tsx`                                                                                                                                                       |
| Match Server Actions | `src/server/actions/match.ts`                                                                                                                                                                                                           |
| Resume upload action | `src/server/actions/resume.ts` (unpdf extraction, 70b parse, atomic master-switch)                                                                                                                                                      |
| Resume parser        | `src/server/services/ai/parse-resume.ts` (v3 with SKILL_BLOCKLIST + SKILL_CANONICAL code-side cleaning)                                                                                                                                 |
| Zod schemas          | `src/shared/schemas/{preferences,profile}.ts` (profile has E.164 phone transform + refine)                                                                                                                                              |
| Suggestion data      | `src/shared/data/{role,location}-suggestions.ts`                                                                                                                                                                                        |
| Reusable inputs      | `src/components/onboarding/{chip-input,experience-range,job-type-select,preference-toggle,progress}.tsx`                                                                                                                                |
| Command palette      | `src/components/command-palette.tsx`                                                                                                                                                                                                    |
| Scrapers             | `src/server/services/scrapers/{greenhouse,ashby,location,hash,rules}.ts`                                                                                                                                                                |
| LLM provider         | `src/server/services/ai/{llm,groq-provider}.ts`                                                                                                                                                                                         |
| Job enrichment       | `src/server/services/ai/enrich.ts`                                                                                                                                                                                                      |
| Matcher              | `src/server/services/matcher/{score,filters,match,reason}.ts`                                                                                                                                                                           |
| CLIs                 | `scripts/{scrape,cleanup,enrich,parse-resume,seed-master-resume,match,top-matches,reasons,show-reasons,show-breakdown,show-parsed-skills,show-prefs,show-bad-match,show-cluster,match-diagnostics,test-enrich-prompt,undismiss-all}.ts` |
| GitHub Actions       | `.github/workflows/{daily-cron,daily-enrich}.yml`                                                                                                                                                                                       |

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

Tuesday (2026-06-02) shipped 6 commits in a disciplined 3-hour session: edit personal info in /settings (PersonalInfoSection with view/edit toggle), parser architectural fix (SKILL_BLOCKLIST + SKILL_CANONICAL replacing prompt-engineering attempts that over-pruned real skills), Phase 2G architectural spec expanded from 4-line placeholder to full plan, onboarding progress indicator across all 4 routes (AuthShell.header prop), and firstName/lastName tightened to non-null (schema migration + email-prefix fallback removal).

Wednesday (2026-06-03) starting with 3-hour budget. Section 11 cleanup (this update) followed by one polish ship.

**Next session priorities:**

1. **Section 11 cleanup** (~20 min) — refresh this section to reflect Tuesday's 6 ships and Wednesday's plan. (Currently doing.)
2. **Suggested target roles from resume.currentRole** (~1h) — same UX pattern as the already-shipped suggested skills chips. Surface up to 5 candidate target roles from parsedJson.currentRole plus parsedJson.workHistory[].title (deduped, lowercase). Render above the targetRoles ChipInput. Wednesday's primary ship.
3. **Verify v3 enrichment backfill progress.** Run `scripts/match-diagnostics.ts` to see v2-vs-v3 count split. Target ~482 v2 jobs re-enriched over ~4 days. Tuesday was day 2 of backfill, completing approximately Friday June 5.
4. **Country picker for phone** (~2h) — currently defaults to +1 if no country code, but international workers need a proper picker. Phase 2E.5 continued.
5. **DOCX upload support** (~2h) — currently PDF only, known issue #6. Mammoth library for .docx text extraction. Phase 2E.5 continued.
6. **Routing guard hardening** (~1h) — partial-completion edge cases not all covered. Phase 2E.5 continued.
7. **Phase 2F — Vercel deploy** (~3-4h) — gated on v3 backfill completion (~June 5-6) AND ideally one more Phase 2E.5 polish ship landed. Target window: this weekend.

**Not on critical path until later:**

- Cerebras provider (Phase 2G dependency, ~2-3h)
- Resume tailoring (Phase 2G full spec in Section 6, ~25-35h multi-session, gated on Phase 2F deploy)
- Email digest / Playwright application auto-fill (Phase 2H)
- Phase 2I application tracker
- Fuzzy-matching whitelist for parser cleaning (~4-6h, post-deploy when real user data informs tuning)

**Reflection notes for future sessions:**

Tuesday's discipline contrast with Monday's marathon was the story. Monday: 9 commits in ~10-11 hours, near-miss with `prisma migrate dev`, multiple "keep going" reflexes. Tuesday: 6 commits in ~3 hours, two explicit pushback moments that improved the work (one on time-checking accuracy, one on the parser fix's generalizability — "will this work for new users?"). **Sustainable rhythm is 2-4 hour focused sessions. The bar should rise each session, not the hour count.**

Five specific patterns worth remembering:

1. **Multi-line Node `-e` scripts have backtick escape problems.** Write `.mjs` scripts to disk instead, then `node /tmp/patch.mjs`. Safer for multi-anchor patches.
2. **Commitlint enforces subject-case lowercase.** "ai-suggested" not "AI-suggested" in commit subjects.
3. **`prisma db push` is the workflow for this project — NOT `prisma migrate dev`.** db push syncs schema without writing migration history files. migrate dev would offer destructive reset due to existing drift. Always pre-flight DB-touching schema changes with a NULL/integrity check before pressing y.
4. **LLM prompts are extraction tools, not quality filters.** Tuesday's parser fix: two iterations trying to teach the 70b model to filter "noise" caused it to drop 7-8 real skills (numpy, pandas, react, etc.). The fix was to revert the prompt to "extract everything verbatim" and move filtering to deterministic code (Set + Record lookup). Pattern generalizes: when the LLM is dropping real content, the right answer is often "ask less of the LLM, do more in code."
5. **Timestamp accuracy matters for trust.** When agent guesses wall-clock from message timing and gets it wrong, it creates false urgency. Rule: agent does not state wall-clock; user provides it when needed.
