# AI Job OS

An AI-powered job application platform built for international workers who need US visa sponsorship.

The system continuously scrapes US companies, filters for sponsorship-friendly roles, enriches jobs with AI-extracted structured fields, scores matches per user, and (eventually) tailors resumes per application — without ever fabricating content.

**Status:** Beta in development. Currently 1,337 real US jobs from 17 companies in DB, with AI enrichment running autonomously on daily cron.

---

## Why this exists

LinkedIn Easy Apply has broken the job market. International candidates compete with thousands of applicants per role. Recruiters use AI to filter. The signal-to-noise ratio is zero.

**This is an opinionated platform for the other side of that war.** Quality over quantity. AI as the candidate's ally. Human review before every submission. Built for the friend cohort first, public later.

For the full vision, see [`VISION.md`](./VISION.md).

---

## What's built

| Layer                                                           | Status         |
| --------------------------------------------------------------- | -------------- |
| Authentication (email + magic link, Supabase)                   | ✅             |
| User preferences (keywords, locations, experience, sponsorship) | ✅             |
| Greenhouse scraper (16 companies)                               | ✅             |
| Ashby scraper (8 companies)                                     | ✅             |
| US-only filter + owner rule engine                              | ✅             |
| 14-day dedup + 30-day TTL                                       | ✅             |
| Daily cleanup script (user-driven garbage collection)           | ✅             |
| GitHub Actions cron (daily 04:00 PT, autonomous)                | ✅             |
| Per-job parsing (resilient to schema variations)                | ✅             |
| AI enrichment (Groq-powered, provider-agnostic interface)       | ✅             |
| Per-user matcher + dashboard                                    | 🔜 next        |
| Resume tailoring                                                | 🔜             |
| Application auto-fill                                           | 🔜 (post-beta) |

---

## Stack

**Frontend:** Next.js 16 (App Router) · TypeScript 5 · Tailwind v4 · shadcn/ui · Framer Motion
**Backend:** Node.js 22 · Prisma 7 · Supabase Postgres · Supabase Auth · Zod · Pino
**Observability:** Sentry · PostHog
**AI:** Groq free tier (`llama-3.3-70b-versatile`) for beta enrichment · Claude API later for resume tailoring · provider-agnostic interface so swaps are one file
**Hosting:** Vercel (after Phase 2E) · GitHub Actions for cron

All beta-tier free. Estimated $0/month through public launch.

---

## Project documents

| File                                                             | Read when                                       |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| [`README.md`](./README.md)                                       | First time landing here                         |
| [`VISION.md`](./VISION.md)                                       | Understanding what we're building and why       |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)                           | Understanding how the system thinks             |
| [`CONTEXT.md`](./CONTEXT.md)                                     | Paste into Claude at the start of every session |
| [`COLLABORATION.md`](./COLLABORATION.md)                         | How we work with Claude (chunk sizes, rhythm)   |
| [`AI_JOB_OS_SESSION_JOURNAL.md`](./AI_JOB_OS_SESSION_JOURNAL.md) | The build story (for sharing, learning)         |
| [`docs/adr/*.md`](./docs/adr/)                                   | Why we picked specific tools/patterns           |
| [`docs/design/principles.md`](./docs/design/principles.md)       | Design language reference                       |
| [`docs/runbooks/cron.md`](./docs/runbooks/cron.md)               | How to debug the daily cron                     |

---

## Quickstart (local dev)

You need Node 22, npm, and a Supabase account.

```bash
# Clone
git clone git@github.com:pasupulasurya/pasupulasurya-ai-job-os.git
cd pasupulasurya-ai-job-os

# Install
npm install

# Copy environment template
cp .env.example .env.local
# Fill in: DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL,
#          NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
#          SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN,
#          NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST,
#          NEXT_PUBLIC_SITE_URL,
#          LLM_PROVIDER=groq, GROQ_API_KEY=gsk_...

# Push schema to your Supabase
npm run db:push

# Seed companies and scraping rules
npm run db:seed

# Run scrapers (one-time fill)
npm run scrape:gh
npm run scrape:ashby

# Run enrichment (dry-run first to verify)
npm run enrich -- --limit=5 --dry-run
npm run enrich -- --limit=20

# Verify
npm run cleanup -- --dry-run   # should show 0 eligible

# Start dev server
npm run dev
```

Open http://localhost:3000.

---

## Running the scripts

```bash
# Scraping
npm run scrape:gh                          # all Greenhouse companies
npm run scrape:gh -- --slug=anthropic      # specific company
npm run scrape:ashby                       # all Ashby companies

# Enrichment (AI-fill seniority, skills, sponsorsVisa, etc.)
npm run enrich                             # skip already-enriched (default)
npm run enrich -- --force                  # re-enrich everything (use when prompt v2)
npm run enrich -- --limit=10               # cap at N jobs (testing)
npm run enrich -- --dry-run                # call LLM, log result, no DB write

# Cleanup (lifecycle garbage collection)
npm run cleanup -- --dry-run               # safe: shows what would be deleted
npm run cleanup                            # actual
```

Output is a Pino-structured log plus a summary table. See [`docs/runbooks/cron.md`](./docs/runbooks/cron.md) for debugging.

---

## Operational health

**Cron:** runs at 04:00 PT daily. Pipeline: scrape Greenhouse → scrape Ashby → enrich new jobs → cleanup. Each step has `continue-on-error: true`.
**Logs:** Pino → Sentry on errors, PostHog for events.
**DB:** Supabase Postgres, us-east-1 region, free tier (500 MB cap).
**Daily storage growth:** ~30 new jobs/day at current scrape volume. Comfortable until ~Phase 3+.
**Enrichment throughput:** ~1,000 jobs/day on Groq free tier (`llama-3.3-70b-versatile`: 30 RPM / 6,000 TPM / 1,000 RPD). Backfill of large pools spreads over multiple days via idempotency.

To manually trigger the cron (from GitHub UI): **Actions → Daily scrape + cleanup → Run workflow**.

---

## Bar (non-negotiable)

This is a small repo built to a serious bar. Read it before contributing:

**Frontend — cinematic, Apple-grade.** OLED black, Inter Display, spring motion, 8px grid, one accent color (`#0A84FF`).

**Backend — Stripe-grade.** No `any` types. Every external input through Zod. Every async op has structured logging. No `console.log` in production code. Stays correct under partial failure.

**Tone — calm and direct.** "Done" not "Yay! All done!" No emojis in UI.

The full bar lives in [`VISION.md`](./VISION.md). The design principles in [`docs/design/principles.md`](./docs/design/principles.md). The engineering principles in [`CONTEXT.md`](./CONTEXT.md). The working rhythm in [`COLLABORATION.md`](./COLLABORATION.md).

---

## License

Private during beta. Public launch will determine licensing.

## Contact

Built by [Surya Pasupula](https://github.com/pasupulasurya).
