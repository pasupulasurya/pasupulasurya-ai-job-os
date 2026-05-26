# Working with Claude on AI Job OS

How we collaborate. Paste this alongside README.md, ARCHITECTURE.md, and CONTEXT.md when starting a new Claude chat.

## 1. The rhythm

Every change follows this loop:

1. Claude proposes the change in plain English
2. Surya confirms or pushes back
3. Claude sends ONE chunk of code with a terminal command to save it
4. Surya runs the command, runs verification, pastes the output
5. If clean, Claude sends the next chunk
6. If errors, Claude diagnoses; loop returns to step 3

No skipping steps. Plan first, audit each chunk.

## 2. Code always comes with a save command

When Claude sends code, it MUST include the bash command to save it. Use cat redirect with a heredoc so Surya can paste-and-save in one step. Without it, manual copy-paste into nano is error-prone for files over 50 lines.

For edits to existing files, Claude includes clear "find this, change to this" instructions.

## 3. Chunk size: roughly 30 lines per send

A 200-line file goes in about 7 chunks. Each chunk is independently auditable, saves to disk before the next chunk, and is verified before continuing. Pure config or schema files can ship whole.

## 4. Verification commands

After every change, run as needed:

- npx tsc --noEmit : TypeScript check
- npm run db:generate : after schema.prisma changes
- npm run lint : style and format
- npm run scrape:gh -- --slug=anthropic : test one scraper
- npm run cleanup -- --dry-run : safe cleanup test
- git status : see what is about to commit
- wc -l filepath : sanity-check file size
- head -10 filepath : sanity-check top of file

Claude says which to run. Surya pastes the output. Claude reads it before sending the next chunk.

## 5. Push back is welcome

If Surya says something that contradicts ADRs, CONTEXT.md decisions, VISION.md, or the "stays correct under partial failure" pattern, Claude pushes back. Polite, specific, with reason.

Surya responds with: "Yes, fix that" / "I hear you but here is why I want this" / "Defer it, log as known issue."

## 6. Decision tree for ambiguous moments

When spec is unclear:

1. Is the answer in CONTEXT.md Sections 3-4? Use it.
2. Is it in ARCHITECTURE.md? Use it.
3. Is it in prisma/schema.prisma? Read the file.
4. None of the above? Ask ONE clarifying question with 2-4 options.

Never ask "what do you want?" Always offer options with a recommendation.

## 7. Phase structure

Phases have clear done states. Shipped: 2A, 2B, 2C. In progress: 2D (AI enrichment). Next: 2E (matcher + dashboard), 2F (Vercel), 2G+ (resume tailoring).

Inside a phase, work is broken into auditable steps. Each step is one or more chunks, each step verifiable.

## 8. Debugging works the boundary

Bugs almost always live at a boundary:

- External API to Zod: schema rejects real-world variation. Curl, inspect, relax for unused fields.
- Code to Prisma: field name typo. Read prisma/schema.prisma.
- Server Action to DB: server-only import in client. Check import chain.
- Cron to secrets: wrong env var name. Match GitHub secrets to env block.
- Scrape to insert: Postgres rejects. Check stripNullBytes and dedup hash.

Never assume TypeScript is wrong. Almost always: the source of truth said something Claude forgot to read.

## 9. Closing rituals

Before ending a session: git add, commit, push. Update CONTEXT.md if state changed (job counts, features shipped, known issues). If ending mid-step, leave CONTEXT.md unchanged.

## 10. What this does not cover

- What we are building: VISION.md, README.md
- How the system works: ARCHITECTURE.md
- Current state and schema: CONTEXT.md
- Why specific tools: docs/adr/
- How to run scrapers and debug cron: docs/runbooks/

This file is purely about the working rhythm. Read once, refer back when something feels off.
