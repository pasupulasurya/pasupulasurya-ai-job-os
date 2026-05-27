# AI Job OS — Session Context

> **Paste this file at the start of every new session with Claude.**
> Last updated: 2026-05-26 (Phase 2D closed, Phase 2E.1 backend shipped)

For wider context, also point readers at:

- `README.md` — front door / quickstart
- `ARCHITECTURE.md` — how the system thinks
- `COLLABORATION.md` — how we work together (chunk sizes, verification, rhythm)
- `AI_JOB_OS_SESSION_JOURNAL.md` — build narrative

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
- No `console.log` in production code (Pino only; CLI scripts excepted for human stdout)
- Every API endpoint idempotent OR explicitly documented as not
- Every secret in env vars, no hardcoding
- **System stays correct under partial failure** — one malformed item must not
  reject an entire batch. Per-item try/catch at every boundary.

**Tone of voice**
"Done" not "Yay! All done!" — direct, calm, never apologetic.
No emojis in production UI. We are precise, never cute.

**Product principle (locks into the architecture, not just the UI):**
**Never fabricate content.** Resume tailoring rewrites and re-emphasizes, but cannot invent facts that aren't in the master resume. This is enforced via the locked/tailored split (see Section 4).

---

## 2. WHAT WE'VE BUILT (cumulative — all shipped to main)

- **Foundation (F1-F7):** VISION, ADRs, design tokens, observability, quality gates, command palette
- **Phase 2A:** 10-table schema, 30 US companies seeded, 12 owner rules
- **Phase 2B:** Supabase Auth + Resend SMTP + DB triggers + auth pages + middleware + onboarding
- **Phase 2C:** Greenhouse + Ashby scrapers, cleanup script, daily cron, per-job parse refactor — 1,337 real US jobs
- **Phase 2D.0-2D.3:** LLM provider abstraction (`llm.ts`), Groq impl (`groq-provider.ts`), enrichment orchestrator (`enrich.ts`) — typed error hierarchy, idempotency predicate, 500ms throttle, atomic writeback
- **Phase 2D.4:** CLI (`scripts/enrich.ts`), GitHub Actions split — `daily-cron.yml` (11:00 UTC, scrape+cleanup) + `daily-enrich.yml` (12:00 UTC, enrich only, 60min timeout)
- **Phase 2E.1 (backend only — UI deferred to next session for cinematic work):**
  - Schema expansion: UserPreference + 7 fields (visaType, workAuthStatus, salaryMin, currentEmployment, targetRoles, avoidCompanies, onboardingComplete); ResumeVersion + 7 fields (userId required, isMaster, parsedJson, parsedAt, parseVersion, fileName, fileSize); User gains `resumes` relation
  - Zod validation (`src/shared/schemas/preferences.ts`): expanded schema with canonical enum value arrays (`visaTypeValues`, `workAuthStatusValues`, `currentEmploymentValues`) exported for UI use
  - Server Action (`src/server/actions/preferences.ts`): updated to persist all new fields
  - Resume parser (`src/server/services/ai/parse-resume.ts`): provider-agnostic, Zod-validated, integrity-preserving (bullets verbatim from master). Version: `groq-llama-3.3-70b-resume-v1`
  - Upload Server Action (`src/server/actions/resume.ts`): 5MB cap, MIME whitelist, atomic master-switch via `prisma.$transaction` (preserves old masters as `isMaster: false` for tailored-resume provenance), pdf-parse v2 (`PDFParse` class)
  - CLI smoke test (`scripts/parse-resume.ts`, `npm run parse:resume`)
  - Verified end-to-end against real resume PDF: 38 skills extracted, 3 work history entries, 2 education entries, bullets verbatim, 2.4s wall time

**Total in DB right now: 1,337 real US jobs across 17 active companies. ~123 jobs enriched (autonomous backfill continuing daily via cron).**

---

## 3. EXACT SCHEMA FIELDS (Prisma 7 cheat sheet)

**Source of truth:** `prisma/schema.prisma`. Re-paste this if drift is suspected.

