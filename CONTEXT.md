# AI Job OS — Session Context

## ⚡ NEXT TASK (queued 2026-06-21) — Preferences form: require targetRoles, not keywords

**Decision: Option A** — require >=1 targetRole (scorer's primary 35pt/title signal), make
keywords optional (10pt/description). The forms currently do the OPPOSITE of the scorer:
keywords required (min 3), targetRoles labeled "Optional". Every new user fills keywords,
skips targetRoles, gets title=0 on everything -> bad matches. Layer 4 / inverted-onboarding
bug, live in BOTH settings and onboarding.

**Scope — 4 files around a shared schema spine (must stay consistent, do together):**

1. src/shared/schemas/preferences.ts — flip: targetRoles min(1), keywords optional (drop
   the min(3)). THE SPINE — used by both forms + savePreferencesAction.
2. src/app/(app)/settings/\_components/preferences-form.tsx — reorder targetRoles first/
   primary, keywords second/optional; fix canSave (keywords.length>=3 -> targetRoles>=1);
   fix hint + the misleading "match against job titles and skills" copy.
3. src/app/onboarding/preferences/page.tsx + \_components/preferences-client-form.tsx — same
   emphasis fix; ALSO fix inverted seeding (roles seed targetRoles, skills seed keywords) +
   misleading copy. New-user path — highest priority.

**Why deferred:** 4-file coordinated change around a shared validation spine; changing the
schema alone makes the other form inconsistent. Wanted a fresh session — a subtle miss =
broken onboarding for ALL new users (invisible until someone can't onboard).

**Open sub-decision:** min targetRoles 1 vs 2 (lean 1 — one title activates the 35pt scorer).

---

## ⚡ SESSION 2026-06-21 (afternoon) — READ FIRST

Dashboard rework + matcher reconciliation. All shipped & deployed to main.

### Shipped & DEPLOYED

- **Dashboard = actionable matches only** (#28): query shows only status fresh/viewed
  scoring >=40; applied jobs leave the dashboard (-> Applications), dismissed/rejected
  excluded, stale sub-40 rows hidden. Windowed pager replaced the render-all-N-pages bug.
- **Title is the JD link** (#29): job title is an anchor (LinkTag const — dodges the §4F
  <a-eating pipeline trap) opening sourceUrl + marking viewed. Eye button removed.
- **Matcher reconciliation** (#30 version-based, then #31 Fix A): force runs DELETE stale
  fresh/viewed rows. v1 keyed on matchVersion != current FAILED on stable hashes (the
  experience override changed scoring inputs WITHOUT bumping parseVersion, so old 5y rows
  shared the current hash). Fix A reconciles by "jobId NOT IN upserted-this-run set" —
  force-only, empty-set guarded. Verified 690 fossils deleted. Never touches applied/
  dismissed/rejected.
- **Un-apply / back-to-dashboard** (#32): unapplyApplicationAction(applicationId) — atomic
  txn flips UserJobMatch -> viewed + deletes the Application row. "Not applied" button on
  Applications page, only on applied-status rows. Round-trip verified live.

### Reasons (AI paragraph) — how it works

- Generated for the **top-10 matches per user only** (by design, free-tier quota).
  scripts/reasons.ts --user=<id> (also --all-users/--limit/--force/--dry-run). Groq
  llama-3.3-70b, ~5s. NOT a bug that rank-11+ have no paragraph.
- GOTCHA: any manual --force re-score changes the match set -> top-10 reasons go stale ->
  MUST re-run reasons.ts after. (Enhancement: auto-trigger at end of force run.)

### EXPERIENCE — still a fragile override (LANDMINE)

- totalYearsExperience=2 via scripts/set-experience.ts (local, uncommitted, edits parsedJson).
  Holds, but REVERTS to 5 on any resume re-parse — and doesn't bump parseVersion, so
  reconciliation can't tell eras apart (this broke recon v1). A re-parse silently floods
  senior jobs back. Proper fix = gap-aware years in parse-resume.ts. HIGH PRIORITY.

### PENDING (Surya's list, my recommended order)

1. **Experience parser fix** (Thread 4) — gap-aware years in parse-resume.ts. Removes the
   override landmine. Then re-parse + re-score + re-run reasons.
2. **Reasons reach** — raise top-10 to 25/50, OR on-demand on card view (best for free-tier).
3. **7-day auto-dismiss sweep** — autoDismissed field exists; VERIFY if a sweep cron is built.
   If not: auto-dismiss (reversible) fresh-never-viewed matches older than N days.
4. **Keyword suggestions on cards** — surface suggested keywords/roles per card.
5. **Tailoring speed** — slow (free-tier LLM). Deep; own session.
6. **Tailoring harness** — "checks with master, verify with user" — NEEDS CLARIFICATION of
   current vs desired behavior before scoping.
7. **PDF single-page + design** — current output disliked; want clean single page. Own session.
8. **"associate" targeting** — pulls in non-technical biz/ops roles (reason-gen flagged a
   DoorDash B2B Audience Analyst as non-fit in top-10). Drop or pair with technical keywords.

### §4F workflow rule (ADD to §4F)

- ALWAYS `git checkout main && git pull` BEFORE `git checkout -b newbranch`. Branching off a
  stale/pre-merge branch repeatedly caused duplicate-commit cleanups (scorer, dashboard,
  title-link); each fixed via cherry-pick onto fresh main.

---

## ⚡ SESSION 2026-06-21 (morning)

**Context:** Deep diagnostic session. Root cause of "no new jobs on dashboard"
was a chain of matcher/onboarding bugs, NOT scraping or enrichment.

### Shipped & DEPLOYED (on main)

- **Scraper "Remote US" fix** (PR #25). hasUSLocation() was dropping "Remote US"
  jobs at every company. Also externalId in dedup hash; lastJobCount=insertedNew.
  Verified Affirm 2->61. **Pool-wide scrape NOT yet run — only Affirm fresh.**
- **Scorer redesign** (PR #27). Weights: title 35 (targetRoles vs title) /
  experience 25 / skills 15 / keywordsInJD 10 (keywords vs title+description) /
  sponsorship 15 (falls back to Company.knownToSponsor). location & salary removed.
  Verified 1,343 matches (was 2). **Overrides §4 locked weights — update §4.**

### The remaining root cause — EXPERIENCE (Thread 4)

- totalYearsExperience parses as 5 (counts 2023-25 masters gap as work) -> user
  reads as SENIOR -> senior roles rank top.
- **Stopgap applied:** override to 2 via scripts/set-experience.ts (local,
  uncommitted). Re-scored -> 683 right-fit matches, senior dropped. FRAGILE —
  reverts to 5 on any resume re-parse.
- **Proper fix (do fresh):** gap-aware experience in parse-resume.ts. Then
  re-parse + re-score.

### Pending (filed)

- **Layer 4:** onboarding/preferences still seeds keywords from skills + roles
  into targetRoles with old labels — INVERTED under new scorer. Fix seeding +
  form copy so new users aren't broken.
- Match cron timeout: enrich starves match in daily-enrich.yml (60-min cap).
- locations still in match-version hash (harmless).
- Local uncommitted: scripts/peek-score.ts, scripts/set-experience.ts.

### NEXT SESSION task order

1. Experience parser fix (Thread 4) -> re-parse -> re-score.
2. Layer 4 onboarding reseed + form copy.
3. Pool-wide scrape. Document weight redesign in §4.

---

> **Paste this file at the start of every new session with Claude.**
> Last updated: 2026-06-12 — Phase 2K.1 shipped. Production live at https://pasupulasurya-ai-job-os.vercel.app. 101 sponsor-verified companies, daily cron self-sustaining, resume tailoring + ATS-safe PDF live, Chrome apply-extension fills Greenhouse end-to-end (never submits), dashboard shows the full filterable matched set.

For wider context, also point readers at:

- `README.md` — front door / quickstart
- `ARCHITECTURE.md` — how the system thinks
- `COLLABORATION.md` — how we work together
- `AI_JOB_OS_SESSION_JOURNAL.md` — full dated build narrative (every session log lives there now; this file carries only durable state + decisions)

---

## 1. THE BAR (non-negotiable)

**Frontend — cinematic, Apple-grade**
True OLED black (`#000000`). Inter Display + Inter fonts. Spring motion only
(`snappy`, `smooth`, `gentle` from `src/styles/tokens.ts`). 8px grid.
One accent: `#0A84FF`. Lucide icons at stroke 1.5. Dark default, light is a port.

**Backend — Stripe-grade**

- NO `any` types in TypeScript — ever
- Every external input through Zod (not just typed)
- Every async operation has Pino structured logging
- No `console.log` in production code (Pino only; CLI scripts excepted)
- Every API endpoint idempotent OR explicitly documented as not
- Every secret in env vars, no hardcoding
- **System stays correct under partial failure** — per-item try/catch at every boundary
- **FREE TIER ONLY.** No paid APIs. No credit cards. Paying a penny for inference is the defeat condition for this project. Every model choice, every architecture decision honors this. If a problem requires paid services to solve, we redesign or accept the constraint — we do not pay.

**Tone of voice** — Direct, calm, never apologetic. No emojis in UI.

**Product principle** — **Never fabricate content.** Resume tailoring rewrites and re-emphasizes, but cannot invent facts. Locked/Tailored split enforces this in architecture. The matcher's signal text is machine-generated from its own logic (not LLM-fabricated). Suggested skill and target-role chips surface only what the resume parser extracted — never invented. This extends to marketing: the landing page states only what is actually live.

---

## 2. PHASE LEDGER (one line each — full detail in the journal)

- **Foundation (F1–F7):** VISION, ADRs, design tokens, observability, quality gates, Cmd+K command palette.
- **2A:** 10-table schema, US companies seeded, owner rules.
- **2B:** Supabase Auth + SMTP + DB triggers + auth pages + middleware + onboarding shell.
- **2C:** Greenhouse + Ashby scrapers, cleanup, daily cron, per-job parse.
- **2D:** LLM provider abstraction, Groq impl with retry+throttle, enrichment orchestrator, CLI.
- **2E.1–2E.5:** Schema expansion, resume parser+upload, 6-dimension matcher, reason generator, functional dashboard, full onboarding pipeline (welcome→profile→resume→preferences), mobile, country picker, DOCX, strict routing guards.
- **2E matcher correctness fix:** content-addressed matchVersion (SHA256 of inputs) + synchronous re-match on save. Closed the frozen-dashboard bug.
- **2F:** Vercel deploy (production live). Signed-URL upload bypasses the 4.5 MB body limit. v4 enrichment + token-budget throttle. 5 post-deploy bugs fixed.
- **2G.0–2G.3:** Cerebras provider; TailoredResume table + tailoring engine + two-layer verification + adversarial harness; tailor page UI (side-by-side, conversational gap-closing); fire-and-poll generation; ATS-safe PDF render. **Resume tailoring is live.**
- **2H.0–2H.2:** Apply fill engine (Playwright lab) → Chrome extension shell → payload API + cookie auth → 15-field fill → resume PDF attach. **Greenhouse apply fills end-to-end in the user's browser; never submits.**
- **2I:** Application tracker (`/applications`, 5-state status) + Dismissed page.
- **2J.1–2J.2:** Title pre-filter (exclusion model) + sponsor-verified company seeding via inverted USCIS H-1B join. **30 → 101 companies.**
- **2K.1:** Dashboard shows full matched set (top-10 cap was cosmetic) + server-side URL-driven filters + pagination + Apple-grade redesign. **(2K.2 pending — see §8.)**

---

## 3. EXACT SCHEMA FIELDS (Prisma 7 cheat sheet)

**Source of truth:** `prisma/schema.prisma`. Transcribed verbatim 2026-06-12.

### User

`id, authId (unique, = Supabase auth.users.id), email (unique), firstName?, lastName?, country?, phone? (E.164), role (default "user"), createdAt, updatedAt`

- Relations: preferences, applications, jobMatches, blockedCompanies, resumes, tailoredResumes, applyProfile.
- **WATCH:** firstName/lastName are nullable (`String?`) — the auth-signup trigger creates rows with only id/authId/email; names fill at /onboarding/profile.

### UserPreference

Core: `keywords[], excludeKeywords[] (default []), locations[] (default [], empty = any US), jobTypes[] (default []), experienceMin?, experienceMax?, dailyApplyLimit (default 5)`
Visa/auth: `visaSponsorship (default true), stemOptOnly (default false), visaType?, workAuthStatus?`
Comp/employment: `salaryMin?, currentEmployment?`
Targeting: `targetRoles[] (default []), avoidCompanies[] (default [])`

- Canonical enums in `src/shared/schemas/preferences.ts`.

### Company

`id, slug (unique, board token), name, ats ("greenhouse"|"lever"|"ashby"|"workday"), active (default true), knownToSponsor? (null = unknown), notes?, lastScrapedAt?, lastJobCount (default 0), createdAt, updatedAt`

- **WATCH:** `ats` not `source`; `active` not `isActive`. Index: `[ats, active]`.

### ScrapingRule

`id, name, ruleType ("exclude_keyword"|"require_location_match"|"max_age_days"), pattern, enabled (default true), appliesTo (default "description"), createdAt, updatedAt`

- **WATCH:** `ruleType`, `appliesTo`, `enabled` (not `action`/`field`/`isActive`).

### Job

Core: `id, source, sourceUrl (UNIQUE), externalId?, title, company, companySlug?, location?, remote (default false), description? (@db.Text), rawJson?, hash?`
AI-filled (2D): `seniority?, experienceYears?, skills[] (default []), sponsorsVisa? (tri-state null=unknown), stemOptFriendly?, postedAt?, enrichedAt?, enrichmentVersion?`
Lifecycle: `scrapedAt (default now), expiresAt?, deletedAt?, updatedAt`

- Relations: applications, resumeVersions, matches, tailoredResumes.
- Indexes: `[company]`, `[source]`, `[hash]`, `[scrapedAt]`.

### UserJobMatch

Core: `id, userId, jobId, matchScore (Float default 0), scoreBreakdown? (Json), reason? (@db.Text), matchVersion?`
Status: `status (default "fresh": fresh|viewed|applied|dismissed|rejected), matchedAt, viewedAt?, dismissedAt?, dismissed (default false), autoDismissed (default false)`

- Relation: `tailoredResume?` (1:1).
- **Constraints/indexes:** `@@unique([userId, jobId])`; indexes `[userId, matchScore]`, `[userId, matchVersion]`, `[dismissed]`, `[status]`, `[matchedAt]`. (The `[userId, matchScore]` index is why 2K.1 filtering needed no schema change.)
- `matchVersion` shape: `matcher-v1:${sha256_first12(inputs)}` — see §4 content-addressing.

### Application

`id, userId, jobId, status (default "draft"), resumeId?, appliedAt?, notes? (@db.Text), createdAt, updatedAt, archivedAt?`

- Status states (2I): `applied → under_consideration → interview → offer → rejected` (constants in `src/shared/data/application-status.ts`).
- Indexes: `[userId, status]`, `[status]`, `[archivedAt]`.

### ResumeVersion

`id, userId, jobId?, isMaster (default false), contentJson (raw upload), parsedJson? (AI-extracted), parsedAt?, parseVersion?, fileName?, fileSize?, createdAt`

- Relations: applications, tailoredResumes.
- parsedJson shape: `{ fullName, email, phone, location, summary, totalYearsExperience, currentRole, currentCompany, education[], workHistory[], skills[], links{} }`. **WATCH:** workHistory[].title/company are nullable in the Zod schema (real LLM output returns null for implicit titles).
- Indexes: `[userId]`, `[userId, isMaster]`.

### UserBlockedCompany

`id, userId, companyId, reason? ("rejected"|"not_interested"|"ghosted"|"low_quality"), blockedAt`

- `@@unique([userId, companyId])`; indexes `[userId]`, `[companyId]`.

### TailoredResume (2G)

`id, matchId (UNIQUE — one per match, idempotent re-use), userId, masterResumeId, jobId, tailoredJson, changeLedger (Json default "[]"), verificationResult? (null until verified), status (default "generated": generating|generated|verified|saved|failed), errorMessage? (user-facing when failed), generationVersion (e.g. "cerebras-gpt-oss-120b-tailor-v2"), tokensUsed?, createdAt, updatedAt`

- FKs: match (Cascade), user (Cascade), master (Restrict), job (Restrict).
- Master stays in ResumeVersion as locked truth; this references it via masterResumeId so non-destructive master-switching preserves provenance. PDF renders from tailoredJson on demand, never stored.
- Indexes: `[userId, status]`, `[masterResumeId]`, `[jobId]`.

### ApplyProfile (2H)

1:1 with User, lazily created on first save. **DELIBERATELY excluded from computeMatchVersion** — apply-time answers are not match inputs; changing them must never re-score jobs. null = unanswered = fill engine defers that field to the human.
Work auth: `workAuthorizedUS?, requiresSponsorship?, over18?`
Education: `degreeLevel? (high_school|associate|bachelors|masters|doctorate), schoolName?, graduationYear?`
EEO (voluntary; "decline" is a first-class answer = "prefer not to answer"): `gender? (male|female|non_binary|decline), hispanicLatino? (yes|no|decline), raceEthnicity?, veteranStatus? (not_veteran|veteran|decline), disabilityStatus? (yes|no|decline)`
Links: `linkedinUrl?, githubUrl?, portfolioUrl?`
Recurring questions: `salaryExpectation?, earliestStartDate?, willingToRelocate?, previouslyEmployed?, referredByEmployee?, howDidYouHear?`

- `id, userId (unique), createdAt, updatedAt`.

---

## 4. LOCKED DECISIONS (do not re-discuss)

> The table below is the original durable set (unchanged). Decisions added
> after the original table are grouped by phase beneath it — each was
> locked in a real session and is quoted from that session's log.

| Decision                               | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FREE TIER ONLY**                     | **No paid APIs ever. Paying a penny is the defeat condition.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Job TTL                                | 30 days for unmatched jobs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| UserJobMatch auto-dismiss              | 7 days unviewed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Application archival                   | 90 days after rejection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Dedup window                           | 14 days (sha256 of company\|title\|location)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Cleanup model                          | **User-driven, not time-driven**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Repository pattern                     | NO — direct Prisma                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **AI architecture**                    | **Per-task free-tier model selection via `params.model` override**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Enrichment model                       | `llama-3.1-8b-instant` (Groq free, 500k TPD)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Resume parsing model                   | `llama-3.3-70b-versatile` (Groq free, quality matters)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Reason generator model                 | `llama-3.3-70b-versatile` (8b followed style poorly)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Skill match                            | String intersection (lowercase + word boundary). Embeddings deferred to Phase 2H+.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **MAX_SKILLS = 20 (load-bearing)**     | NOT a sanity check — load-bearing for matcher arithmetic AND user cohort decision. Matcher uses `overlap.length / job.skills.length` (score.ts:89). Raising 20→25 would silently dilute every match score ~20% for content-rich postings. Cohort: beta users are international tech workers seeking sponsorship for early/mid-career roles. Jobs with 20+ distinct meaningful skills are senior/staff-saturated, out of cohort scope. Product-grounded, not technical — kept at 20 even when LLM returns more, even when it costs ~3% jobs that stay NULL. |
| **Zod preprocess pattern for skills**  | EnrichmentSchema.skills uses `z.preprocess((val) => [dedupe + lowercase + trim + drop <2 chars], z.array(z.string()).max(MAX_SKILLS))`. Preprocess runs BEFORE validation. Why: LLM returns duplicates + truncation fragments that inflate raw count past 20 without genuine information. Dedupe-first lets cleaned outputs pass while genuinely-over-cap (~3%) correctly fail. `sanitize()` preserved as belt-and-suspenders.                                                                                                                             |
| Groq free tier (8b-instant) — REAL     | **30 RPM / 6,000 TPM / 14,400 RPD / 500,000 TPD** — verified via curl 2026-06-04. Docs previously said 30k TPM; reality is 6k. ~1,000-1,200 tokens/enrichment caps sustained throughput at 5/min, ~415-500/UTC day. Throttle achieves ~430/cron run.                                                                                                                                                                                                                                                                                                       |
| Groq free tier (70b)                   | 1,000 RPD / 6,000 TPM / 100,000 TPD                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Enrichment version                     | `groq-llama-3.1-8b-v4` (current)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Enrichment throttle (token-budget)     | Reactive header-based: GroqProvider parses `x-ratelimit-remaining/reset-tokens` + `-requests` from every response. Pre-flight `waitForHeadroom(estimated=maxTokens*2)`; `parseResetWindow()` handles "459ms"/"6s"/"1m30s". Public interface unchanged.                                                                                                                                                                                                                                                                                                     |
| Enrichment max_tokens                  | 512                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Enrichment truncation                  | 2,000 chars                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Resume parse version                   | `groq-llama-3.3-70b-resume-v3`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Resume parse max_tokens                | 4096                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Resume parse truncation                | 12,000 chars                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Resume MAX_SKILLS                      | 80                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Reason version                         | `groq-llama-3.3-70b-reason-v1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Reason max_tokens                      | 2048                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Reason batch size                      | 10 jobs per LLM call                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Reason per-row length cap              | 900 chars                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| LLM error handling                     | Auth/rate-limit → abort batch; validation/transport → log+continue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| LLM cron schedules                     | scrape+cleanup 11:00 UTC, enrich 12:00 UTC                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Master/Tailored split**              | Master locked truth; tailoring rewrites summary/skills/bullets only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Master switching                       | Non-destructive (preserve provenance) — atomic via Prisma transaction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Signed URL upload pattern**          | 3-step flow to bypass Vercel 4.5 MB body limit. Step 1: `requestResumeUploadUrlAction(filename, fileSize, contentType)` returns `{ uploadUrl, storagePath, token }` via `createSignedUploadUrl`. Step 2: client PUTs body direct to Supabase Storage. Step 3: `uploadMasterResumeAction(storagePath)` downloads server-side, processes, deletes in finally. Net storage zero.                                                                                                                                                                              |
| **Storage bucket `resumes` config**    | Private (RLS). 5 MB limit. MIME: pdf, docx, text/plain. Path: `{auth.uid()}/{timestamp}-{sanitizedFilename}`. `sanitizeFilename()` strips `/\` + `..` + non-`[a-zA-Z0-9._-]`.                                                                                                                                                                                                                                                                                                                                                                              |
| **Storage RLS policies (3)**           | All scoped to `auth.uid()::text = (storage.foldername(name))[1]`. INSERT/SELECT/DELETE each own policy. Anonymous + cross-user rejected.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Cleanup-after-processing**           | `uploadMasterResumeAction` finally block removes storagePath, fire-and-forget. Cleanup failure logged warn; worst case a 5 MB orphan per failed upload.                                                                                                                                                                                                                                                                                                                                                                                                    |
| **MATCHER VERSION CONTENT-ADDRESSING** | `matcher-v1:${sha256_first12(stableSerialize(input))}`. Inputs hashed: all UserPreference matcher-read fields + resumeId + parseVersion. Computed in `match.ts` via `computeMatchVersion(input)`. Input change → hash change → skip-if-exists returns nothing → re-score. **The real correctness mechanism.** Self-heals; no backfill needed.                                                                                                                                                                                                              |
| **Matcher weights**                    | titleKeywords=25, skills=20, seniority=15, sponsorship=15, location=15, salary=10                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Matcher saturation**                 | 1 kw match=0.7, 2=0.9, 3+=1.0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Matcher skill dampen**               | <3 job skills → score scaled by (count/3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Matcher relevance gate**             | Cap at 35 if titleKw=0 AND skills=0 AND both have data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Matcher word matching**              | Word-boundary regex                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| MIN_SCORE_TO_PERSIST                   | 40                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Min preference keywords**            | 3 (schema rejects fewer with explanatory error)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **SYNCHRONOUS MATCHER ON SAVE**        | `savePreferencesAction` + `uploadMasterResumeAction` call `matchJobsForUser({ userId, force: true })` after persisting, in an inner try/catch (matcher failure does NOT fail the save). Summary `{ jobsConsidered, upserted, scoredAbove }` returned to client.                                                                                                                                                                                                                                                                                            |
| **PDF text extraction**                | `unpdf` (serverless-friendly, no worker). Replaced pdf-parse v2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **DOCX text extraction**               | `mammoth.extractRawText({ buffer })` only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Country picker architecture**        | Curated static list `src/shared/data/countries.ts` (250+ ISO 3166-1 alpha-2 + name + E.164 dial). No library, no flag emojis.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Phone validation (country-aware)**   | profileSchema requires country alongside phone. Normalizer detects any existing dial code (longest-prefix-match), strips, prepends selected country's. Empty → null.                                                                                                                                                                                                                                                                                                                                                                                       |
| **Drag-drop pattern**                  | Native HTML5; `useRef` counter avoids onDragLeave flicker. No react-dropzone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Upload state machine**               | 4 discriminated-union states: idle\|uploading\|success\|error. AnimatePresence + spring.snappy.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Resume file types**                  | PDF (unpdf) + DOCX (mammoth) + plain text. 5 MB max.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Mobile breakpoints**                 | `md` (768px) nav rail collapse; `sm` (640px) content stacking.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Onboarding routing strict ordering** | Centralized in `src/server/lib/onboarding.ts`. `getNextOnboardingStep(state)` first incomplete or null. `canAccessStep(step, state)` allowed/redirectTo. profile=names; resume=master exists; preferences=keywords≥3. Revisit allowed, skip-ahead bounces.                                                                                                                                                                                                                                                                                                 |
| **Action ownership check**             | All match Server Actions filter on BOTH matchId AND userId before mutation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Settings vs onboarding save**        | `savePreferencesAction(input, redirectTo)` — settings passes null to stay on page                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Route group `(app)/`**               | Shared AppShell layout; URLs unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Score ring animation**               | 48px SVG, ring + count-up via same useMotionValue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Stagger-in pattern**                 | Parent variants hidden→visible, staggerChildren 0.08; once on mount                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Suggested chips integrity**          | Surface only what parser extracted. Keyword cap 15, target role cap 5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Skill cleaning architecture**        | LLM extracts verbatim; cleaning in code via SKILL_BLOCKLIST + SKILL_CANONICAL in parse-resume.ts. LLM prompts are extraction tools, not quality filters.                                                                                                                                                                                                                                                                                                                                                                                                   |
| Schema strictness                      | Strict on used fields; permissive on metadata. workHistory.title/company nullable in Zod.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **DB migration workflow**              | `prisma db push` ONLY — never `prisma migrate dev` (would offer destructive reset due to drift). Pre-flight NULL/integrity check before pressing y.                                                                                                                                                                                                                                                                                                                                                                                                        |

### 4A. Landing + tracker decisions (2026-06-07)

- **Landing palette rule (landing surface ONLY):** `/` may use a richer palette — gradients, multiple hues (semantic tokens + violet #bf5af2), confetti. DELIBERATE; does NOT loosen the product-UI bar (dashboard/settings/onboarding stay OLED black + single accent #0A84FF + no emojis). Two surfaces, two rules. Confetti allowed on the landing demo; emojis still are not.
- **Application status model:** stored on `Application.status`. Five states in order: `applied → under_consideration → interview → offer → rejected`. Constants in `src/shared/data/application-status.ts`. `markMatchAppliedAction` flips UserJobMatch.status AND creates an idempotent Application row. `updateApplicationStatusAction` (in `application.ts`) moves between states.
- **Dismissed page (`/dismissed`) is separate from the tracker.** dismiss = not-interested pre-apply; rejected = applied-and-failed. `undismissMatchAction` reverses a dismiss.

### 4B. Settings decisions (2026-06-09)

- **Settings container width: max-w-6xl** with md:col-span-3/9 label-left/content-right grid in the SettingsSection primitive. Wider breaks reading lines on Preferences.
- **Settings = upload + see all + pick master.** Generate/tailor stays on the dashboard match flow (needs job context).
- **Master-switch is non-destructive** (setMasterResumeAction mirrors the upload action's transaction). Tailored resumes keep pointing at the master they derived from after a switch.
- **No resume delete yet.** ResumeVersion is referenced by Application + TailoredResume; proper delete needs soft-delete + policy. Visibility of all resumes covers most of the need.
- **No upload cap.** Storage nets to zero per upload; rows effectively unbounded for friend scale. Arbitrary limits without reason fail the bar.

### 4C. Tailoring (2G) decisions

- **Tailoring generation model: Cerebras gpt-oss-120b** (only viable instruction model on the free tier; reasoning overhead accepted, maxTokens 2048 default). Cerebras free tier verified via curl: 5 req/min, 150/hr, 2400/day; 30K tok/min, 1M/hr, 1M/day. Llama NOT on the current Cerebras free tier despite older docs.
- **Verification two-layer:** Layer 1 code drift check (invented numbers + DRIFT_TERM_PATTERNS), free, per-item, fails fast. Layer 2 LLM verifier, BATCHED per role. Summary verified against the FULL master corpus (surfacing unstated-but-true content from workHistory is legitimate; job-domain language absent from master is fabrication, including aspirational framing).
- **Retry-then-fallback:** flagged item gets ONE retry with violations fed back; fallback to master verbatim is worst-case (target <5%). Gap-closing has NO fallback — hard error tells the user to rephrase evidence (thin-evidence refusal is correct UX).
- **The change ledger is load-bearing:** each AI change carries skill-closed, evidence sentence, move (new vs augment), target, before/after text, parent trace. Enables verification, per-change revert, write-back.
- **Generation engine decomposed, not monolithic:** three LLM jobs only — summary rewrite, 1:1 bullet rephrase, gap-closing generation. Everything else (which skills surface, which bullets keep, ordering, single-page) is code driven by the matcher's 6-dimension breakdown.
- **No free-text editing.** User supplies truth (evidence sentences); AI supplies prose. Two user actions: structural curation + gap-closing.
- **Write-back to master fires at confirm-time** (not Save). Confirmed gap skill flows into ResumeVersion.parsedJson skills immediately. UI acknowledges the master change gently, never silently.
- **Generation on-demand, batched per-role, idempotent per match.** ~4 calls for a 4-role resume. Re-tailoring re-uses the TailoredResume row.
- **Fire-and-poll generation:** click writes a status="generating" lock row, schedules generation via Next 16 `after()`, returns instantly; page polls every 5s; survives navigation; stale locks (>10 min) retaken. KNOWN LIMIT: 5-min function window; chunked poll-driven generation is the designed fallback if prod shows deaths.
- **PDF: ATS-safe single-column.** @react-pdf/renderer (pure JS, no chromium). single column, Helvetica, real text, standard headers, left-aligned. Renders from tailoredJson on demand, never stored; same path serves Playwright/extension auto-fill.
- **Two-masters question DEFERRED.** One master, job drives everything for now (isMaster boolean + switch control both exist).

### 4D. Apply (2H) decisions

- **Fill-and-review ONLY. The system NEVER auto-submits.** Human is the final gate (non-fabrication bar applied to actions). No submit code exists.
- **Runs in the user's real browser** (Chrome extension; content script fills, dashboard Apply button signals via #aijos-apply=<matchId> marker). Hosted/server-side filling is a hard no (would require storing portal credentials). Playwright is the DEV LAB only — same engine.
- **Resume-upload-first:** upload the tailored PDF, let the portal parse, fill only leftovers. Unknown fields NEVER guessed — deferred to the human.
- **ApplyProfile EXCLUDED from computeMatchVersion** (apply answers aren't match inputs; own table enforces the boundary). **null vs decline are distinct first-class states** (null = defer to human; "decline" = user chose prefer-not-to-answer). Nothing defaults.
- **Fixed-set vs long-tail:** ApplyProfile holds only the ~20-field closed standard set. The unbounded long tail ("Why DoorDash?") is 2H.3 LLM answers with verification (SavedAnswer concept filed).
- **GH adapter reads the Job Board API for question semantics, never DOM text** (`boards-api.greenhouse.io/.../jobs/{id}?questions=true`, no auth). Generalizes per-ATS, one adapter per ATS. API = semantics, DOM = mechanics. POST submit needs the employer's key — confirms human-submit is the only path.
- **Exact-match option clicking only** (substring is a latent misfill: "Yes" inside "Yes, I have a disability").
- **Education typeahead: exact match or defer** (refused a stored typo rather than fuzzy-pick — protected the application from the user's own typo; fix was data, not code).
- **No inference between stored answers:** transgender not derivable from gender; hispanic/latino not derivable from race. Separate questions, defer if unanswered.
- **previouslyEmployed auto-fills ONLY the clean negative;** any yes/multi-flavor option defers.
- **Decision/execution split:** engine + gh-questions decide (portable to the extension verbatim); react-select needs trusted events so execution lives in the host. **react-select ignores plain .click() in content-script context — opens on mousedown; realClick() (mousedown/mouseup/click) is required.**
- **Capacity (pre-invite guard REQUIRED):** tailoring ~10-15 req + ~25K tokens/application; tokens bind first → ~40 applications/day ≈ 8-10 daily-active friends. 5 req/min = one generation at a time globally. Per-user daily tailor limit needed before inviting. Overflow levers: Groq routing, per-job caching, multi-provider round-robin.
- **Apply is GATED on a tailored resume, NOT master-fallback (locked 2026-06-13, #23).** Dashboard Apply button fires the extension (#aijos-apply marker) only when a tailored resume exists (status generated/verified/saved); else routes to the tailor page ("Tailor & Apply"). Chosen over master-fallback via the 10M-user bar test: fallback rebuilds the spray-and-pray machine the product exists to replace and spawns a "which resume?" ambiguity that fails never-fabricate. Gate is less code, scales, enforces tailored-per-job. Stated temporary intent to revisit, but the bar argument is that gate is the correct end state. KNOWN GAP this creates: see §9 — gated apply can strand users when tailoring can't complete on the free tier.

### 4E. Job-pool (2J) decisions

- **Curated inflow, not raw volume.** Bottleneck is enrichment throughput (~415-500/day Groq TPD) + DB cap (500MB), not company count. 30-day TTL → steady state = inflow × 30. Budget ~300-400 new jobs/day → ~10-12k steady state.
- **Title pre-filter is an EXCLUSION model** (`title-filter.ts`): drops only clearly-non-engineering functions (sales, marketing, recruiting, support, legal, admin, etc.); everything else enters. Chosen over an inclusion allowlist because the friend cohort is diverse (electronics, infra, civil, robotics) — an allowlist always has a hole. ~40-50% savings. `\bserver\b(?!less)` keeps Serverless Engineer. Kill switch TITLE_FILTER_ENABLED=false.
- **Sponsor seeding via INVERTED join:** verified ATS token lists (open GitHub datasets) → clean company_name per token → fuzzy-join against USCIS H-1B Employer Data Hub CSV (public, approval counts). Score threshold (≥5), NOT top-N (top-N was alphabet-biased). Live probe tier for employers ≥50 approvals (token files are partial). Seeded 71 created + 12 stamped = 101 companies.
- **knownToSponsor is a PRIOR, not a gate** — weights the sponsorship dimension only when per-job sponsorsVisa is null. Per-job extraction stays primary. Inclusion never decided by it.
- **REJECTED:** company performance tiering (overfits the pool to one user at this scale); scraping volume-first then filtering (blows DB + TPD in a week).
- **Structural finding:** mega-sponsors (Amazon, NVIDIA, Cognizant) run Workday-class enterprise ATSes, outside the GH/Ashby universe. The pool's identity is sponsor-verified startup-to-mid-market. `data/2j2/backlog.json` (375 verified companies) is the expansion roadmap when the budget ceiling rises.
- **Refresh the H-1B join QUARTERLY** (USCIS updates quarterly); re-probe tokens, seed deltas.

### 4F. Workflow rules (locked, hard-won — these prevent specific past failures)

- **Branch → push → preview → PR → squash-merge → prod.** Production never touched directly. Docs-only commits (CONTEXT/JOURNAL) go direct to main — the established exception.
- **Pre-push gate (all three):** `npx tsc --noEmit` + `npx eslint <touched files>` + `npm run build` (Turbopack — MANDATORY, catches what tsc misses). husky enforces eslint + commitlint on commit. Multi-line commit messages → write `/tmp/commit-msg.txt`, use `git commit -F`.
- **`;` not `&&` in verification chains** — `&&` exits with grep's code when match count is 0, masking what's broken. Use `;` with explicit echo labels.
- **Confirm a write actually LANDED before running gates against it** — heredocs/patch scripts have silently failed to land (twice+). grep-count the write in the SAME command chain as the gates. File-creation commands include `mkdir -p` + a landed-check.
- **This clipboard/terminal pipeline EATS a literal `<a` token** in pasted heredocs/scripts. Never paste a bare `<a`. Build it via a constant (`const ApplyTag = "a"` then `<ApplyTag>`) or concatenation (`"<"+"a"`). Every hand-over greps bare-`<a` count (want 0) in the gate chain.
- **Invalid Tailwind opacity values render NOTHING silently** (e.g. `/8`, `/14` aren't in the default scale). Use arbitrary `rgba()` syntax for off-scale opacities.
- **After a production build, `rm -rf .next` before trusting `npm run dev`** — a prior build leaves the dev server serving stale cached output while code on disk is correct.
- **Bare `tsx` skips .env.local** — repo scripts wrap with dotenv `-e .env.local` (or `npx tsx --env-file=.env.local`). A bare run dials localhost → Prisma ECONNREFUSED.
- **"verified" only against output actually seen; "merged" only after `git log` shows it on main.** "That worked" from the user is confirmation of experience, not evidence of mechanism. Twin rules. Never write a doc claiming what git doesn't confirm.
- **Read the source of truth before writing** — schema field names, existing client-component patterns, the existing auth-id mapping (User.authId, not the supabase id directly). Writing-from-memory caused the Prisma type-name wall and the authId 404.

---

## 5. AGENT DRIFT PATTERNS (read before planning anything)

This section exists because the agent (Claude) repeatedly drifted in measurable ways, and the user had to catch each one. The patterns are real and named. Read them before proposing any plan, ship, or "honest call."

**The meta-rule:** If you catch yourself making one of these moves, STOP. Re-read the bar in §1. Re-state the recommendation against the bar, not the calendar. Acknowledge the drift.

**Drift #1 — Budget-over-bar framing.** Framing decisions around "fits the time budget" instead of "matches the bar" ("this is a 1h ship," "stop here, good day," "smaller scope is the right call"). Budget is a guardrail, not the criterion. The bar in §1 is the criterion. User tell: "remember the bar not the time."

**Drift #2 — Lazy-first-proposal.** First proposed fix is the cheap one, not the architecturally correct one. "Stripe-grade" means correct, not minimal. Drill before proposing any fix: "Is this Stripe-grade or the cheap version of Stripe-grade?" User tell: "rethink twice — is this the real fix per the bar?"

**Drift #3 — Phantom problem chasing.** Treating normal behavior as a bug; running 3+ diagnostics without an explicit hypothesis. Ask "is this expected?" BEFORE "is this a bug?" Before any diagnostic, write down (a) what should be true, (b) what the data shows, (c) whether (b) is already explained by CONTEXT.

**Drift #4 — Feature queue as quality bar.** Working through a feature queue while the central product loop is broken. The matcher cache bug survived months because nobody ran the system end-to-end as a real user iterating. At session start ask: "When did someone last run the product end-to-end and watch the dashboard update?" If "not this week," that audit is the first task.

**Drift #5 — Stating wall-clock from inference.** Inferring current time/session length and creating false urgency. The agent does NOT have reliable wall-clock access. NEVER state wall-clock or session duration unless the user provided it.

**Drift #6 — Over-asking for file pastes.** Asking for narrow slices across 4-5 turns instead of the whole file once. Before asking for a partial view: "Will I need another part of this file in my next 1-2 turns?" If yes, ask for the whole file now (`cat path | pbcopy ; wc -l path`).

**Drift #7 — Documenting incomplete fixes as "shipped."** "good enough," "minimum viable," "will catch up later," "doesn't block deploy." The bar is Apple-grade/Stripe-grade, not minimum-viable. Before declaring complete, check each item against §1; if even one small item fails, it's partial — document it honestly as partial.

**Drift #8 — No bar pre-check before an action.** Proposing any action without an explicit 4-question check. Every prior drift traces to an action shipped without one. The 4 questions, answered explicitly in the output BEFORE the user has to ask:

1. **Closer to bar?** — toward §1, or just forward?
2. **Would a senior engineer approve?** — "ship it" or "needs more rigor"?
3. **Right vs convenient?** — architecturally correct, or easy-now-regret-later?
4. **Same answer with unlimited time?** — if "I'd do it differently with more time," you're optimizing for budget (Drift #1).
   If any answer is NO/FAIL/CONVENIENT/DIFFERENT: STOP. Redesign, or explicitly ask the user whether to proceed with the known compromise. User tell: "did you bar pre-check this?"

**How to use this section:** when proposing a plan, a "stop here," a fix for a flagged bug, or a "this is complete/ready" — run it against the 8 patterns first. When the user pushes back ("remember the bar," "is this the real fix," "this is a drop in bar standards") — you've drifted: name the drift number, re-propose against the bar, wait for confirmation. The bar is held by discipline encoded in artifacts (every commit body carries a bar pre-check), not by intuition.

---

## 6. PENDING PHASE DESIGNS (locked, not yet built)

> Designs for SHIPPED phases are now decisions in §4 (4C tailoring, 4D apply,
> 4E job-pool). What remains below is the locked design for work not yet built.

### 2K.2 — richer cards + sort (Iteration 2 of the 2K plan; Iteration 1 shipped)

Per-card metadata rail filling the card's right zone: postedAt ("3 days ago"), location, sponsorship badge (knownToSponsor), score breakdown. **Requires widening the match-query select** (currently thin: title/company/location/remote/sourceUrl). Plus a sort control (score/date), score-ring color-grading by value, and j/k card navigation. Apple-grade polish pass. Scope locked — no creep beyond this.

### 2H.3 — LLM custom-question answers (apply long-tail)

The unbounded free-text questions ("Why this company?", PhD/blog-influence prompts) that ApplyProfile deliberately does NOT hold. LLM answers with the SAME verification bar as tailoring — answers trace to profile/resume only, never fabricated. SavedAnswer concept (user-approved reusable answers to recurring custom questions) was filed during 2H.0.5a as the bridge.

### 2H apply — remaining adapters + product polish

- **School/degree menu isolation (next apply chunk):** both typeaheads DEFER safely today (never misfill) but fail to SELECT because react-select menus don't close between fields — option-matching reads a stale still-open listbox (degree's failure logged the COUNTRY option list as visible = proof of the bleed). Fix: scope findOption to the active field's own menu, or force-close between fields.
- **Extension overlay:** filled/deferred count + the 401 "log in first" message.
- **Lever + Ashby adapters:** only Greenhouse works. Check for a public question-schema API (like Greenhouse's Job Board API) before building each.

### Gmail intelligence (closing the loop — the genuinely unbuilt phase)

Track which applications became interviews/offers by reading email. The last piece of the day-1 loop (scrape → match → tailor → apply → TRACK OUTCOME). Multi-session, the most uncertain phase. Not yet designed in detail.

### Expansion levers (when the budget ceiling rises)

- **Cerebras enrichment overflow:** ~1M tokens/day mostly idle outside tailoring; routing enrichment overflow there via the provider abstraction roughly doubles the daily enrichment ceiling → doubles the company budget.
- **data/2j2/backlog.json** (375 verified sponsor companies) is the seed list when the ceiling rises.

---

## 7. SERVICE ARCHITECTURE

> Transcribed from the real file tree 2026-06-12. `prisma/schema.prisma` is
> the data-model source of truth; this is the code-layout source of truth.

### Scrapers (`src/server/services/scrapers/`)

`greenhouse.ts` / `greenhouse.schema.ts`, `ashby.ts` / `ashby.schema.ts`, `location.ts`, `hash.ts`, `rules.ts`, `title-filter.ts` (2J.1 exclusion-model pre-filter).

### AI services (`src/server/services/ai/`)

- `llm.ts` — provider-agnostic interface, per-call `model?` override, typed error hierarchy + factory.
- `groq-provider.ts` — Groq impl with retry/timeout/Retry-After + token-budget throttle (reads `x-ratelimit-*` headers, pre-flight waitForHeadroom).
- `cerebras-provider.ts` — Cerebras impl (2G.0). gpt-oss-120b default, maxTokens 2048.
- `enrich.ts` — v4 orchestrator. NON_TECH_TITLE_PATTERNS + AI_CODED_HALLUCINATED_SKILLS; `applyContextAwareSkillBlocklist()` runs BEFORE sanitize. Self-healing via ENRICHMENT_VERSION predicate.
- `parse-resume.ts` — resume parser (v3, SKILL_BLOCKLIST + SKILL_CANONICAL code-side cleaning; per-field `.catch()` degradation so no single field hard-fails the parse).
- `tailor.ts` — tailoring engine (2G). tailorResumeForMatch + generateBulletFromEvidence + interviewForEvidence + conversationToEvidence. startTailoring (fast lock) + runGenerationIntoLock (background half via Next `after()`).
- `verify.ts` — two-layer verification (2G). Layer 1 code drift check; Layer 2 batched-per-role LLM verifier; summary verified against full master corpus.

### Matcher (`src/server/services/matcher/`)

- `score.ts` — pure 6-dimension weighted scoring.
- `filters.ts` — hard pre-filters.
- `match.ts` — orchestrator. Exports `computeMatchVersion(input)` → `matcher-v1:${hash}`. Content-addressed cache, self-healing.
- `reason.ts` — batched per-user reason generator (70b, integrity rule, cron-only).

### Apply engine (`src/apply/` — browser-portable, shared by lab + extension)

`types.ts`, `detect-fields.ts`, `fill-plan.ts`, `execute-fill.ts`, `gh-questions.ts` (pure decision layer: label-pattern rules → ApplyProfile keys, exact option labels, EEO decline via API flag, defer otherwise), `global.d.ts`.

### Apply server service (`src/server/services/apply/`)

`gh-job-questions.ts` — fetches the Greenhouse Job Board API question schema + Zod boundary parse (per-item safeParse).

### Chrome extension (`extension/`)

`background.ts` (worker — fetches payload + tailored PDF from the deployed production API over cookie-auth fetch), `content.ts` (wakes on #aijos-apply=<matchId>, reconstructs the PDF File, injects via DataTransfer, orchestrates fill), `fill.ts` (content-script execution; realClick for react-select). esbuild-bundled; dist/ gitignored. Code is LOCAL (unpacked); PDF + payload come from PRODUCTION.

### Server actions (`src/server/actions/`)

`auth.ts`, `preferences.ts` (triggers matcher synchronously), `profile.ts` (country-aware E.164), `resume.ts` (requestResumeUploadUrlAction + uploadMasterResumeAction + setMasterResumeAction), `match.ts` (markViewed/dismiss/markApplied/undismiss/triggerMatcher, all ownership-checked), `application.ts` (updateApplicationStatusAction), `apply-profile.ts`, `tailor.ts`.

### API routes (`src/app/api/`)

`apply/[matchId]/payload/route.ts` (session-gated, ownership-checked apply payload), `tailored/[matchId]/pdf/route.tsx` (ATS-safe PDF render, auth + ownership, 409 until generation done), `sentry-example-api/route.ts`.

### Server lib (`src/server/lib/`)

`prisma.ts` (singleton, no server-only guard — CLI uses it), `logger.ts` (Pino), `supabase-server.ts` (cookie-bound, server-only guarded), `supabase-admin.ts` (service-role), `posthog.ts`, `onboarding.ts` (getNextOnboardingStep + canAccessStep).

### GitHub Actions

`daily-cron.yml` (11:00 UTC, scrape + cleanup), `daily-enrich.yml` (12:00 UTC, enrich → match → reasons sequentially).

### CLI scripts (`scripts/`)

Pipeline: scrape, cleanup, enrich, match, reasons, parse-resume, seed-master-resume, seed-sponsors (2J.2), top-matches. Tailoring: test-cerebras-provider, test-tailor-harness, test-tailor-smoke, test-gap-closing, clear-tailored, check-generation-evidence. Apply: apply-lab. Dev helpers: show-_ (reasons/breakdown/parsed-skills/prefs/bad-match/cluster), match-diagnostics, match-status, list-users, audit-users, check-email, create/delete-test-users, probe-admin, undismiss-all, test-enrich/parse-prompt. `scripts/probes/` (gitignored-style one-offs): 2j2-_ join stages, probe-\* (db-size, cron-coverage, gh, questions, select, location, widgets, pdf-edu, apply-school, user-rows, match-owner, job-ids), deactivate/probe-cohere.

---

## 8. WHAT REMAINS

> Only genuinely-pending work. Everything shipped lives in the ledger (§2) +
> the journal. The day-1 vision (scrape → match → tailor → apply → track) is
> ~85% built: scrape/enrich/match, tailoring+PDF, apply-fill end-to-end all
> work. What's left to "finish":

**Core feature completion**

- **2K.2** — richer cards + sort (design in §6).
- **Apply extension as a real product** — school/degree menu isolation, overlay, Lever + Ashby adapters, 2H.3 LLM custom answers (designs in §6).
- **Gmail intelligence** — close the loop (applications → interviews). The genuinely unbuilt phase; multi-session.

**The "ship to friends" gate (blocks any user but Surya)**

- **Email/domain decision.** Supabase built-in pool caps ~3-4 emails/hr → <10 friends. Two paths: buy domain (~$15/yr) + Resend Custom SMTP, OR stay on the pool. User deferred multiple times — present both paths, do NOT re-pitch.
- **Per-user daily tailor capacity guard** (pairs with existing dailyApplyLimit). Cerebras ~40 applications/day total. Required before inviting.

**Housekeeping**

- **README + ARCHITECTURE refresh** — both stale. README says "Beta in development / 30 companies / 1,581 jobs"; reality is 101 companies + live URL + tailoring + apply extension. ARCHITECTURE says cron "04:00 PT" (real: 11:00/12:00 UTC) and lists pre-2G services.
- `resolveSiteUrl` hardening in git stash — known bug: guards on NODE_ENV (throws on local build); fix to VERCEL_ENV.
- 37 stale matcher-v1 matches on the real account (cosmetic; a fresh matchJobsForUser re-scores).
- Test-user cleanup (via Supabase dashboard / SQL editor — service-role key invalid; delete children→User then auth.users by hand).
- Delete stray `feat/2h2-pdf-attach` branch (the #21 duplicate-merge source).
- Skill write-back doesn't bump matchVersion (scores don't refresh until another input changes).

---

## 9. KNOWN ISSUES (live, accepted — one current list)

1. **Null bytes** — ~0.3% of GH jobs; stripped at write, nested JSON occasionally slips. ~2/large-run insert errors at this rate. Accepted.
2. **Non-technical roles return `skills: []`** — ~60% of jobs. Matcher relevance gate handles correctly.
3. **Enrichment log `model` cosmetic mismatch** — shows provider default (70b) while API receives the 8b override. Cosmetic.
4. **Reason text may lag matcher scores after a preference change** — reasons regen via daily cron, not synchronously. Scores are primary; reasons are explanation. Documented behavior.
5. **`scripts/match-diagnostics.ts` hardcoded to count v2** — use an ad-hoc Prisma groupBy for current version stats.
6. **GitHub Actions Node 20 deprecation** — June 2026; bump checkout + setup-node.
7. **Cron cleanup occasionally times out on cold-start connection** — self-heals next run. Free-tier Supabase, accepted.
8. **Service-role key (`SUPABASE_SERVICE_ROLE_KEY`) invalid** — well-formed but stale `sb_secret_`; admin API returns 401. App flow unaffected (uses anon/cookie). Admin scripts broken until a current key is pulled. Do NOT "fix" by upgrading the SDK (SDK is fine).
9. **tokensUsed null on TailoredResume** — provider doesn't surface usage; needs an LLMProvider interface change (ripples to Groq). Measured manually via the harness for now.
10. **5-minute Vercel function window** — fire-and-poll generation; pathologically slow runs could die at the edge → stale-lock recovery. Chunked poll-driven generation is the designed fallback.
11. **Hydration warning from Grammarly browser extension** — dev-only, cosmetic.
12. **Gated apply can STRAND users when tailoring can't complete on the free tier (2026-06-13, #23).** The gate assumes tailoring eventually succeeds. On Cerebras free tier (5 req/min, 1M tok/day) a rate-limited or failed tailor leaves status not-ready → button stays "Tailor & Apply" → no path to "Apply." Pre-invite fix: queue gracefully (fire-and-poll, flip on completion), OR fallback-to-master ONLY on genuine `failed` status, OR the planned per-user daily tailor cap. NOT solved.
13. **Production extension apply-flow UNVERIFIED (2026-06-13).** Gate + full click-to-fill chain verified in localhost only. The local-extension → production-API cookie-auth fetch (credentials:include cross-origin), production PDF bytes, CORS/SameSite — unconfirmed on the live site. APP_ORIGIN already points at production; test possible now that #23 is deployed. Immediate next step.

---

## 10. CRITICAL FILES (pointers — repo is the source of truth)

- Schema: `prisma/schema.prisma` · SQL triggers: `prisma/sql/0001_auth_signup_trigger.sql`
- Design tokens: `src/styles/tokens.ts`, `src/app/globals.css`
- Matcher: `src/server/services/matcher/{score,filters,match,reason}.ts`
- Enrichment + providers: `src/server/services/ai/{enrich,groq-provider,cerebras-provider,llm}.ts`
- Tailoring: `src/server/services/ai/{tailor,verify}.ts` + `src/server/actions/tailor.ts` + `src/app/api/tailored/[matchId]/pdf/route.tsx`
- Apply engine: `src/apply/*` + `src/server/services/apply/gh-job-questions.ts` + `src/app/api/apply/[matchId]/payload/route.ts`
- Extension: `extension/{background,content,fill}.ts`
- Dashboard: `src/app/(app)/dashboard/page.tsx` + `_components/{match-card,match-list,filter-header,empty-state,score-ring,score-breakdown}.tsx`
- Onboarding rules: `src/server/lib/onboarding.ts`
- Runbooks: `docs/runbooks/{deploy,cron}.md`

---

## 11. HOW TO RESUME

Start a new session with:

> "Read CONTEXT.md first. Confirm schema field names before any code. Free-tier-only is a locked decision — never propose paid APIs."

The agent will: re-read the bar (§1, especially FREE TIER ONLY) → confirm schema (§3) → read the relevant drift patterns (§5) → plan in plain English before code → write in ~30-line chunks → never re-derive from memory → verify (tsc + eslint + build) before every push → "merged"/"verified" only against real output.

If fresh Claude (different account): also paste README.md, ARCHITECTURE.md, COLLABORATION.md. For the full dated build narrative, see AI_JOB_OS_SESSION_JOURNAL.md.

**Claude Projects:** upload README + ARCHITECTURE + CONTEXT + COLLABORATION as project knowledge so new chats auto-include them. Re-upload CONTEXT when it changes.
