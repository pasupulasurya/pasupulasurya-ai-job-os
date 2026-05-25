# AI Job OS — Session Context

> **Paste this file at the start of every new session with Claude.**
> Last updated: 2026-05-25 (end of Phase 2C)

For wider context, also point readers at:

- `README.md` — front door / quickstart
- `ARCHITECTURE.md` — how the system thinks
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
- No `console.log` in production code (Pino only)
- Every API endpoint idempotent OR explicitly documented as not
- Every secret in env vars, no hardcoding
- **System stays correct under partial failure** — one malformed item must not
  reject an entire batch. Per-item try/catch at every boundary.

**Tone of voice**
"Done" not "Yay! All done!" — direct, calm, never apologetic.
No emojis in production UI. We are precise, never cute.

---

## 2. WHAT WE'VE BUILT (cumulative — all shipped to main)

- **Foundation (F1-F7):** VISION, ADRs, design tokens, observability, quality gates, command palette
- **Phase 2A:** 10-table schema, 30 US companies seeded, 12 owner rules
- **Phase 2B:** Supabase Auth + Resend SMTP + DB triggers + auth pages + middleware + onboarding
- **Phase 2C.0:** Schema additions for lifecycle (expiresAt, deletedAt, UserJobMatch.status, archivedAt, UserBlockedCompany)
- **Phase 2C.1:** Greenhouse scraper — 913 real US jobs from 11 companies
- **Phase 2C.3:** Ashby scraper — 138 jobs from 6 companies (OpenAI, Notion, Snowflake, Perplexity, Plaid, Ramp)
- **Phase 2C.4:** Daily cleanup script (`scripts/cleanup.ts`) with `--dry-run` flag, user-driven lifecycle (3 ops: auto-dismiss matches > 7d unviewed, archive rejections > 90d, hard-delete unmatched jobs > 30d)
- **Phase 2C.5:** GitHub Actions cron — daily 04:00 PT, manually verified green
- **Phase 2C.6:** Per-job parsing refactor — scalable to 200+ companies without recurring schema bugs

**Total in DB right now: ~1,328+ real US jobs across 17 active companies (DoorDash unlocked, Airbnb unlocked)**

---

## 3. EXACT SCHEMA FIELDS (Prisma 7 cheat sheet)

**Source of truth:** `prisma/schema.prisma`. Re-paste this if drift is suspected.

### User

`id, authId, email (unique), name, role, createdAt, updatedAt`

- relations: preferences, applications, jobMatches, blockedCompanies

### UserPreference

`id, userId (unique), keywords[], excludeKeywords[], locations[], jobTypes[], experienceMin, experienceMax, visaSponsorship, stemOptOnly, dailyApplyLimit, createdAt, updatedAt`

### Company ← used by scrapers

`id, slug (unique), name, ats, active, knownToSponsor, notes, lastScrapedAt, lastJobCount, createdAt, updatedAt`

- `ats`: "greenhouse" | "lever" | "ashby" | "workday"
- `active`: boolean
- **WATCH:** `ats` not `source`; `active` not `isActive`

### ScrapingRule ← used by scrapers

`id, name, ruleType, pattern, enabled, appliesTo, createdAt, updatedAt`

- `ruleType`: "exclude_keyword" | "require_location_match" | "max_age_days"
- `appliesTo`: "description" | "title" | "location" | "any"
- `enabled`: boolean
- **WATCH:** `ruleType` not `action`; `appliesTo` not `field`; `enabled` not `isActive`

### Job ← inserted by scrapers

`id, source, sourceUrl (UNIQUE), externalId, title, company, companySlug, location, remote, description (text), rawJson (json), hash, seniority, experienceYears, skills[], sponsorsVisa, stemOptFriendly, postedAt, scrapedAt, expiresAt, deletedAt, updatedAt`

- **WATCH:** `company` is a STRING (not FK), `sourceUrl` not `url`, `externalId` not `sourceJobId`, `source` is the ATS name string

### UserJobMatch

`id, userId, jobId, matchScore, status, matchedAt, viewedAt, dismissedAt, dismissed, autoDismissed`

- `status`: "fresh" | "viewed" | "applied" | "dismissed" | "rejected"

### Application

`id, userId, jobId, status, resumeId, appliedAt, notes, createdAt, updatedAt, archivedAt`

### ResumeVersion

`id, jobId (optional), contentJson, pdfUrl, docxUrl, createdAt`

### UserBlockedCompany

`id, userId, companyId, reason, blockedAt`

- `reason`: "rejected" | "not_interested" | "ghosted" | "low_quality"

### Log

`id, action, payload, level, createdAt`

---

## 4. LOCKED DECISIONS (do not re-discuss)

| Decision                  | Value                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Job TTL                   | 30 days for unmatched jobs (matched jobs live until application closes)              |
| UserJobMatch auto-dismiss | 7 days unviewed → soft-dismiss (kept for analytics)                                  |
| Application archival      | 90 days after rejection → soft-archive                                               |
| Dedup window              | 14 days (sha256 of company\|title\|location)                                         |
| Cleanup cron              | Daily 04:00 PT via GitHub Actions                                                    |
| Cleanup model             | **User-driven, not time-driven**: jobs die when no user cares; kept while applied to |
| Repository pattern        | NO — direct Prisma calls                                                             |
| AI hosting (beta)         | Groq free tier (Llama 3.3 70B)                                                       |
| Vercel deploy             | After Phase 2E (full dashboard)                                                      |
| US-only filter            | Multi-office OK (any segment US → accept)                                            |
| Rule patterns             | Regex (case-insensitive)                                                             |
| Server-only guard         | Only on supabase-server.ts (not prisma/logger/posthog)                               |
| Git workflow              | Direct commits to main acceptable for solo work                                      |
| Schema strictness         | **Strict on fields we use; permissive on metadata.** Per-job parse + try/catch.      |