### User

`id, authId, email (unique), name, role, createdAt, updatedAt`

- relations: preferences, applications, jobMatches, blockedCompanies, resumes

### UserPreference

Core: `id, userId (unique), keywords[], excludeKeywords[], locations[], jobTypes[], experienceMin, experienceMax, visaSponsorship, stemOptOnly, dailyApplyLimit, createdAt, updatedAt`

**2E.1 additions:**

- `visaType` (String?) — "h1b" | "f1_opt" | "stem_opt" | "green_card" | "citizen" | "other"
- `workAuthStatus` (String?) — "needs_sponsorship" | "current_h1b" | "ead" | "citizen_or_gc"
- `salaryMin` (Int?) — minimum acceptable annual USD
- `currentEmployment` (String?) — "employed" | "unemployed" | "student" | "freelance"
- `targetRoles` (String[] default []) — specific job titles user wants (vs general keywords)
- `avoidCompanies` (String[] default []) — soft block, distinct from UserBlockedCompany hard block
- `onboardingComplete` (Boolean default false) — routing flag

Canonical enum string arrays exported from `src/shared/schemas/preferences.ts`: `visaTypeValues`, `workAuthStatusValues`, `currentEmploymentValues`.

### Company ← used by scrapers

`id, slug (unique), name, ats, active, knownToSponsor, notes, lastScrapedAt, lastJobCount, createdAt, updatedAt`

- `ats`: "greenhouse" | "lever" | "ashby" | "workday"
- **WATCH:** `ats` not `source`; `active` not `isActive`

### ScrapingRule ← used by scrapers

`id, name, ruleType, pattern, enabled, appliesTo, createdAt, updatedAt`

- `ruleType`: "exclude_keyword" | "require_location_match" | "max_age_days"
- `appliesTo`: "description" | "title" | "location" | "any"
- **WATCH:** `ruleType` not `action`; `appliesTo` not `field`; `enabled` not `isActive`

### Job ← inserted by scrapers, updated by enricher

`id, source, sourceUrl (UNIQUE), externalId, title, company, companySlug, location, remote, description (text), rawJson (json), hash, seniority, experienceYears, skills[], sponsorsVisa, stemOptFriendly, enrichedAt, enrichmentVersion, postedAt, scrapedAt, expiresAt, deletedAt, updatedAt`

- **WATCH:** `company` is a STRING (not FK), `sourceUrl` not `url`, `externalId` not `sourceJobId`, `source` is the ATS name string
- **AI-filled fields:** `seniority` (entry/mid/senior/staff), `experienceYears` (0-40), `skills` (lowercase), `sponsorsVisa` (tri-state), `stemOptFriendly` (tri-state)
- **AI metadata:** `enrichedAt` (DateTime?), `enrichmentVersion` (e.g. "groq-llama-3.3-70b-v1")

### UserJobMatch

`id, userId, jobId, matchScore, status, matchedAt, viewedAt, dismissedAt, dismissed, autoDismissed`

- `status`: "fresh" | "viewed" | "applied" | "dismissed" | "rejected"

### Application

`id, userId, jobId, status, resumeId, appliedAt, notes, createdAt, updatedAt, archivedAt`

### ResumeVersion (significantly expanded in 2E.1)

Core: `id, userId (REQUIRED), jobId (optional), contentJson, pdfUrl, docxUrl, createdAt, applications[]`

**2E.1 additions:**

- `user` relation (User cascade on delete)
- `isMaster` (Boolean default false) — only one master per user at any time
- `parsedJson` (Json?) — AI-extracted structured: { fullName, email, phone, location, summary, totalYearsExperience, currentRole, currentCompany, education[], workHistory[], skills[], links{} }
- `parsedAt` (DateTime?), `parseVersion` (String?) — e.g. "groq-llama-3.3-70b-resume-v1" — idempotency
- `fileName` (String?), `fileSize` (Int?) — upload metadata

Indexes: `[userId]`, `[userId, isMaster]`

