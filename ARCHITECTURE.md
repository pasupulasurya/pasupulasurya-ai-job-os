# AI Job OS — Architecture

How the system thinks. Read this before contributing.

---

## 1. The data flow

┌─────────────────────────────────────────────────────────────┐
│ EXTERNAL ATSes (Greenhouse, Ashby, Lever future) │
│ — public JSON APIs, no auth, ~free │
└────────────────────────┬────────────────────────────────────┘
│ fetch + Zod-validate top level
▼
┌─────────────────────────────────────────────────────────────┐
│ SCRAPER (src/server/services/scrapers/_.ts) │
│ ────────────────────────────────────────────── │
│ For each raw job: │
│ 1. Per-job Zod parse (try/catch — bad jobs skip) │
│ 2. hasUSLocation() — drop non-US │
│ 3. applyRules() — drop sponsorship/clearance/citizen │
│ 4. jobHash() — dedup vs 14-day window │
│ 5. stripNullBytes() — sanitize for Postgres │
│ 6. INSERT into Job with expiresAt = now + 30d │
└────────────────────────┬────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ POSTGRES (Supabase) │
│ — Job table is the shared pool of opportunities │
└────────────────────────┬────────────────────────────────────┘
│
┌──────────┴──────────┐
▼ ▼
┌──────────────────────┐ ┌──────────────────────┐
│ AI ENRICHMENT (2D) │ │ CLEANUP CRON │
│ — Groq LLM extracts: │ │ — Daily 04:00 PT │
│ seniority, skills, │ │ — 3 ops: │
│ sponsorship hints │ │ _ auto-dismiss 7d │
│ — writes back to Job │ │ _ archive 90d │
│ (in-place enrich) │ │ _ delete unmatched │
└──────────┬───────────┘ └──────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ MATCHER (2E) │
│ For each user × each Job: │
│ - keyword match on title/description │
│ - rule scoring on UserPreference │
│ - INSERT into UserJobMatch with matchScore │
└──────────┬──────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────────────┐
│ DASHBOARD (/dashboard) │
│ — Reads UserJobMatch JOIN Job │
│ — Filters: location, remote, sponsor, exp │
│ — Cinematic Apple-grade UI │
└─────────────────────────────────────────────────────────────┘---

## 2. Layered code structuresrc/

├── app/ # Next.js App Router pages and route handlers
│ ├── (auth)/ # /login, /signup, /auth/callback
│ ├── onboarding/ # First-time UserPreference flow
│ ├── dashboard/ # (2E) main view for logged-in users
│ ├── api/ # API routes (very few — we prefer Server Actions)
│ └── globals.css # CSS variables (design tokens)
│
├── server/ # SERVER-ONLY code. Never imported by client.
│ ├── lib/ # Cross-cutting infrastructure
│ │ ├── prisma.ts # Prisma singleton (no server-only guard — CLI uses this)
│ │ ├── logger.ts # Pino structured logger
│ │ ├── supabase-server.ts # HTTP cookie-bound (server-only guarded)
│ │ ├── supabase-admin.ts # Service-role admin client
│ │ └── posthog.ts # Analytics (no server-only guard)
│ ├── actions/ # Next.js Server Actions (use server)
│ │ ├── auth.ts # signup/signin/signout
│ │ └── preferences.ts # save UserPreference
│ └── services/ # Business logic, called by actions or scripts
│ ├── scrapers/ # ATS-specific scrapers + shared pure functions
│ └── ai/ # (2D) LLM abstraction layer
│
├── shared/ # Zod schemas shared between client and server
├── lib/ # Client-safe utilities (Tailwind merge, formatters, etc.)
├── components/ # React components (shadcn/ui + custom)
├── styles/ # tokens.ts (design constants)
└── generated/prisma/ # Auto-generated Prisma client. Never edit by hand.
scripts/ # CLI tools, run via tsx
├── scrape.ts # Provider dispatcher: scrape:gh, scrape:ashby
└── cleanup.ts # Daily lifecycle ops
prisma/
├── schema.prisma # Source of truth for ALL DB models
├── seed.ts # 30 companies + 12 owner rules
└── sql/ # Raw SQL we maintain by hand
└── 0001_auth_signup_trigger.sql
.github/workflows/
└── daily-cron.yml # GitHub Actions cron at 04:00 PT
docs/
├── adr/ # Architectural Decision Records
├── design/principles.md # Design DNA
└── runbooks/ # How to operate the systemThe boundaries are real:

