# AI Job OS — Architecture

How the system thinks. Read this before contributing.

---

## 1. The data flow─────────────────────────────────────────────────────────────┐

│ EXTERNAL ATSes (Greenhouse, Ashby, Lever future) │
│ — public JSON APIs, no auth, ~free │
└────────────────────────┬────────────────────────────────────┘
│ fetch + Zod-validate top level
▼
┌─────────────────────────────────────────────────────────────┐
│ SCRAPER (src/server/services/scrapers/\*.ts) │
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
┌───────────────┼───────────────┐
▼ ▼ ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ AI ENRICHMENT │ │ CLEANUP CRON │ │ MATCHER (2E) │
│ (LIVE 2D) │ │ — Daily 04 PT │ │ — Per user×Job │
│ — Groq LLM │ │ — 3 ops: │ │ — Title kwds │
│ — Extracts: │ │ auto-dismiss │ │ — AI-field │
│ seniority │ │ archive 90d │ │ overlap │
│ exp years │ │ delete │ │ — INSERT into │
│ skills[] │ │ unmatched │ │ UserJobMatch │
│ sponsorsVisa │ └────────────────┘ └───────┬────────┘
│ stemOpt │ │
│ — Idempotent: │ │
│ enrichedAt + │ │
│ version skip │ │
│ — Writes back │ │
│ to Job │ │
└────────────────┘ │
▼
┌─────────────────────────────────────┐
│ DASHBOARD (/dashboard) │
│ — Reads UserJobMatch JOIN Job │
│ — Filters: loc, remote, sponsor, │
│ exp, seniority, skills │
│ — Cinematic Apple-grade UI │
└─────────────────────────────────────┘---

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
│ └── ai/ # LLM provider abstraction + enrichment orchestrator
│ ├── llm.ts # Provider interface + typed error hierarchy + factory
│ ├── groq-provider.ts # Groq impl (retry, timeout, Retry-After, JSON mode)
│ └── enrich.ts # Orchestrator: idempotency, per-job try/catch, writeback
│
├── shared/ # Zod schemas shared between client and server
├── lib/ # Client-safe utilities (Tailwind merge, formatters, etc.)
├── components/ # React components (shadcn/ui + custom)
├── styles/ # tokens.ts (design constants)
└── generated/prisma/ # Auto-generated Prisma client. Never edit by hand.
scripts/ # CLI tools, run via tsx
├── scrape.ts # Provider dispatcher: scrape:gh, scrape:ashby
├── cleanup.ts # Daily lifecycle ops
└── enrich.ts # AI enrichment runner
prisma/
├── schema.prisma # Source of truth for ALL DB models
├── seed.ts # 30 companies + 12 owner rules
└── sql/ # Raw SQL we maintain by hand
└── 0001_auth_signup_trigger.sql
.github/workflows/
└── daily-cron.yml # Scrape + enrich + cleanup at 04:00 PT
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

Every external input — API response, form body, env var, **LLM response** — passes through a Zod schema. We catch malformed data **at the boundary**, not deep in business logic.

**Critical pattern (Phase 2C.6):** at the boundary, validate only the SHAPE (`{ jobs: unknown[] }`). Then per-item, parse with try/catch. One malformed item logs `skippedMalformed` and continues. **Companies with weird metadata don't cause batch aborts.**

**Same pattern applies to LLM output (Phase 2D):** the provider passes the model's content through a caller-supplied Zod schema. Validation failures throw `LLMValidationError` carrying `rawOutput` for debugging. One bad enrichment doesn't kill the batch.

### Pino structured logs at every async boundary

`logger.info({ slug, fetched }, "scrape.greenhouse.fetched")` — every event has a key like `domain.subject.action` and a structured object. Searchable in Sentry, groupable, machine-readable. Never `console.log` (CLI scripts excepted for human stdout).

### Every API endpoint is idempotent

Running a scrape twice → 0 new inserts. Running cleanup twice → no double-archives. Running enrich twice → 0 re-enrichments. Idempotency comes from:

- **Job: `sourceUrl @unique`** — second insert of same URL fails the UNIQUE constraint
- **Hash-based dedup** — same `sha256(company|title|location)` within 14 days → skip
- **Cleanup conditions are stateful** — `WHERE archivedAt IS NULL` etc.
- **Enrichment predicate** — `WHERE enrichedAt IS NULL OR enrichmentVersion != current` → re-runs skip already-done work; bumping the version string re-enriches all

