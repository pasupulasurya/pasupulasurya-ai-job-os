# AI Job OS — Session Context

> **Paste this file at the start of every new session with Claude.**
> Last updated: 2026-05-27 evening (Phase 2E.3.A shipped — functional dashboard live)

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
- **Phase 2E.2.A-fix (2026-05-27):** Per-task LLM model override via `LLMGenerateParams.model`. Enrichment switched llama-3.3-70b-versatile → llama-3.1-8b-instant (5× TPD ceiling: 500k vs 100k). Truncated descriptions 4000 → 2000 chars (signals are in first paragraphs). Resume parser keeps 70b default. Triggers full re-enrichment via idempotency predicate.
- **Phase 2E.2.B (2026-05-27):** Match reason generator — `src/server/services/matcher/reason.ts`. Batched per-user (ONE LLM call returns reasons for top-10 matches). Initially tried 8b-instant; produced formulaic identical openings even with style instructions. Switched to llama-3.3-70b-versatile (Groq free, 100k TPD). Integrity rule honored: reasons reference facts from BOTH resume and JD, never fabricate. Verified end-to-end: 4/4 reasons generated; model honestly flagged a sales role as "not a direct match" without overselling.
- **Phase 2E.3.A (2026-05-27):** Functional dashboard at `/dashboard`. Server Component with auth gate + routing state machine. Top-10 match cards with score badge, LLM reason paragraph, three actions (dismiss/view/apply). Server Actions enforce ownership (matchId AND userId filter before mutation). Empty state with rotating progress phrases + auto-trigger of matcher. Dismissal persists across refreshes. Inline resume upload placeholder (proper route deferred). End-to-end verified against real DB.

**Total in DB: 1,337 real US jobs. Enrichment backfill is mid-flight under the new groq-llama-3.1-8b-v2 version (started 2026-05-27 evening). Match data will densify naturally as backfill completes.**

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
- `onboardingComplete` (Boolean default false) — present in schema but NOT used by dashboard gate; dashboard checks `keywords.length > 0` instead. The flag is reserved for the proper multi-step onboarding (Phase 2E.3.B).

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

- `scoreBreakdown` (Json?) — per-dimension contributions for "why this score" UX (rendered in 2E.3.B)
- `reason` (Text?) — LLM-generated paragraph; populated by Phase 2E.2.B
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