- **`src/server/`** can import from `server/`, `shared/`, `lib/`. Never imports from `app/`.
- **`src/app/`** can call Server Actions and import shared schemas. Cannot import `server/lib` or `server/services` directly from client components.
- **`scripts/`** can import from `server/` (CLI is server context). Why `prisma.ts` removed its `import "server-only"` guard.

---

## 3. The bar — what it forces and why

### Zod everywhere (no `any`)

Every external input — API response, form body, env var — passes through a Zod schema. We catch malformed data **at the boundary**, not deep in business logic.

**Critical pattern (Phase 2C.6):** at the boundary, validate only the SHAPE (`{ jobs: unknown[] }`). Then per-item, parse with try/catch. One malformed item logs `skippedMalformed` and continues. **Companies with weird metadata don't cause batch aborts.**

### Pino structured logs at every async boundary

`logger.info({ slug, fetched }, "scrape.greenhouse.fetched")` — every event has a key like `domain.subject.action` and a structured object. Searchable in Sentry, groupable, machine-readable. Never `console.log`.

### Every API endpoint is idempotent

Running a scrape twice → 0 new inserts. Running cleanup twice → no double-archives. Idempotency comes from:

- **Job: `sourceUrl @unique`** — second insert of same URL fails the UNIQUE constraint
- **Hash-based dedup** — same `sha256(company|title|location)` within 14 days → skip
- **Cleanup conditions are stateful** — `WHERE archivedAt IS NULL` etc.

### System stays correct under partial failure

This is the spirit of "Stripe-grade." Not "no failures" — but **graceful degradation**:

- 1 bad job out of 1,000 → log + skip, keep 999
- 1 bad company out of 16 → `continue-on-error: true`, run the rest
- 1 cleanup op fails → others still run
- Cron returns non-zero → Sentry alerts but DB stays consistent

---

## 4. Patterns we use and why

### Pure functions over abstractions

`location.ts`, `hash.ts`, `rules.ts` are **pure functions**. No I/O, no Prisma, no state. They take inputs, return outputs.

**Why:** they're unit-testable, reusable across scrapers (Greenhouse, Ashby, future Lever all use the same `hasUSLocation`), and easy for a new contributor to reason about.

### No repository pattern

We call `prisma.job.create({ ... })` directly from the scraper. No intermediate "JobRepository" class.

**Why:** for a solo project with 1 user (Prisma) of the DB layer, the abstraction costs more than it saves. We can introduce it later if multiple services need the same query patterns. Until then, the type system + Prisma's strict types are enough.

### Direct Server Actions over API routes

Form submissions call `'use server'` functions, not POST to `/api/preferences`. This:

- Eliminates an HTTP hop
- Type-checks the function signature end-to-end
- Doesn't require client-side fetch logic

**Exception:** the daily cron and webhook receivers (later) will use API routes.

### Schema = source of truth for types

We never write a TypeScript `interface Job { ... }`. We let Prisma generate the types from `schema.prisma`, and we let Zod infer types from schemas via `z.infer<typeof XxxSchema>`. **One source of truth, two consumers.**

### User-driven garbage collection (not time-driven)

The cleanup model is unusual: **jobs die when no user cares about them**, not on calendar dates.

- A scraped job with 0 matches and 0 applications → if 30 days old, delete.
- A scraped job a user matched to → kept while UserJobMatch lives.
- A scraped job a user applied to → kept indefinitely until application closes.
- UserJobMatch unviewed for 7 days → soft-dismiss (kept for analytics).
- Application rejected for 90 days → soft-archive (still queryable).

**Why:** jobs aren't milk. Their value is the user's relationship to them. Calendar-based TTL would delete jobs your friend is mid-application on.

---

## 5. Adding a new feature

### To add a new ATS scraper (e.g., Lever, Workable)

1. Read the ATS's public API. Inspect a real response (`curl ... | head -c 2000`).
2. Create `src/server/services/scrapers/<provider>.schema.ts` — Zod schema. Strict on fields you use, permissive elsewhere. Export `parseXxxJobsArray` and `parseXxxJob`.
3. Create `src/server/services/scrapers/<provider>.ts` — orchestrator. Copy the structure of `greenhouse.ts` or `ashby.ts`. Per-job try/catch.
4. Add the provider to `scripts/scrape.ts` dispatcher.
5. Add `scrape:<provider>` to `package.json` scripts.
6. Add `Scrape <Provider>` step to `.github/workflows/daily-cron.yml` with `continue-on-error: true`.
7. Seed companies with `ats = "<provider>"`.
8. Run `npm run scrape:<provider> -- --slug=<one>` to test.
9. Commit, push, manually trigger cron to verify in CI.

