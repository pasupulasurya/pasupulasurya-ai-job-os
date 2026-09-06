# AI Job OS

An AI-powered job application platform built for international workers who need US visa sponsorship.

The system continuously scrapes US companies, filters for sponsorship-friendly roles, enriches jobs with AI-extracted structured fields, scores matches per user, tailors a resume per application without fabricating content, and fills the application form in the user's own browser for human review before submission.

**Status:** Live beta at https://pasupulasurya-ai-job-os.vercel.app. 100+ sponsor-verified companies (seeded against federal H-1B records), daily autonomous cron, per-user matcher that closes the iteration loop in real time, resume tailoring with verification, and a Chrome extension that fills Greenhouse applications end-to-end. Built for a friend cohort first, public later.

---

## Why this exists

LinkedIn Easy Apply has broken the job market. International candidates compete with thousands of applicants per role. Recruiters use AI to filter. The signal-to-noise ratio is zero.

**This is an opinionated platform for the other side of that war.** Quality over quantity. AI as the candidate's ally. Human review before every submission — the system never auto-submits.

For the full vision, see [`VISION.md`](./VISION.md).

---

## What's built

| Layer                                                               | Status  |
| ------------------------------------------------------------------- | ------- |
| Authentication (email + magic link, Supabase)                       | Live    |
| User preferences (keywords, locations, experience, sponsorship)     | Live    |
| Greenhouse + Ashby scrapers                                         | Live    |
| Title pre-filter (exclusion model) + US-only + owner rule engine    | Live    |
| 14-day dedup + 30-day TTL + user-driven cleanup                     | Live    |
| GitHub Actions cron (autonomous, daily)                             | Live    |
| AI enrichment (Groq, provider-agnostic interface)                   | Live    |
| Per-user matcher + dashboard (content-addressed cache)              | Live    |
| Full onboarding pipeline (welcome → profile → resume → preferences) | Live    |
| Country picker + DOCX upload + strict routing guards                | Live    |
| Synchronous matcher re-run on save (real-time iteration loop)       | Live    |
| Sponsor-verified company seeding (USCIS H-1B inverted join)         | Live    |
| Resume tailoring with two-layer verification + ATS-safe PDF         | Live    |
| Dashboard: full matched set + server-side filters + pagination      | Live    |
| Chrome extension: fills Greenhouse applications (never submits)     | Live    |
| Lever + Ashby apply adapters                                        | Planned |
| LLM custom-question answers + Gmail outcome tracking                | Planned |

---

## Stack

**Frontend:** Next.js 16.2 (App Router, Turbopack) · TypeScript 5 · Tailwind v4 · Framer Motion 12 · Lucide icons
**Backend:** Node.js 22 · Prisma 7.8 · Supabase Postgres · Supabase Auth (`@supabase/ssr`) · Zod 4 · Pino · unpdf (PDF text) · mammoth (DOCX text) · @react-pdf/renderer (ATS-safe PDF output)
**Observability:** Sentry · PostHog
**AI (free tier only):** Groq across two models — `llama-3.1-8b-instant` for high-volume job enrichment (500k TPD), `llama-3.3-70b-versatile` for resume parsing + match reasons (100k TPD). Cerebras `gpt-oss-120b` for resume tailoring (1M TPD). Provider-agnostic interface so swaps are one file. **Free-tier-only is a locked decision — paying a penny for inference is the defeat condition.**
**Hosting:** Vercel (Hobby tier, auto-deploys main) · GitHub Actions for cron

All beta-tier free. Estimated $0/month through public launch.

---

## Project documents

| File                                                             | Read when                                                                  |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`README.md`](./README.md)                                       | First time landing here                                                    |
| [`VISION.md`](./VISION.md)                                       | Understanding what we're building and why                                  |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)                           | Understanding how the system thinks                                        |
| [`CONTEXT.md`](./CONTEXT.md)                                     | Current state + decisions; paste into Claude at the start of every session |
| [`COLLABORATION.md`](./COLLABORATION.md)                         | How we work with Claude (chunk sizes, rhythm)                              |
| [`AI_JOB_OS_SESSION_JOURNAL.md`](./AI_JOB_OS_SESSION_JOURNAL.md) | The full dated build narrative                                             |
| [`docs/adr/*.md`](./docs/adr/)                                   | Why we picked specific tools/patterns                                      |
| [`docs/design/principles.md`](./docs/design/principles.md)       | Design language reference                                                  |
| [`docs/runbooks/`](./docs/runbooks/)                             | How to operate + debug the cron and deploy                                 |