### System stays correct under partial failure

This is the spirit of "Stripe-grade." Not "no failures" — but **graceful degradation**:

- 1 bad job out of 1,000 → log + skip, keep 999
- 1 bad company out of 16 → `continue-on-error: true`, run the rest
- 1 cleanup op fails → others still run
- 1 LLM call returns invalid JSON → log + skip that job, continue batch
- Groq returns 429 → 3-attempt retry with `Retry-After` honor; if still throttled, abort cleanly (cron resumes tomorrow via idempotency)
- Cron returns non-zero → Sentry alerts but DB stays consistent

---

## 4. Patterns we use and why

### Pure functions over abstractions

`location.ts`, `hash.ts`, `rules.ts` are **pure functions**. No I/O, no Prisma, no state. They take inputs, return outputs.

**Why:** they're unit-testable, reusable across scrapers (Greenhouse, Ashby, future Lever all use the same `hasUSLocation`), and easy for a new contributor to reason about.

### Provider-agnostic LLM interface

`llm.ts` defines a single `LLMProvider` interface with `generate({ system, user, schema })`. Groq is one implementation. Swapping to Claude API later is **one new file (`claude-provider.ts`) + one switch case in the factory + an env var change.** No call sites change.

Typed error hierarchy is part of the interface — providers must throw `LLMAuthError | LLMRateLimitError | LLMTransportError | LLMValidationError`. The orchestrator's `instanceof` dispatch is provider-independent: auth/rate-limit abort, validation/transport continue.

**Why:** during beta we want Groq's free tier. After launch we may want Claude for quality. The interface lets us A/B without rewriting the orchestrator.

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

### Versioned enrichment

`ENRICHMENT_VERSION` is a module-scoped constant in `enrich.ts`. When the prompt changes, bump the version string (e.g. `groq-llama-3.3-70b-v1` → `v2`). The idempotency predicate `WHERE enrichmentVersion != current` automatically re-enriches every job on the next run.

**Why:** prompts will evolve. We need a clean way to refresh derived fields without manually wiping columns or building a separate migration tool.

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

### To add a new LLM provider (e.g., Claude API)

1. Create `src/server/services/ai/<provider>-provider.ts`. Implement the `LLMProvider` interface from `llm.ts`. Map HTTP status codes to the typed error hierarchy.
2. Add a case in `getLLMProvider()` factory: `if (process.env.LLM_PROVIDER === "<provider>") { ... }`
3. Set env vars: `LLM_PROVIDER=<provider>`, `<PROVIDER>_API_KEY=...`. Add to GitHub repo secrets for cron.
4. Smoke-test via `npm run enrich -- --limit=1 --dry-run`.
5. **No changes needed in `enrich.ts`.** Provider abstraction is the whole point.

### To change the enrichment prompt

1. Edit `SYSTEM_PROMPT` or `buildUserPrompt()` in `enrich.ts`.
2. Bump `ENRICHMENT_VERSION` (e.g. `groq-llama-3.3-70b-v1` → `v2`).
3. Commit. Next cron run will re-enrich every job because the version no longer matches. No manual data wipe needed.

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

| Concern                                  | Safety net                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Bad data from external API               | Zod per-job validation, skipped jobs logged                                                    |
| Duplicate inserts                        | `sourceUrl @unique` on Job, hash-based 14-day dedup                                            |
| Postgres null-byte rejection             | `stripNullBytes()` recursive sanitizer on all writes                                           |
| Lost-then-applied job preservation       | Cleanup only deletes jobs with 0 matches AND 0 applications                                    |
| Orphaned auth.users in production schema | DB trigger auto-creates User+UserPreference on signup                                          |
| Cron silently failing                    | Sentry alerts + GitHub Actions email                                                           |
| Schema drift between code and DB         | `npx tsc --noEmit` after every change; pre-commit hook                                         |
| Bad commit messages                      | Commitlint enforces conventional format                                                        |
| Unformatted code                         | Husky + lint-staged auto-formats on commit                                                     |
| One ATS breaking the whole cron          | `continue-on-error: true` on each scrape step                                                  |
| One job's malformed schema               | Per-job try/catch in orchestrator                                                              |
| LLM returns invalid JSON                 | `LLMValidationError` thrown; one bad job logs + skipped, batch continues                       |
| LLM hits rate limit                      | 3-attempt retry with `Retry-After` honor; if exhausted, abort cleanly; tomorrow's cron resumes |
| LLM auth failure mid-batch               | `LLMAuthError` aborts immediately on job 1, not job 47                                         |
| Re-enriching same job repeatedly         | `enrichedAt IS NOT NULL AND enrichmentVersion = current` predicate                             |
| Stale enrichment after prompt change     | Bump `ENRICHMENT_VERSION` constant → idempotency predicate re-enriches all                     |
| Hardcoded secrets                        | env vars only; GitHub repo secrets for cron                                                    |
| Forgetting the bar                       | This file, `VISION.md`, `CONTEXT.md`, `COLLABORATION.md` all reference it                      |

