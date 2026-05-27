# AI Job OS — Session Context

> **Paste this file at the start of every new session with Claude.**
> Last updated: 2026-05-27 mid-day (free-tier-only locked; enrichment model switched to 8b-instant)

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
- **Phase 2E.2.A-fix (mid-session 2026-05-27):** Switched enrichment model llama-3.3-70b-versatile → llama-3.1-8b-instant (free tier, 5× TPD ceiling: 500k vs 100k). Truncated job descriptions 4000 → 2000 chars (signals are in first paragraphs anyway). Added `model?: string` override to `LLMGenerateParams` so different tasks can use different free-tier models without env-var changes.

**Total in DB right now: 1,337 real US jobs. ~123 jobs enriched (under old version). After mid-session model change, ENRICHMENT_VERSION = `groq-llama-3.1-8b-v2` triggers full re-enrichment via idempotency predicate.**

**The enrichment rate problem (solution path locked, no paid APIs):**

- **Old constraint:** llama-3.3-70b-versatile @ 100k TPD = ~250-300 jobs/day. Full backfill 4-5 days.
- **New constraint:** llama-3.1-8b-instant @ 500k TPD = ~1,500-2,000 jobs/day. Full backfill <24h.
- **Cerebras free tier** (signing up, no card) provides redundant llama-3.3-70b capacity for resume tailoring (Phase 2G).
- **For 10 friends × 4 resumes/day workload:** Groq + Cerebras split handles it. ~330k tokens/day, well within combined free tiers.

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
Enrichment metadata: `enrichedAt`, `enrichmentVersion` (current: `groq-llama-3.1-8b-v2`)

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

| Decision                    | Value                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| **FREE TIER ONLY**          | **No paid APIs ever. Paying a penny is the defeat condition.**                                 |
| Job TTL                     | 30 days for unmatched jobs                                                                     |
| UserJobMatch auto-dismiss   | 7 days unviewed                                                                                |
| Application archival        | 90 days after rejection                                                                        |
| Dedup window                | 14 days (sha256 of company\|title\|location)                                                   |
| Cleanup model               | **User-driven, not time-driven**                                                               |
| Repository pattern          | NO — direct Prisma                                                                             |
| **AI architecture**         | **Per-task free-tier model selection via `params.model` override (see below)**                 |
| Enrichment model            | `llama-3.1-8b-instant` (Groq free, 500k TPD)                                                   |
| Resume parsing model        | `llama-3.3-70b-versatile` (Groq free, quality matters)                                         |
| Reason generator model      | `llama-3.3-70b-versatile` (Groq free, batched per-user; 8b followed style instructions poorly) |
| Resume tailoring model      | `llama-3.3-70b-versatile` split 50/50 across Groq + Cerebras (both free)                       |
| Skill match                 | String intersection (lowercase + word boundary). Embeddings deferred to Phase 2H+.             |
| Groq free tier (8b-instant) | 14,400 RPD / 30,000 TPM / 500,000 TPD                                                          |
| Groq free tier (70b)        | 1,000 RPD / 6,000 TPM / 100,000 TPD                                                            |
| Cerebras free tier          | (verify on signup) — used as 70b redundancy for tailoring                                      |
| Enrichment version          | `groq-llama-3.1-8b-v2`                                                                         |
| Enrichment throttle         | 500ms between successful jobs                                                                  |
| Enrichment max_tokens       | 512                                                                                            |
| Enrichment truncation       | 2,000 chars (was 4,000 — signals are in first paragraphs)                                      |
| Resume parse version        | `groq-llama-3.3-70b-resume-v2`                                                                 |
| Resume parse max_tokens     | 4096                                                                                           |
| Resume parse truncation     | 12,000 chars                                                                                   |
| Resume MAX_SKILLS           | 80 (was 50; some senior resumes have 60+)                                                      |
| LLM error handling          | Auth/rate-limit → abort batch; validation/transport → log+continue                             |
| LLM cron schedules          | scrape+cleanup 11:00 UTC, enrich 12:00 UTC                                                     |
| **Master/Tailored split**   | Master locked truth; tailoring rewrites summary/skills/bullets only                            |
| Master switching            | Non-destructive (preserve provenance)                                                          |
| **Matcher version**         | `matcher-v1`                                                                                   |
| **Matcher weights**         | titleKeywords=25, skills=20, seniority=15, sponsorship=15, location=15, salary=10              |
| **Matcher saturation**      | 1 kw match=0.7, 2=0.9, 3+=1.0                                                                  |
| **Matcher skill dampen**    | <3 job skills → score scaled by (count/3)                                                      |
| **Matcher relevance gate**  | Cap at 35 if titleKw=0 AND skills=0 AND both have data                                         |
| **Matcher word matching**   | Word-boundary regex (prevents "llm" matching "fulfillment")                                    |
| MIN_SCORE_TO_PERSIST        | 40 (calibrated for current data sparsity; revisit when enrichment ≥50%)                        |
| Resume file types accepted  | PDF + plain text (DOCX deferred); 5 MB max                                                     |
| Schema strictness           | Strict on fields we use; permissive on metadata                                                |

---

## 5. SERVICE ARCHITECTURE

### Scrapers (`src/server/services/scrapers/`)

greenhouse.ts/schema.ts, ashby.ts/schema.ts, location.ts, hash.ts, rules.ts

### AI services (`src/server/services/ai/`)