---

## Quickstart (local dev)

You need Node 22, npm, and a Supabase account.

```bash
git clone git@github.com:pasupulasurya/pasupulasurya-ai-job-os.git
cd pasupulasurya-ai-job-os
npm install
cp .env.example .env.local
# Fill in: DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL,
#          NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
#          SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN,
#          NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST,
#          NEXT_PUBLIC_SITE_URL,
#          LLM_PROVIDER=groq, GROQ_API_KEY=gsk_..., CEREBRAS_API_KEY=...
npm run db:push      # push schema to your Supabase
npm run db:seed      # companies + scraping rules
npm run scrape:gh    # one-time fill
npm run scrape:ashby
npm run enrich -- --limit=5 --dry-run   # verify enrichment wiring
npm run enrich -- --limit=20
npm run dev
```

Open http://localhost:3000.

> **Schema changes use `npm run db:push` only — never `prisma migrate dev`** (it would offer a destructive reset against the existing drift). Pre-flight any DB-touching change with a NULL/integrity check.

---

## Running the scripts

```bash
# Scraping
npm run scrape:gh                          # all Greenhouse companies
npm run scrape:gh -- --slug=anthropic      # specific company
npm run scrape:ashby                       # all Ashby companies

# Enrichment (AI-fill seniority, skills, sponsorsVisa, etc.)
npm run enrich                             # skip already-enriched (default)
npm run enrich -- --force                  # re-enrich everything (use on version bump)
npm run enrich -- --limit=10               # cap at N jobs (testing)
npm run enrich -- --dry-run                # call LLM, log result, no DB write

# Cleanup (lifecycle garbage collection)
npm run cleanup -- --dry-run               # safe: shows what would be deleted
npm run cleanup                            # actual
```

Output is a Pino-structured log plus a summary table. See [`docs/runbooks/cron.md`](./docs/runbooks/cron.md) for debugging.

---

## Operational health

**Cron:** two GitHub Actions workflows — "Daily scrape + cleanup" at 11:00 UTC, "Daily enrich" (enrich → match → reasons) at 12:00 UTC. Each step has `continue-on-error: true`.
**Logs:** Pino → Sentry on errors, PostHog for events.
**DB:** Supabase Postgres, free tier (500 MB cap). Curated inflow (title pre-filter + 30-day TTL) keeps steady-state well under the cap.
**Enrichment throughput:** Groq free tier. `llama-3.1-8b-instant` real limits (curl-verified): 30 RPM / 6,000 TPM / 500,000 TPD ≈ ~430 enrichments per cron run. Resume parsing + reasons use `llama-3.3-70b-versatile` (100,000 TPD). Backfill of large pools spreads over multiple days via versioned idempotency.

To manually trigger: **Actions → Daily scrape + cleanup → Run workflow**.

---

## Bar (non-negotiable)

This is a small repo built to a serious bar. Read it before contributing:

**Frontend — cinematic OLED black, Inter Display, spring motion, 8px grid, one accent color (`#0A84FF`).
**Backend ** No `any` types. Every external input through Zod. Every async op has structured logging. No `console.log` in production code. Stays correct under partial failure.
**Tone — calm and direct.** "Done," not "Yay! All done!" No emojis in UI.
**Never fabricate.** Resume tailoring re-emphasizes truth, never invents it. The system never auto-submits an application.
**Free tier only.** Paying a penny for inference is the defeat condition.

The full bar lives in [`VISION.md`](./VISION.md), the engineering principles in [`CONTEXT.md`](./CONTEXT.md), the design language in [`docs/design/principles.md`](./docs/design/principles.md), and the working rhythm in [`COLLABORATION.md`](./COLLABORATION.md).

---

## License

Private during beta. Public launch will determine licensing.

## Contact

Built by [Surya Pasupula](https://github.com/pasupulasurya).
