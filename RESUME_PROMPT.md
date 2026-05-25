# How to resume AI Job OS in a new Claude chat

Two scripts depending on what you need.

---

## Script A — "Continuing the build" (full context)

Paste this message into the new Claude chat:

---

> I'm building **AI Job OS** — an AI-powered job application platform for international workers needing US visa sponsorship. The backend is autonomous (daily cron scraping 24 companies, ~1,328 real US jobs in DB). Frontend is partially built (auth + onboarding done, dashboard not built yet).
>
> I'm going to paste 3 documents below. Read them in this order:
>
> 1. **README.md** — what this project is and what's built
> 2. **ARCHITECTURE.md** — how the system thinks, the patterns, the bar
> 3. **CONTEXT.md** — exact schema, locked decisions, current state
>
> After reading, before you write a single line of code:
>
> 1. Confirm you've absorbed THE BAR (Apple-grade frontend, Stripe-grade backend, no `any`, Zod everywhere, Pino logs, no `console.log` in production)
> 2. Confirm the exact schema field names by quoting them back to me
> 3. Ask which phase I want to work on (Phase 2D = AI enrichment, Phase 2E = matcher + dashboard, or something else)
> 4. Plan in plain English BEFORE writing code
> 5. Write code in ≤30-line chunks I can audit
> 6. Never re-derive context from memory — re-read schema.prisma or schema files if uncertain
>
> Here are the 3 documents:
>
> --- README.md ---
> [paste contents of README.md]
>
> --- ARCHITECTURE.md ---
> [paste contents of ARCHITECTURE.md]
>
> --- CONTEXT.md ---
> [paste contents of CONTEXT.md]

---

## Script B — "Quick question" (just a focused chat)

For debugging one thing, getting a code review, asking about a specific decision. Don't need the full ceremony.

Paste this into a new Claude:

---

> I'm working on AI Job OS — a Next.js 16 + Prisma 7 + Supabase + TypeScript project. Tech stack: Tailwind v4, shadcn/ui, Framer Motion, Pino, Zod, Groq.
>
> The bar: Apple-grade UI (OLED black, spring motion, 8px grid), Stripe-grade backend (no `any`, Zod everywhere, Pino logs, no `console.log`). User-driven garbage collection (jobs die when no user cares, not on calendar).
>
> Specific question: [YOUR QUESTION HERE]
>
> Here's the relevant file:
>
> [paste only the file(s) needed]

---

## How to get the document contents fast

When you open a new chat, you need to paste the docs INTO that chat. Run these on your machine and copy the output:

```bash
# For Script A — paste all 3
cd ~/Documents/pasupulasurya-ai-job-os
cat README.md       # copy output → paste
cat ARCHITECTURE.md # copy output → paste
cat CONTEXT.md      # copy output → paste
```

Or paste them all at once (Mac):

```bash
{ echo "--- README.md ---"; cat README.md; echo; \
  echo "--- ARCHITECTURE.md ---"; cat ARCHITECTURE.md; echo; \
  echo "--- CONTEXT.md ---"; cat CONTEXT.md; } | pbcopy
```

That copies everything formatted into your clipboard. Then paste once into the Claude chat.

---

## When to use which script

| Situation                                                         | Script                       |
| ----------------------------------------------------------------- | ---------------------------- |
| Starting a new build session, new chat                            | **A**                        |
| Stuck on a bug, need a focused fix                                | **B**                        |
| Different account / fresh Claude that has never seen this project | **A**                        |
| Reviewing your own architecture decision                          | **B**                        |
| Onboarding a teammate or hire to the project                      | **A** + a 15-min walkthrough |

---

## What this gives you

- **Portable**: works on any Claude account, any model
- **Self-contained**: no reliance on memory features
- **Disciplined**: Claude is forced to confirm context before writing code
- **Resumable**: build sessions feel continuous even when they're not
- **Future-proof**: the docs evolve, the script doesn't change