---

## 5. SCRAPER ARCHITECTURE (`src/server/services/scrapers/`)

| File                   | Purpose                                                | Reusable across scrapers? |
| ---------------------- | ------------------------------------------------------ | ------------------------- |
| `greenhouse.schema.ts` | Zod schema: `parseGreenhouseJobsArray` + per-job parse | No (provider-specific)    |
| `greenhouse.ts`        | Greenhouse orchestrator (per-job try/catch)            | No (provider-specific)    |
| `ashby.schema.ts`      | Zod schema: `parseAshbyJobsArray` + per-job parse      | No (provider-specific)    |
| `ashby.ts`             | Ashby orchestrator (per-job try/catch)                 | No (provider-specific)    |
| `location.ts`          | `isUSLocation()`, `hasUSLocation()`                    | ✅ YES — pure function    |
| `hash.ts`              | `jobHash(slug, title, location)` SHA-256               | ✅ YES — pure function    |
| `rules.ts`             | `applyRules()` owner-rule engine                       | ✅ YES — pure function    |

**Critical pattern (added Phase 2C.6):** Fetch validates only `{ jobs: unknown[] }`. Each job is then parsed individually in a try/catch. Malformed jobs increment `skippedMalformed` and continue. **Companies with weird schemas don't cause 0-fetched aborts anymore.**

CLI: `scripts/scrape.ts` with provider dispatcher.
Cleanup: `scripts/cleanup.ts` with `--dry-run` flag.
npm scripts: `scrape:gh`, `scrape:ashby`, `cleanup`.

GitHub Actions cron: `.github/workflows/daily-cron.yml`
Runbook: `docs/runbooks/cron.md`

---

## 6. WHAT REMAINS

### Phase 2C (CLOSED ✅)

All scrapers + cleanup + cron shipped and running autonomously.

### Phase 2D — AI enrichment via Groq (next session)

- LLM abstraction layer (model-agnostic: Groq | Claude | OpenAI via env var)
- Extract per job: seniority, experienceYears, skills, sponsorsVisa, stemOptFriendly
- ~$0/month using Groq free tier (14k req/day)
- Files to create: `src/server/services/ai/llm.ts` (interface), `groq-provider.ts`, `enrich.ts` (orchestrator)
- One batch job to enrich existing 1,328 jobs; then daily for new scrapes

### Phase 2E — Matcher + Dashboard

- Populate `UserJobMatch` per user (keyword + AI-extracted-field match)
- Build `/dashboard` at Apple-grade bar
- Filters: location, remote, sponsorship, experience, etc.
- Later: pgvector semantic match

### Phase 2F — Deploy to Vercel

### Phase 2G+ — Resume tailoring, PDF gen, Playwright auto-fill (review-only), Gmail intelligence

### Future scraper expansion

- Lever scraper (~30 min, only Cohere in DB right now)
- Workday scraper (large effort, hostile target)
- Workable scraper (unlocks Hugging Face)
- Rippling's own ATS (their own API)

---

## 7. KNOWN ISSUES (live, accepted)

1. **Null bytes** — ~0.3% of Greenhouse jobs have `\u0000` in description. We strip from text fields, but a handful slip through nested JSON. Accepted.
2. **Coinbase** — Greenhouse API returns 404 from GitHub Actions runners (likely IP filter). Shows up as 1 fetch_failed per cron run. Will resolve if Coinbase changes their filter, OR we proxy through a residential IP later.
3. **Linear (ashby), Supabase (ashby)** — non-US / European-only. Filter correctly rejects all jobs. Expected behavior.
4. **GitHub Actions Node.js 20 deprecation** — June 2026. Need to bump `actions/checkout@v4` and `actions/setup-node@v4` when GitHub releases newer versions.

### Recently resolved

- ✅ Airbnb — was returning 0 fetched. Fixed by accepting `boolean` in `metadata.value`.
- ✅ DoorDash — wrong slug + metadata.value as object. Fixed slug + per-job parsing.
- ✅ Notion / Plaid / Rippling / Snowflake — moved to Ashby (correct ATS).
- ✅ Per-company schema variations causing 0-fetched aborts — solved by per-job parse refactor.

---

## 8. CRITICAL FILES (current repo state)

| Concern            | Path                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Front door         | `README.md`                                                                               |
| System map         | `ARCHITECTURE.md`                                                                         |
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
| Command palette    | `src/components/command-palette.tsx`                                                      |
| Greenhouse scraper | `src/server/services/scrapers/greenhouse*.ts`                                             |
| Ashby scraper      | `src/server/services/scrapers/ashby*.ts`                                                  |
| CLI runner         | `scripts/scrape.ts`                                                                       |
| Cleanup runner     | `scripts/cleanup.ts`                                                                      |
| GitHub Actions     | `.github/workflows/daily-cron.yml`                                                        |

---

## 9. HOW TO RESUME

Start a new session with:

> "Read CONTEXT.md first. Confirm schema field names before any code. Ready for Phase 2D (or 2E)."

Then paste this file. I will:

1. Re-read the bar
2. Confirm the schema field names (Section 3 above)
3. Plan in plain English BEFORE writing code
4. Write code in ≤30-line chunks you can audit
5. Never re-derive context from memory

If you're starting an entirely fresh Claude (different account, no memory):
also paste `README.md` and `ARCHITECTURE.md` for full grounding.
