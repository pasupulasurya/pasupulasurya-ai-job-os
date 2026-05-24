# ADR 0001: Initial Stack Decisions

**Status:** Accepted
**Date:** 2026-05-23
**Authors:** Surya Pasupula

## Context

We are building an AI-powered job application platform. The initial cohort
is 10 friends; the public launch follows. The product must feel
cinematic (Apple-grade frontend) and operate at world-class reliability
(Stripe-grade backend). We need a stack that delivers both, ships fast
during a closed beta, and scales without redesign.

## Decisions

### Frontend
- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5.x, strict mode
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui (Radix-based) + custom motion layer
- **Motion:** Framer Motion (spring-based, primary)
- **Fonts:** Inter Display + Inter + JetBrains Mono (via next/font)
- **Theme:** Dark default, light optional, via next-themes

### Backend
- **Runtime:** Node.js 22.x on Vercel serverless functions
- **Database:** Supabase PostgreSQL (free tier during beta)
- **ORM:** Prisma 7 with @prisma/adapter-pg driver adapter
- **Auth:** Supabase Auth (email/password + magic link)
- **Validation:** Zod (every external input)
- **Logging:** Pino (structured JSON)
- **Error tracking:** Sentry (free tier)
- **Analytics:** PostHog (free tier)

### Background jobs / scraping
- **Scraper runtime:** Node.js fetch (Greenhouse/Lever/Ashby APIs)
- **Browser automation:** Playwright (Workday, later)
- **Scheduling:** GitHub Actions cron (beta) → Inngest/Vercel Cron (prod)

### AI
- **Local dev:** Ollama + Qwen 2.5 (free)
- **Production:** Claude API or OpenAI API (TBD post-beta)

### Deployment
- **Hosting:** Vercel (free tier)
- **DB region:** us-east-1 (matches Supabase)
- **CDN:** Vercel built-in

## Why these choices (not others)

| Considered | Rejected because |
|---|---|
| Drizzle ORM | Prisma's type-safety + migrations are more mature for our team size |
| Clerk for auth | Supabase Auth keeps us on one provider; cheaper at scale |
| MongoDB | We need relational integrity (Job ↔ User ↔ Application ↔ Resume) |
| Trigger.dev | GitHub Actions is free and sufficient for beta volume |
| Inertia/Remix | Next.js has the largest ecosystem; we leverage shadcn + Vercel cleanly |

## Consequences

### Positive
- One platform (Supabase) covers DB + Auth + Storage + Realtime
- Vercel + Next.js gives us global edge with zero ops
- Prisma 7's driver adapter cleanly works with Supabase pooler
- Free tier covers the entire beta period

### Trade-offs accepted
- Prisma 7 is bleeding-edge (released Nov 2025); fewer tutorials, faster API churn
- Supabase free tier pauses after 1 week of inactivity (mitigation: daily health-check cron)
- Vercel serverless cold starts (~300ms) — acceptable for beta, revisit if it hurts UX

### Risks to monitor
- Supabase free tier: 500MB DB cap (mitigation: prune old job postings weekly)
- GitHub Actions: 2000 free min/mo (mitigation: monitor usage, fall back to self-host)
- Workday scraping is hostile (mitigation: deferred to Phase 2 of scraper work)