### To add a new field to UserPreference

1. Edit `prisma/schema.prisma`.
2. `npm run db:push` (no migration — beta phase).
3. Update the onboarding UI (`src/app/onboarding/preferences/page.tsx`).
4. Update the Server Action that saves preferences (`src/server/actions/preferences.ts`).
5. (Later) update the matcher to use the new field.

### To add an owner-level rule

Just `INSERT` into the `ScrapingRule` table via SQL. The scraper auto-loads enabled rules on every run. No code change needed.

### To handle a Sentry alert

See `docs/runbooks/cron.md`.

---

## 6. Where the safety nets are

| Concern                                  | Safety net                                                  |
| ---------------------------------------- | ----------------------------------------------------------- |
| Bad data from external API               | Zod per-job validation, skipped jobs logged                 |
| Duplicate inserts                        | `sourceUrl @unique` on Job, hash-based 14-day dedup         |
| Postgres null-byte rejection             | `stripNullBytes()` recursive sanitizer on all writes        |
| Lost-then-applied job preservation       | Cleanup only deletes jobs with 0 matches AND 0 applications |
| Orphaned auth.users in production schema | DB trigger auto-creates User+UserPreference on signup       |
| Cron silently failing                    | Sentry alerts + GitHub Actions email                        |
| Schema drift between code and DB         | `npx tsc --noEmit` after every change; pre-commit hook      |
| Bad commit messages                      | Commitlint enforces conventional format                     |
| Unformatted code                         | Husky + lint-staged auto-formats on commit                  |
| One ATS breaking the whole cron          | `continue-on-error: true` on each scrape step               |
| One job's malformed schema               | Per-job try/catch in orchestrator                           |
| Hardcoded secrets                        | env vars only; GitHub repo secrets for cron                 |
| Forgetting the bar                       | This file, `VISION.md`, `CONTEXT.md` all reference it       |

---

## 7. Things we explicitly do NOT do (and why)

| Don't                                           | Why                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| Use `any` types                                 | Type safety is the whole point of TypeScript                      |
| Write `console.log` in production code          | Pino is structured, searchable, Sentry-routable                   |
| Fabricate resume content                        | Product principle from VISION                                     |
| Auto-submit applications without human review   | Product principle from VISION                                     |
| Reproduce copyrighted job descriptions verbatim | Legal + product principle                                         |
| Build a repository abstraction over Prisma      | Premature abstraction for solo dev                                |
| Use Drizzle ORM                                 | Prisma 7 is mature enough; migrations are first-class             |
| Use Clerk for auth                              | Supabase already in stack; one fewer provider                     |
| Use MongoDB                                     | We need referential integrity (Job ↔ User ↔ Application ↔ Resume) |
| Build a custom auth flow                        | Supabase Auth + magic link is faster and more secure              |
| Self-host the Postgres                          | Supabase free tier covers beta                                    |
| Pay for AI inference during beta                | Groq free tier is 14k req/day                                     |
| Animate UI with linear easing                   | Apple-grade means spring-based motion only                        |
| Use multiple accent colors                      | One accent: `#0A84FF`. Restraint is part of the bar               |
| Use emojis in production UI                     | We are precise, not cute                                          |

---

## 8. Where to look first when something breaks

1. **Cron failure** → `docs/runbooks/cron.md`. Then Sentry. Then re-run with `--dry-run` locally.
2. **Schema drift** (TypeScript errors after pulling main) → `npm run db:generate`. If still broken, paste `schema.prisma` into a Claude session and ask for the diff.
3. **A specific company returning 0** → `curl https://boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true | head -c 2000` and inspect manually. The slug might be wrong, or they may have moved ATS.
4. **A job inserted with weird data** → check `rawJson`. We store the full response, so the source of truth is always there.
5. **Auth not working** → verify Supabase callback URL in dashboard, check Resend SMTP, check DB trigger exists in `prisma/sql/`.

---

## 9. Resuming from a fresh context

If you're a new contributor (human or AI):

1. Read this file end-to-end.
2. Read `VISION.md` — what we're building and the bar.
3. Read `CONTEXT.md` — current state.
4. Skim `docs/adr/` — why we picked specific tools.
5. Open `prisma/schema.prisma` — the data model in 200 lines.
6. Run `npm run scrape:gh -- --slug=anthropic` locally — see the pipeline in action.

You should be able to contribute meaningfully in 1-2 hours.