| Decision                      | Value                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| **FREE TIER ONLY**            | **No paid APIs ever. Paying a penny is the defeat condition.**                              |
| Job TTL                       | 30 days for unmatched jobs                                                                  |
| UserJobMatch auto-dismiss     | 7 days unviewed                                                                             |
| Application archival          | 90 days after rejection                                                                     |
| Dedup window                  | 14 days (sha256 of company\|title\|location)                                                |
| Cleanup model                 | **User-driven, not time-driven**                                                            |
| Repository pattern            | NO — direct Prisma                                                                          |
| **AI architecture**           | **Per-task free-tier model selection via `params.model` override (see below)**              |
| Enrichment model              | `llama-3.1-8b-instant` (Groq free, 500k TPD)                                                |
| Resume parsing model          | `llama-3.3-70b-versatile` (Groq free, quality matters)                                      |
| Reason generator model        | `llama-3.3-70b-versatile` (8b followed style instructions poorly; varied openings need 70b) |
| Resume tailoring model        | `llama-3.3-70b-versatile` split 50/50 across Groq + Cerebras (both free, planned)           |
| Skill match                   | String intersection (lowercase + word boundary). Embeddings deferred to Phase 2H+.          |
| Groq free tier (8b-instant)   | 14,400 RPD / 30,000 TPM / 500,000 TPD                                                       |
| Groq free tier (70b)          | 1,000 RPD / 6,000 TPM / 100,000 TPD                                                         |
| Cerebras free tier            | (verify on signup) — used as 70b redundancy for tailoring                                   |
| Enrichment version            | `groq-llama-3.1-8b-v2`                                                                      |
| Enrichment throttle           | 500ms between successful jobs                                                               |
| Enrichment max_tokens         | 512                                                                                         |
| Enrichment truncation         | 2,000 chars (was 4,000 — signals are in first paragraphs)                                   |
| Resume parse version          | `groq-llama-3.3-70b-resume-v2`                                                              |
| Resume parse max_tokens       | 4096                                                                                        |
| Resume parse truncation       | 12,000 chars                                                                                |
| Resume MAX_SKILLS             | 80 (was 50; some senior resumes have 60+)                                                   |
| Reason version                | `groq-llama-3.3-70b-reason-v1`                                                              |
| Reason max_tokens             | 2048                                                                                        |
| Reason batch size             | 10 jobs per LLM call (top-N for the user)                                                   |
| Reason per-row length cap     | 900 chars (Zod schema; 600 was too tight)                                                   |
| LLM error handling            | Auth/rate-limit → abort batch; validation/transport → log+continue                          |
| LLM cron schedules            | scrape+cleanup 11:00 UTC, enrich 12:00 UTC                                                  |
| **Master/Tailored split**     | Master locked truth; tailoring rewrites summary/skills/bullets only                         |
| Master switching              | Non-destructive (preserve provenance)                                                       |
| **Matcher version**           | `matcher-v1`                                                                                |
| **Matcher weights**           | titleKeywords=25, skills=20, seniority=15, sponsorship=15, location=15, salary=10           |
| **Matcher saturation**        | 1 kw match=0.7, 2=0.9, 3+=1.0                                                               |
| **Matcher skill dampen**      | <3 job skills → score scaled by (count/3)                                                   |
| **Matcher relevance gate**    | Cap at 35 if titleKw=0 AND skills=0 AND both have data                                      |
| **Matcher word matching**     | Word-boundary regex (prevents "llm" matching "fulfillment")                                 |
| MIN_SCORE_TO_PERSIST          | 40 (calibrated for current data sparsity; revisit when enrichment ≥50%)                     |
| **Dashboard onboarding gate** | `keywords.length > 0` (NOT `onboardingComplete`) — flag reserved for Phase 2E.3.B           |
| **Empty state UX**            | Auto-trigger matcher + rotating progress phrases (every 2.5s) + AnimatePresence             |
| **Action ownership check**    | All match Server Actions filter on BOTH matchId AND userId before mutation                  |
| Resume file types accepted    | PDF + plain text (DOCX deferred); 5 MB max                                                  |
| Schema strictness             | Strict on fields we use; permissive on metadata                                             |

---

## 5. SERVICE ARCHITECTURE

### Scrapers (`src/server/services/scrapers/`)

greenhouse.ts/schema.ts, ashby.ts/schema.ts, location.ts, hash.ts, rules.ts

### AI services (`src/server/services/ai/`)

- `llm.ts` — provider-agnostic interface with per-call `model?` override, typed error hierarchy, factory
- `groq-provider.ts` — Groq impl with retry, timeout, Retry-After. Honors `params.model ?? this.model`
- `enrich.ts` — job enrichment orchestrator (uses `model: ENRICHMENT_MODEL` per call)
- `parse-resume.ts` — resume parser (no model override; uses provider default 70b)

### Matcher (`src/server/services/matcher/`)

- `score.ts` — pure scoring functions (6 dimensions, weighted composition)
- `filters.ts` — hard pre-filters (exclude keywords, avoid companies, sponsorship)
- `match.ts` — orchestrator (idempotency, upsert, status preservation)
- `reason.ts` — batched per-user reason generator (70b, integrity rule)

### Server Actions (`src/server/actions/`)

- `auth.ts` — signup/signin/signout
- `preferences.ts` — save UserPreference (15 fields total)
- `resume.ts` — uploadMasterResumeAction (5MB cap, atomic master-switch)
- `match.ts` — markViewed / dismiss / markApplied / triggerMatcher (all ownership-checked)

### App routes (`src/app/`)

- `/login`, `/signup` (Phase 2B)
- `/onboarding/preferences` (Phase 2B; still primary collection surface)
- `/dashboard` (Phase 2E.3.A) — daily briefing, the showpiece surface
- `/settings`, `/onboarding/resume` — planned for 2E.3.B

### Dashboard components (`src/app/dashboard/_components/`)

- `match-card.tsx` — single match with score badge, reason, action buttons. Optimistic UI via useTransition.
- `empty-state.tsx` — auto-triggers matcher; cycles 6 progress phrases via AnimatePresence; resolves to results or honest no-match message.

