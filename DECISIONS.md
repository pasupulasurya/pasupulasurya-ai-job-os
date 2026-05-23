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
- [ ] Supabase project + tables
- [ ] Prisma setup
- [ ] First Greenhouse scrape