### UserBlockedCompany

`id, userId, companyId, reason, blockedAt`

- `reason`: "rejected" | "not_interested" | "ghosted" | "low_quality"

### Log

`id, action, payload, level, createdAt`

---

## 4. LOCKED DECISIONS (do not re-discuss)

| Decision                    | Value                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Job TTL                     | 30 days for unmatched jobs (matched jobs live until application closes)                                 |
| UserJobMatch auto-dismiss   | 7 days unviewed → soft-dismiss (kept for analytics)                                                     |
| Application archival        | 90 days after rejection → soft-archive                                                                  |
| Dedup window                | 14 days (sha256 of company\|title\|location)                                                            |
| Cleanup cron                | Daily 04:00 PT via GitHub Actions                                                                       |
| Cleanup model               | **User-driven, not time-driven**: jobs die when no user cares; kept while applied to                    |
| Repository pattern          | NO — direct Prisma calls                                                                                |
| AI provider (beta)          | Groq free tier (`llama-3.3-70b-versatile`)                                                              |
| Groq free tier limits       | **30 RPM / 6,000 TPM / 1,000 RPD** for this model                                                       |
| Enrichment version          | `groq-llama-3.3-70b-v1` — bump string in `enrich.ts` to force re-enrich                                 |
| Enrichment idempotency      | Skip jobs where `enrichedAt IS NOT NULL AND enrichmentVersion = current`                                |
| Enrichment throttle         | 500ms between successful jobs                                                                           |
| Enrichment temperature      | 0 (deterministic — extraction not generation)                                                           |
| Enrichment max_tokens       | 512                                                                                                     |
| Resume parse version        | `groq-llama-3.3-70b-resume-v1`                                                                          |
| Resume parse max_tokens     | 4096                                                                                                    |
| Resume parse truncation     | 12,000 chars                                                                                            |
| LLM error handling          | Auth/rate-limit → abort batch; validation/transport → log+continue                                      |
| LLM cron schedules          | scrape+cleanup 11:00 UTC, enrich 12:00 UTC (separate workflow files)                                    |
| **Master / Tailored split** | **Master resume is locked truth. Tailoring rewrites summary/skills/bullets only, never invents facts.** |
| Master switching            | Non-destructive: old master keeps `isMaster=false` (preserves provenance)                               |
| Resume file types accepted  | PDF + plain text (DOCX deferred); 5 MB max                                                              |
| Vercel deploy               | After Phase 2E (full dashboard)                                                                         |
| US-only filter              | Multi-office OK (any segment US → accept)                                                               |
| Rule patterns               | Regex (case-insensitive)                                                                                |
| Server-only guard           | Only on supabase-server.ts (not prisma/logger/posthog)                                                  |
| Git workflow                | Direct commits to main acceptable for solo work                                                         |
| Schema strictness           | **Strict on fields we use; permissive on metadata.** Per-job parse + try/catch.                         |

---

## 5. SERVICE ARCHITECTURE

### Scrapers (`src/server/services/scrapers/`)

| File                   | Purpose                             | Reusable?              |
| ---------------------- | ----------------------------------- | ---------------------- |
| `greenhouse.schema.ts` | Zod schema + per-job parse          | No (provider-specific) |
| `greenhouse.ts`        | Orchestrator with per-job try/catch | No                     |
| `ashby.schema.ts`      | Zod schema + per-job parse          | No                     |
| `ashby.ts`             | Orchestrator                        | No                     |
| `location.ts`          | `isUSLocation()`, `hasUSLocation()` | ✅ pure function       |
| `hash.ts`              | `jobHash()` SHA-256                 | ✅ pure function       |
| `rules.ts`             | `applyRules()` engine               | ✅ pure function       |

### AI services (`src/server/services/ai/`)

