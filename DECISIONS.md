# AI Job OS — Project Decisions Log

> **THE BAR:** Cinematic frontend (Apple-grade) + world-class backend (Stripe-grade).
> Every line of code is checked against `VISION.md` and `docs/design/principles.md`.
> No shortcuts. No "we'll clean it up later."

## North star documents
- `VISION.md` — what we're building and why
- `docs/adr/` — Architecture Decision Records (one per major choice)
- `docs/design/principles.md` — design language, codified

---
# AI Job OS — Project Decisions Log

## Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Component library:** shadcn/ui (Radix-based)
- **Preset:** Nova (Lucide icons + Geist font)
- **Linter:** ESLint
- **Directory:** `src/`

## Auth & DB (planned)
- **Database:** Supabase PostgreSQL (free tier)
- **ORM:** Prisma
- **Auth:** Supabase Auth

## Hosting & Infra (planned)
- **Hosting:** Vercel (free tier)
- **Queue:** BullMQ + Upstash Redis
- **Cron:** GitHub Actions
- **AI:** Ollama + Qwen 2.5 (local, free)
- **Scraping:** Playwright (self-hosted)

## Beta plan
- 10 friends, 3-week beta
- 5 apps/day per user during beta
- Human review mandatory, no auto-submit
- Daily DB backup to local machine

## Phases (build order)
1. ✅ Foundation (Next.js + Tailwind + shadcn)
2. ⏳ Supabase + Prisma + tables
3. ⏳ Greenhouse scraper (first ATS)
4. ⏳ Deduplication
5. ⏳ AI analysis
6. ⏳ Resume tailoring
7. ⏳ PDF/DOCX gen
8. ⏳ Dashboard
9. ⏳ Playwright auto-fill
10. ⏳ Human review UI
11. ⏳ Submission engine
12. ⏳ Email intelligence (Gmail API)
13. ❌ 3D dashboard — SKIPPED (vanity)

## Today's progress
- [x] GitHub repo created
- [x] SSH auth set up
- [x] Next.js installed (TS + Tailwind + App Router)
- [x] shadcn/ui initialized (button, card, input)
- [X] Supabase project + tables
- [X] Prisma setup
- [ ] First Greenhouse scrape
## Phase 2 architecture (locked)
- Scrape: ATS-driven, scheduled via cron (not user-triggered)
- Filter: 2 layers — owner rules (hard) + per-user keywords (soft)
- ATS support v1: Greenhouse, Lever, Ashby (Workday in week 2)
- Coverage week 1: 30 hand-picked US companies
- US-only: strict (location must match US city/state/"Remote US")
- Auth: Supabase email/password + magic link
- Job storage: shared/deduped, per-user matches via UserJobMatch
## Prisma 7 setup (locked)
- Provider: `prisma-client` (new lean Rust-free client)
- Output: `src/generated/prisma` (gitignored, regenerated via postinstall)
- Adapter: `@prisma/adapter-pg` (mandatory in v7)
- Env loading: explicit via `dotenv` (v7 doesn't auto-load)
- Pool tuning: `connectionTimeoutMillis: 5000`, `idleTimeoutMillis: 10000`, `max: 10`
- Import path: `@/generated/prisma/client` (app), `../src/generated/prisma/client` (scripts)

## Phase 2A — DONE
- [x] 9 tables in Supabase
- [x] 30 US companies seeded
- [x] 12 scraping rules seeded
- [x] Prisma 7 client + adapter working