### CLI scripts (`scripts/`)

- `scrape.ts` — `scrape:gh`, `scrape:ashby`
- `cleanup.ts` — `cleanup`, `cleanup -- --dry-run`
- `enrich.ts` — `enrich`, `enrich -- --force --limit=N --dry-run`
- `parse-resume.ts` — `parse:resume -- <path>` (CLI smoke test)
- `seed-master-resume.ts` — `seed:resume -- --user=<id> --file=<path>` (dev helper)
- `match.ts` — `match`, `match -- --user=<id> --force --limit=N --dry-run`
- `top-matches.ts` — inspect top N stored matches
- `reasons.ts` — `reasons`, `reasons -- --user=<id> --force --limit=N --dry-run`
- `show-reasons.ts` — dev helper, inspect stored reasons alongside matches

### GitHub Actions

- `daily-cron.yml` — 11:00 UTC, 15-min timeout, scrape + cleanup
- `daily-enrich.yml` — 12:00 UTC, 60-min timeout, enrich only

---

## 6. WHAT REMAINS

### Phase 2E.3.B — Cinematic polish (next, multi-session, ~20-30h)

Items deferred from today's functional subset:

1. **Stagger-in card animations** (Framer Motion choreography on mount)
2. **Score reveal animation** — animated ring/number countdown using springs
3. **Why-this-score expandable view** — dimensional breakdown bars (data already in scoreBreakdown JSON)
4. **Mobile responsive** — every state needs mobile sizing
5. **Full accessibility pass** — ARIA, keyboard nav, focus management
6. **Keyboard shortcuts + command palette integration** (save/dismiss/next via keyboard)
7. **Proper /onboarding/resume route** with drag-drop + AI-prefill confirmation (replace inline placeholder)
8. **/settings route** — all UserPreference fields with proper edit UI
9. **Choreographed multi-step onboarding** — 5-step flow with Framer Motion transitions
10. **Loading skeletons + error boundaries** at polish level

### Phase 2E.4 — Wire matcher into daily cron (~2h)

- Currently matcher runs on-demand only (dashboard empty state or CLI)
- Wire `matchJobsForUser(allUsers)` into a third daily workflow OR extend `daily-enrich.yml`
- Cron should also trigger `generateReasonsForUser` after the matcher

### Phase 2F — Vercel deploy (~3-4h)

- env var migration, edge vs node runtime decisions, upload limits, cold-start handling

### Phase 2G — Resume tailoring (Locked/Tailored split, both PDF + DOCX, single-page, ATS-friendly)

- Uses `llama-3.3-70b-versatile` split 50/50 Groq + Cerebras (both free)
- Generates two outputs: ATS-plain version + human-preview version
- Both single-page, both downloadable
- Add Cerebras provider (`cerebras-provider.ts`) following same interface as Groq

### Phase 2H+ — Email digest, application auto-fill (Playwright, review-only), Gmail intelligence

---

## 7. KNOWN ISSUES (live, accepted)

1. **Null bytes** — ~0.3% of Greenhouse jobs. Stripped at write; nested JSON occasionally slips. Accepted.
2. **Coinbase** — Greenhouse 404 from GH Actions IPs.
3. **Linear/Supabase (ashby)** — non-US, correctly rejected.
4. **GitHub Actions Node 20 deprecation** — June 2026, bump actions/checkout + actions/setup-node.
5. **Non-technical roles return `skills: []`** — ~60% of jobs. Matcher conditional relevance gate handles correctly.
6. **DOCX resume upload** — not implemented, clear error returned.
7. **Matcher not yet wired to daily cron** — runs only via dashboard empty-state action or CLI. Phase 2E.4 fixes this.
8. **Dashboard greeting uses email prefix when User.name is null** — acceptable for v1; proper name collection in 2E.3.B onboarding.
9. **Enrichment log misleading** — `log.model: llm.model` shows provider default (70b) while API actually receives override (8b-instant). Cosmetic only; refine in future cleanup.

### Recently resolved