---

## 7. Things we explicitly do NOT do (and why)

| Don't                                           | Why                                                                              |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| Use `any` types                                 | Type safety is the whole point of TypeScript                                     |
| Write `console.log` in production code          | Pino is structured, searchable, Sentry-routable                                  |
| Fabricate resume content                        | Product principle from VISION                                                    |
| Fabricate enrichment values to fill nulls       | Tri-state nullable booleans exist for a reason: model returns `null` when unsure |
| Auto-submit applications without human review   | Product principle from VISION                                                    |
| Reproduce copyrighted job descriptions verbatim | Legal + product principle                                                        |
| Build a repository abstraction over Prisma      | Premature abstraction for solo dev                                               |
| Hardcode the LLM provider                       | Provider interface + env var = swap in one file                                  |
| Use Drizzle ORM                                 | Prisma 7 is mature enough; migrations are first-class                            |
| Use Clerk for auth                              | Supabase already in stack; one fewer provider                                    |
| Use MongoDB                                     | We need referential integrity (Job ↔ User ↔ Application ↔ Resume)                |
| Build a custom auth flow                        | Supabase Auth + magic link is faster and more secure                             |
| Self-host the Postgres                          | Supabase free tier covers beta                                                   |
| Pay for AI inference during beta                | Groq free tier (`llama-3.3-70b-versatile`): 30 RPM / 6,000 TPM / 1,000 RPD       |
| Animate UI with linear easing                   | Apple-grade means spring-based motion only                                       |
| Use multiple accent colors                      | One accent: `#0A84FF`. Restraint is part of the bar                              |
| Use emojis in production UI                     | We are precise, not cute                                                         |

---

## 8. Where to look first when something breaks

1. **Cron failure** → `docs/runbooks/cron.md`. Then Sentry. Then re-run with `--dry-run` locally.
2. **Schema drift** (TypeScript errors after pulling main) → `npm run db:generate`. If still broken, paste `schema.prisma` into a Claude session and ask for the diff.
3. **A specific company returning 0** → `curl https://boards-api.greenhouse.io/v1/boards/<slug>/jobs?content=true | head -c 2000` and inspect manually. The slug might be wrong, or they may have moved ATS.
4. **A job inserted with weird data** → check `rawJson`. We store the full response, so the source of truth is always there.
5. **Auth not working** → verify Supabase callback URL in dashboard, check Resend SMTP, check DB trigger exists in `prisma/sql/`.
6. **Enrichment failing on every job** → check `LLM_PROVIDER` and `GROQ_API_KEY` env vars. Run `npm run enrich -- --limit=1 --dry-run` locally to isolate the failure mode (auth vs validation vs transport).
7. **Enrichment skipping every job** → confirm `ENRICHMENT_VERSION` hasn't been bumped accidentally. Idempotency predicate may be excluding everything.

---

## 9. Resuming from a fresh context

If you're a new contributor (human or AI):

1. Read this file end-to-end.
2. Read `VISION.md` — what we're building and the bar.
3. Read `CONTEXT.md` — current state.
4. Read `COLLABORATION.md` — how we work with Claude (chunk sizes, verification rhythm).
5. Skim `docs/adr/` — why we picked specific tools.
6. Open `prisma/schema.prisma` — the data model in ~200 lines.
7. Run `npm run scrape:gh -- --slug=anthropic` locally — see the pipeline in action.
8. Run `npm run enrich -- --limit=5 --dry-run` — see the AI enrichment in action.

You should be able to contribute meaningfully in 1-2 hours.