| File               | Purpose                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------- |
| `llm.ts`           | Provider-agnostic interface, typed error hierarchy, env-driven factory                  |
| `groq-provider.ts` | Groq impl: retry + Retry-After + AbortController + Zod-validated JSON mode              |
| `enrich.ts`        | Job enrichment orchestrator: idempotency, throttle, per-job try/catch, atomic writeback |
| `parse-resume.ts`  | Resume parser: structured extraction with integrity rule (bullets verbatim)             |

### Server Actions (`src/server/actions/`)

| File             | Purpose                                                               |
| ---------------- | --------------------------------------------------------------------- |
| `auth.ts`        | signup/signin/signout                                                 |
| `preferences.ts` | save UserPreference (now with 7 new fields)                           |
| `resume.ts`      | uploadMasterResumeAction — file → text → parse → atomic master-switch |

### CLI scripts (`scripts/`)

- `scrape.ts` — `scrape:gh`, `scrape:ashby`
- `cleanup.ts` — `cleanup`, `cleanup -- --dry-run`
- `enrich.ts` — `enrich`, `enrich -- --force --limit=N --dry-run`
- `parse-resume.ts` — `parse:resume -- <path>` (CLI smoke test for parser)

### GitHub Actions

- `daily-cron.yml` — 11:00 UTC, 15-min timeout, scrape + cleanup
- `daily-enrich.yml` — 12:00 UTC, 60-min timeout, enrich only

Runbook: `docs/runbooks/cron.md`

---

## 6. WHAT REMAINS

### Phase 2E.2 — Matcher backend (next session)

- `src/server/services/matcher/` — algorithm computing `UserJobMatch.matchScore` per user × job
- Scoring inputs: title keyword overlap, AI-field overlap (seniority, skills, experienceYears, sponsorsVisa), location match
- Weighted scoring with `scoreBreakdown` stored as Json for "why this score" UX
- "Why this job" reason generator: per-job LLM call producing the written paragraph
- `npm run match` CLI + Server Action trigger on UserPreference save
- Critical constraint: **non-technical jobs return `skills: []`**, so the matcher must not require skill overlap as a hard filter — score it as a bonus signal, not a gate

### Phase 2E.3 — Showpiece dashboard (cinematic, next session(s))

User's "blow their mind" target. Specific UX decisions to honor:

- **Onboarding choreography:** resume upload → AI prefill confirmation → ~5 questions → "Building your daily briefing..." → curtain pulls back
- **Daily briefing as the hero view** — 5-10 jobs with written rationale per job, not a 200-row filterable list
- **Score reveal** — animated ring/number countdown (Framer Motion springs), subtle glow at >85
- **Single dashboard story:** "we've already done the work for you," not "here are filters"
- Settings page (visa, salary, locations, block list, notifications) is secondary

### Phase 2F — Deploy to Vercel

### Phase 2G — Resume tailoring

- `TailoredResume` model: `{ id, userId, jobId, masterResumeId, tailoredSummary, tailoredSkills[], roleAdaptations[], pdfUrl, docxUrl }`
- Per-job tailoring: LLM rewrites summary + skills + bullets, locked sections (contact, education, dates, companies) taken verbatim from master
- Generate **both PDF and DOCX**, both single-page, both ATS-friendly (sans-serif, single column, no images/headers/footers)
- Generation library TBD (likely `react-pdf` or `puppeteer`)

### Phase 2H+ — Email digest, application auto-fill (Playwright, review-only), Gmail intelligence

### Future scraper expansion

- Lever, Workday, Workable, Rippling's own ATS

---

## 7. KNOWN ISSUES (live, accepted)

1. **Null bytes** — ~0.3% of Greenhouse jobs have `\u0000` in description. Mostly stripped, occasional ones slip through nested JSON. Accepted.
2. **Coinbase** — Greenhouse API returns 404 from GitHub Actions runners (IP filter). 1 fetch_failed per cron.
3. **Linear (ashby), Supabase (ashby)** — European-only. Filter correctly rejects. Expected.
4. **GitHub Actions Node 20 deprecation** — June 2026. Bump `actions/checkout@v4` and `actions/setup-node@v4` when newer releases land.
5. **Non-technical roles return `skills: []`** — ~60% of jobs (sales, ops, restaurant, support). Model correctly returns []. Matcher must not require skills as hard filter.
6. **Enrichment hits TPM ceiling on heavy backfill** — Architecture handles it (typed `LLMRateLimitError` → abort, idempotency → resume next day). Mitigated by 500ms throttle. Daily output ~50-100 jobs per `daily-enrich.yml` run during backfill.
7. **DOCX resume upload not implemented** — `extractText` throws clear error. Requires `mammoth` install + branch. Deferred.