- `llm.ts` — provider-agnostic interface with per-call `model?` override, typed error hierarchy, factory
- `groq-provider.ts` — Groq impl with retry, timeout, Retry-After
- `cerebras-provider.ts` — (planned today) Cerebras impl, same interface
- `enrich.ts` — job enrichment orchestrator (uses `model: ENRICHMENT_MODEL` per call)
- `parse-resume.ts` — resume parser (no model override; uses provider default 70b)
- `reason.ts` — (planned today, Phase 2E.2.B) match reason generator

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

### Phase 2E.2.B — Reason generator (today, ~3-4h)

- `src/server/services/matcher/reason.ts` — LLM call per top-N matched job using `llama-3.1-8b-instant` (free)
- Produces 2-3 sentence "why this job, why now" paragraph stored in `UserJobMatch.reason`
- Locked/Tailored integrity rule applies: reasons describe alignment between user's actual resume facts and job needs — no fabrication.
- Prompt iteration is the long pole (~1-2h of "wrong tone, try again" cycles)
- Batched per-user: one LLM call returns reasons for top-10 jobs at once

### Phase 2E.3.A — Functional dashboard (today/next, ~3-4h subset)

In-scope today (functional subset):

- Routes: `/dashboard`, `/onboarding/resume`, `/onboarding/preferences`, `/settings`
- Auth-gated routing state machine
- Resume upload UI (drag-drop + AI-prefill confirmation)
- Basic daily briefing layout (cards, score, reason, basic actions)
- "We're scanning 1,337 jobs for you" empty state with rotating phrases (auto-triggers matcher)
- Settings page scaffolding

Out of scope today (cinematic polish, Phase 2E.3.B next session):

- Choreographed onboarding animations (Framer Motion springs)
- Score reveal animations
- Stagger-in card animations
- Mobile responsive
- Full accessibility pass
- Why-this-score expandable view with dimensional bars
- Keyboard shortcuts + command palette integration

### Phase 2F — Vercel deploy (~3-4h)

- env var migration, edge vs node runtime decisions, upload limits, cold-start handling

### Phase 2G — Resume tailoring (Locked/Tailored split, both PDF + DOCX, single-page, ATS-friendly)

- Uses `llama-3.3-70b-versatile` split 50/50 Groq + Cerebras (both free)
- Generates two outputs: ATS-plain version + human-preview version
- Both single-page, both downloadable

### Phase 2H+ — Email digest, application auto-fill (Playwright, review-only), Gmail intelligence

---

## 7. KNOWN ISSUES (live, accepted)

1. **Null bytes** — ~0.3% of Greenhouse jobs. Stripped at write; nested JSON occasionally slips. Accepted.
2. **Coinbase** — Greenhouse 404 from GH Actions IPs.
3. **Linear/Supabase (ashby)** — non-US, correctly rejected.
4. **GitHub Actions Node 20 deprecation** — June 2026, bump actions/checkout + actions/setup-node.
5. **Non-technical roles return `skills: []`** — ~60% of jobs. Matcher conditional relevance gate handles correctly.
6. **DOCX resume upload** — not implemented, clear error returned.
7. **Enrichment data-rate** — was a bottleneck under 70b (100k TPD); model switch to 8b-instant (500k TPD) brings full backfill to <24h. No longer blocking.
8. **Matcher data-limited (transient)** — 4 stored matches for test user. Will repopulate after 8b enrichment backfill completes (~24h) + re-run matcher.

### Recently resolved

- ✅ Phase 2D shipped (LLM abstraction, Groq, enrichment, CLI, cron)
- ✅ Cron timeout — split into two workflows
- ✅ Phase 2E.1 backend shipped
- ✅ Phase 2E.2.A backend shipped — matcher engine functional, correctness verified
- ✅ Multiple matcher algorithm bugs caught and fixed: neutral-default inflation, sparsity-100% artifact, linear-divide penalty, "llm" matching inside "fulfillment"
- ✅ MAX_SKILLS bumped 50→80 (Zod was rejecting valid senior resumes)
- ✅ Mid-session 2026-05-27: enrichment switched to 8b-instant + truncation 4000→2000, free-tier-only constraint formally locked, per-task model architecture documented

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
| LLM provider    | `src/server/services/ai/{llm,groq-provider}.ts` (cerebras-provider.ts planned today)   |
| Job enrichment  | `src/server/services/ai/enrich.ts`                                                     |
| Matcher         | `src/server/services/matcher/{score,filters,match}.ts`                                 |
| CLIs            | `scripts/{scrape,cleanup,enrich,parse-resume,seed-master-resume,match,top-matches}.ts` |
| GitHub Actions  | `.github/workflows/{daily-cron,daily-enrich}.yml`                                      |

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

## 11. TODAY'S SESSION PLAN (2026-05-27 long session)

In-scope, in order:

1. ✅ **Free-tier-only constraint locked** in Section 1 + Section 4
2. ✅ **Enrichment model switched** to llama-3.1-8b-instant + truncation 2000 chars
3. **Add Cerebras provider** (~1h) — `cerebras-provider.ts`, factory case, smoke test, env var docs
4. **Ship Phase 2E.2.B (reason generator)** (~3-4h) — `src/server/services/matcher/reason.ts`, batched per-user, llama-3.1-8b-instant, integration with matcher orchestrator, force re-run for all users
5. **Phase 2E.3.A functional dashboard** (~3-4h subset) — routes, auth-gated routing, resume upload UI, basic briefing layout, "scanning for you" empty state

Out of scope today (Phase 2E.3.B next session):

- Cinematic animations (Framer Motion choreography)
- Mobile responsive
- Full a11y
- Why-this-score expandable view
- Score reveal animations

---
