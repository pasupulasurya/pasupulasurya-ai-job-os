# AI Job OS — Session Context

> **Paste this file at the start of every new session with Claude.**
> Last updated: 2026-05-25

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

## 2. WHAT WE'VE BUILT (cumulative — all shipped to main)

- Foundation (F1-F7): VISION, ADRs, design tokens, observability, quality gates, command palette
- Phase 2A: 10-table schema, 30 US companies seeded, 12 owner rules
- Phase 2B: Supabase Auth + Resend SMTP + DB triggers + auth pages + middleware + onboarding
- Phase 2C.0: Schema additions for lifecycle (expiresAt, deletedAt, UserJobMatch.status, archivedAt, UserBlockedCompany)
- Phase 2C.1: Greenhouse scraper — **913 real US jobs from 11 companies**
- Phase 2C.3: Ashby scraper — **138 additional jobs from 6 companies (OpenAI, Notion, Snowflake, Perplexity, Plaid, Ramp)**

**Total in DB right now: 1,051 real US jobs across 17 companies**

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
| Git workflow              | Direct commits to main acceptable for solo work        |

---

## 5. EXISTING SCRAPER FILES (`src/server/services/scrapers/`)

| File                   | Purpose                                  | Reusable across scrapers? |
| ---------------------- | ---------------------------------------- | ------------------------- |
| `greenhouse.schema.ts` | Zod schema for Greenhouse API            | No (provider-specific)    |
| `greenhouse.ts`        | Greenhouse orchestrator                  | No (provider-specific)    |
| `ashby.schema.ts`      | Zod schema for Ashby API                 | No (provider-specific)    |
| `ashby.ts`             | Ashby orchestrator                       | No (provider-specific)    |
| `location.ts`          | `isUSLocation()`, `hasUSLocation()`      | ✅ YES — pure function    |
| `hash.ts`              | `jobHash(slug, title, location)` SHA-256 | ✅ YES — pure function    |
| `rules.ts`             | `applyRules()` owner-rule engine         | ✅ YES — pure function    |

CLI: `scripts/scrape.ts` with provider dispatcher.
npm scripts: `scrape:gh`, `scrape:ashby`.

---

## 6. WHAT REMAINS

### Phase 2C (still in flight)

- Phase 2C.2 — Lever scraper (deferred — only 1 company in DB: Cohere)
- Phase 2C.4 — Daily cleanup script (`scripts/cleanup.ts` — 4 SQL ops)
- Phase 2C.5 — GitHub Actions cron for scrape + cleanup
- Phase 2C.6 — Airbnb Zod bug (1,224 jobs hidden, deferred)
- Phase 2C.7 — Coinbase 404 (anti-bot, may need User-Agent tweak)

### Phase 2D — AI enrichment via Groq

- LLM abstraction layer (model-agnostic: Groq | Claude | OpenAI via env var)
- Extract per job: seniority, experienceYears, skills, sponsorsVisa, stemOptFriendly
- ~$0/month using Groq free tier (14k req/day)

### Phase 2E — Matcher + Dashboard

- Populate UserJobMatch per user
- Build /dashboard at Apple-grade bar
- Match by keywords + (later) pgvector semantic match

### Phase 2F — Deploy to Vercel

### Phase 2G+ — Resume tailoring, PDF gen, Playwright auto-fill, Gmail intelligence

---

## 7. KNOWN ISSUES (small, deferred)

1. ~3 Greenhouse jobs per scrape fail with `\u0000` byte (~0.3% — accepted)
2. Airbnb (greenhouse) returns 0 fetched despite 1,224 jobs in API
3. Coinbase (greenhouse) returns 404 from some IPs
4. Rippling moved to its own ATS (`ats.rippling.com`) — marked inactive
5. Hugging Face uses Workable — deferred until Workable scraper exists
6. Supabase (ashby) and Linear (ashby) are non-US / European-only

---

## 8. CRITICAL FILES (current repo state)

| Concern            | Path                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| Architecture       | `VISION.md`, `docs/adr/*.md`, `docs/design/principles.md`                            |
| Design tokens      | `src/styles/tokens.ts`, `src/app/globals.css`                                        |
| Prisma schema      | `prisma/schema.prisma`                                                               |
| SQL triggers       | `prisma/sql/0001_auth_signup_trigger.sql`                                            |
| Auth               | `src/server/actions/auth.ts`, `src/app/login/*`, `src/app/signup/*`, `middleware.ts` |
| Preferences        | `src/server/actions/preferences.ts`, `src/app/onboarding/preferences/*`              |
| Command palette    | `src/components/command-palette.tsx`                                                 |
| Greenhouse scraper | `src/server/services/scrapers/greenhouse*.ts`                                        |
| Ashby scraper      | `src/server/services/scrapers/ashby*.ts`                                             |
| CLI runner         | `scripts/scrape.ts`                                                                  |

---

## 9. HOW TO RESUME

Start a new session with:

> "Read CONTEXT.md first. Confirm schema field names before any code. Ready for Phase 2C.[N]."

Then paste this file. I will:

1. Re-read the bar
2. Confirm the schema field names (Section 3 above)
3. Plan in plain English BEFORE writing code
4. Write code in ≤30-line chunks you can audit
5. Never re-derive context from memory
