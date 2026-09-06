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