### Recently resolved

- ✅ Phase 2D shipped end-to-end (LLM abstraction, Groq impl, enrichment orchestrator, CLI, cron wiring)
- ✅ Cron timeout mid-enrich — split into separate workflow files with 60min timeout for enrich
- ✅ "Groq 14k req/day" misconception in old CONTEXT.md — corrected to 1,000 RPD
- ✅ Phase 2E.1 backend shipped (schema + Zod + Server Actions + parser + CLI)
- ✅ Resume parser verified end-to-end against real PDF (38 skills, verbatim bullets, 2.4s)

---

## 8. CRITICAL FILES (current repo state)

| Concern            | Path                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Front door         | `README.md`                                                                               |
| System map         | `ARCHITECTURE.md`                                                                         |
| Working rhythm     | `COLLABORATION.md`                                                                        |
| Build narrative    | `AI_JOB_OS_SESSION_JOURNAL.md`                                                            |
| Vision             | `VISION.md`                                                                               |
| Decisions          | `docs/adr/0001-stack-decisions.md`, `0002-auth-architecture.md`, `0003-data-lifecycle.md` |
| Design DNA         | `docs/design/principles.md`                                                               |
| Cron runbook       | `docs/runbooks/cron.md`                                                                   |
| Design tokens      | `src/styles/tokens.ts`, `src/app/globals.css`                                             |
| Prisma schema      | `prisma/schema.prisma`                                                                    |
| SQL triggers       | `prisma/sql/0001_auth_signup_trigger.sql`                                                 |
| Auth               | `src/server/actions/auth.ts`, `src/app/login/*`, `src/app/signup/*`, `middleware.ts`      |
| Preferences        | `src/server/actions/preferences.ts`, `src/app/onboarding/preferences/*`                   |
| Resume upload      | `src/server/actions/resume.ts`                                                            |
| Resume parser      | `src/server/services/ai/parse-resume.ts`                                                  |
| Zod schemas        | `src/shared/schemas/preferences.ts`                                                       |
| Command palette    | `src/components/command-palette.tsx`                                                      |
| Greenhouse scraper | `src/server/services/scrapers/greenhouse*.ts`                                             |
| Ashby scraper      | `src/server/services/scrapers/ashby*.ts`                                                  |
| LLM provider       | `src/server/services/ai/llm.ts`, `groq-provider.ts`                                       |
| Job enrichment     | `src/server/services/ai/enrich.ts`                                                        |
| Scrape CLI         | `scripts/scrape.ts`                                                                       |
| Cleanup CLI        | `scripts/cleanup.ts`                                                                      |
| Enrich CLI         | `scripts/enrich.ts`                                                                       |
| Parse-resume CLI   | `scripts/parse-resume.ts`                                                                 |
| GitHub Actions     | `.github/workflows/daily-cron.yml`, `daily-enrich.yml`                                    |

---

## 9. HOW TO RESUME

Start a new session with:

> "Read CONTEXT.md first. Confirm schema field names before any code. Ready for Phase 2E.2 (matcher backend) or 2E.3 (cinematic dashboard)."

Then paste this file. I will:

1. Re-read the bar
2. Confirm the schema field names (Section 3 above)
3. Plan in plain English BEFORE writing code
4. Write code in ≤30-line chunks you can audit
5. Never re-derive context from memory

If you're starting an entirely fresh Claude (different account, no memory):
also paste `README.md`, `ARCHITECTURE.md`, and `COLLABORATION.md` for full grounding.