- ✅ Phase 2D shipped (LLM abstraction, Groq, enrichment, CLI, cron)
- ✅ Cron timeout — split into two workflows
- ✅ Phase 2E.1 backend shipped (resume parser + upload)
- ✅ Phase 2E.2.A backend shipped (matcher engine, multiple algorithm bugs caught and fixed)
- ✅ MAX_SKILLS bumped 50→80
- ✅ Free-tier-only constraint formally locked in CONTEXT.md
- ✅ Phase 2E.2.A-fix: enrichment model switch + truncation
- ✅ Phase 2E.2.B shipped (reason generator, 70b after 8b style failure)
- ✅ Phase 2E.3.A shipped (functional dashboard with end-to-end action layer)

---

## 8. CRITICAL FILES (current repo state)

| Concern              | Path                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Front door           | `README.md`                                                                                                 |
| System map           | `ARCHITECTURE.md`                                                                                           |
| Working rhythm       | `COLLABORATION.md`                                                                                          |
| Build narrative      | `AI_JOB_OS_SESSION_JOURNAL.md`                                                                              |
| Vision               | `VISION.md`                                                                                                 |
| Decisions            | `docs/adr/*.md`                                                                                             |
| Design DNA           | `docs/design/principles.md`                                                                                 |
| Cron runbook         | `docs/runbooks/cron.md`                                                                                     |
| Design tokens        | `src/styles/tokens.ts`, `src/app/globals.css`                                                               |
| Prisma schema        | `prisma/schema.prisma`                                                                                      |
| SQL triggers         | `prisma/sql/0001_auth_signup_trigger.sql`                                                                   |
| Auth                 | `src/server/actions/auth.ts`, `src/app/login/*`, `src/app/signup/*`, `middleware.ts`                        |
| Preferences          | `src/server/actions/preferences.ts`, `src/app/onboarding/preferences/*`                                     |
| Resume upload action | `src/server/actions/resume.ts`                                                                              |
| Resume parser        | `src/server/services/ai/parse-resume.ts`                                                                    |
| Match Server Actions | `src/server/actions/match.ts`                                                                               |
| Dashboard route      | `src/app/dashboard/page.tsx`                                                                                |
| Dashboard components | `src/app/dashboard/_components/{match-card,empty-state}.tsx`                                                |
| Zod schemas          | `src/shared/schemas/preferences.ts`                                                                         |
| Command palette      | `src/components/command-palette.tsx`                                                                        |
| Scrapers             | `src/server/services/scrapers/{greenhouse,ashby,location,hash,rules}.ts`                                    |
| LLM provider         | `src/server/services/ai/{llm,groq-provider}.ts` (cerebras-provider.ts planned 2G)                           |
| Job enrichment       | `src/server/services/ai/enrich.ts`                                                                          |
| Matcher              | `src/server/services/matcher/{score,filters,match,reason}.ts`                                               |
| CLIs                 | `scripts/{scrape,cleanup,enrich,parse-resume,seed-master-resume,match,top-matches,reasons,show-reasons}.ts` |
| GitHub Actions       | `.github/workflows/{daily-cron,daily-enrich}.yml`                                                           |

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

Today (2026-05-27) shipped: enrichment model switch + reason generator (2E.2.B) + functional dashboard (2E.3.A). Enrichment backfill running in background — will densify match data over next 24h.

**Next session priorities:**

1. **Verify enrichment backfill landed.** Check job count where `enrichmentVersion = "groq-llama-3.1-8b-v2"`. Should be >1,000 by morning.
2. **Re-run matcher with `--force --all-users`** to repopulate UserJobMatch against newly-enriched data. Expect score distribution to improve significantly — more jobs above 40, top scores higher than today's 55.
3. **Re-run reason generator with `--force --all-users --limit=10`** to populate reasons for newly-promoted matches.
4. **Phase 2E.3.B cinematic polish** — choose 1-2 items from the 10-item list in Section 6 per session. Recommended starting order:
   - Score reveal animation (highest visual impact, ~3h)
   - Stagger-in card entrance (anchors the cinematic feel, ~2h)
   - Mobile responsive (real users on phones, ~6h)
5. **Phase 2E.4 — wire matcher + reason generator to daily cron** (~2h, can pair with cinematic polish)
6. **Phase 2E.3.B — proper /onboarding/resume + /settings routes** (each ~3-4h)

**Not on critical path:**

- Cerebras provider (Phase 2G dependency)
- Vercel deploy (Phase 2F)
- Resume tailoring (Phase 2G)

---
