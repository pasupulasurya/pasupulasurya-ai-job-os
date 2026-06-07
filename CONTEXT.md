# AI Job OS — Session Context

> **Paste this file at the start of every new session with Claude.**
> Last updated: 2026-06-07 Sunday morning (Phase 2F DEPLOY DAY — Zod dedupe fix shipped Sat, backfill at 86%, deploying today with self-healing cron handling residual)

For wider context, also point readers at:

- `README.md` — front door / quickstart
- `ARCHITECTURE.md` — how the system thinks
- `COLLABORATION.md` — how we work together
- `AI_JOB_OS_SESSION_JOURNAL.md` — build narrative

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

**Product principle** — **Never fabricate content.** Resume tailoring rewrites and re-emphasizes, but cannot invent facts. Locked/Tailored split enforces this in architecture. The matcher's signal text is machine-generated from its own logic (not LLM-fabricated). Suggested skill and target-role chips surface only what the resume parser extracted — never invented.

---

## 2. WHAT WE'VE BUILT (cumulative — all shipped to main)

- **Foundation (F1-F7):** VISION, ADRs, design tokens, observability, quality gates, command palette (Cmd+K with navigate + theme + sign out)
- **Phase 2A:** 10-table schema, 30 US companies seeded, 12 owner rules
- **Phase 2B:** Supabase Auth + Resend SMTP + DB triggers + auth pages + middleware + onboarding
- **Phase 2C:** Greenhouse + Ashby scrapers, cleanup script, daily cron, per-job parse refactor
- **Phase 2D:** LLM provider abstraction, Groq impl with retry+throttle, enrichment orchestrator, CLI, split cron workflows
- **Phase 2E.1:** Schema expansion (UserPreference +7, ResumeVersion +7), expanded Zod, updated Server Actions, resume parser, upload Server Action, CLI smoke test
- **Phase 2E.2.A:** Matcher backend — 6 weighted dimensions, saturating title curve, word-boundary keyword matching, conditional relevance gate, sparsity dampening
- **Phase 2E.2.A-fix:** Per-task LLM model override; enrichment to llama-3.1-8b-instant (5× TPD ceiling); descriptions truncated 4000→2000 chars
- **Phase 2E.2.B:** Match reason generator — batched per-user (one LLM call returns reasons for top-10). 70b after 8b followed style poorly. Integrity rule honored.
- **Phase 2E.3.A:** Functional dashboard at `/dashboard`. Top-10 match cards with score badge, LLM reason, three actions. Server Actions enforce ownership. Empty state with rotating progress phrases + auto-trigger.
- **Phase 2E.3.B wave 1 (May 29):** Score reveal animation, autocomplete on ChipInput, curated role/location suggestions, `/settings` hub, AppShell + (app)/ route group migration, redirect-configurable savePreferencesAction.
- **Phase 2E.3.B wave 2 (May 29):** Stagger-in card entrance, why-this-score expandable breakdown, AI-suggested keywords from parsed resume.
- **Phase 2E.4 (Monday 2026-06-01):** Daily cron `daily-enrich.yml` chains enrich → match → reasons sequentially. Product is self-sustaining — new matches appear daily without manual intervention.
- **Phase 2E.3.B Monday additions:** Mobile responsive (AppShell hamburger + dashboard + settings + score ring sizing), prefs overwrite prevention (schema min(3) keywords + form dirty-field counter), enrichment v3 (anti-hallucination prompt for non-technical roles), AI-suggested keywords on onboarding form.
- **Phase 2E.5 (Mon-Wed, COMPLETE for pre-deploy bar):** Full first-time onboarding pipeline:
  - User schema split (firstName + lastName + phone + country, all properly typed)
  - `/onboarding/welcome` → `/onboarding/profile` → `/onboarding/resume` → `/onboarding/preferences` → `/dashboard`
  - Drag-and-drop resume upload (native HTML5, no react-dropzone)
  - PDF extraction via unpdf (Mon, replaced pdf-parse v2 which had Next.js worker bug)
  - DOCX extraction via mammoth (Wed)
  - Resume parser v3 with code-side SKILL_BLOCKLIST + SKILL_CANONICAL cleaning (Tue)
  - Country picker for international phone normalization (Wed — curated 250-entry ISO list, longest-prefix-match dial code detection)
  - Edit personal info in /settings (Tue — view/edit toggle, useTransition, AnimatePresence)
  - Onboarding progress indicator across all 4 routes (Tue — AuthShell.header prop)
  - Suggested target roles chips on onboarding + settings (Wed — from parsedJson.currentRole + workHistory titles)
  - Strict-ordering routing guards (Wed — centralized in onboarding.ts, profile→resume→preferences→dashboard, revisit-completed-steps allowed but no skip-ahead)
- **Phase 2E matcher correctness fix (Wed 2026-06-03 evening):** Content-addressed matchVersion + synchronous re-match on save. This was a critical architectural bug discovered by the user — frozen dashboard scores despite preference changes. The matcher's idempotency was keyed on a static `matcher-v1` constant, so once a (user, job) pair was scored, it was never re-scored regardless of what the user changed. Fix: matchVersion now includes a SHA256 hash of all preference fields + resumeId + parseVersion. When inputs change, hash changes, all existing matches become stale-version, matcher re-scores automatically. Plus: savePreferencesAction and uploadMasterResumeAction now trigger the matcher synchronously after save. User sees "Saving and re-matching jobs…" → "Saved. Re-scored 771 jobs · 7 above threshold." Real iteration loop closed.

- **Phase 2F deploy prep (Thu-Fri 2026-06-04 to 2026-06-05, COMPLETE except backfill):**
  - **v4 enrichment with context-aware skill blocklist (Thu):** Fixed v3 hallucination bug where non-tech titles ("Accounting Technical Solutions Lead @ Stripe") got AI-coded skills ([ai, artificial intelligence, accounting]). New `applyContextAwareSkillBlocklist()` runs BEFORE sanitize. Conservative blocklist drops AI/ML/NLP/CV/LLM only on roles matching NON_TECH_TITLE_PATTERNS (35+ entries). Keeps python/sql/data science. 8/8 test cases pass including critical "Sales Engineer keeps python+sql but drops AI hallucinations." Bumped ENRICHMENT_VERSION v3→v4. Verified 23/25 non-tech roles return skills:[] (exceeds 18/25 success criterion).
  - **Token-budget throttle for Groq (Thu):** Real cause of cron 429 aborts was Groq's actual TPM = 6,000 (NOT 30,000 as documented). Verified via curl. New GroqProvider state fields (remainingTokens, resetTokensAt, remainingRequests, resetRequestsAt) plus parseResetWindow() + waitForHeadroom() pre-flight + updateRateLimitState() after every response. Dry-run: 15/15 in 117s = 7.8/min sustained, zero 429s. Real cron run: 188 jobs/run sustained vs broken cron's 47.
  - **Deploy runbook (Fri):** New `docs/runbooks/deploy.md` (262 lines, 7 sections): 5 pre-flight gates with PASS/FAIL criteria, Vercel env var checklist (14 variables), Supabase production config, 7-step deploy sequence with preview-before-prod, cron jobs post-deploy, rollback plan, 6 Next.js 16 + Vercel concerns flagged including the 4.5 MB body limit that became the deploy blocker.
  - **Signed URL upload flow (Fri) — Phase 2F deploy blocker resolved:** Vercel free + paid both have 4.5 MB hard request body limit. Our existing FormData upload would have 413'd on real-world 5 MB resumes in production. Fix: 3-step pattern with direct browser→Supabase Storage upload bypassing Vercel entirely. `requestResumeUploadUrlAction(filename, fileSize, contentType)` returns `{ uploadUrl, storagePath, token }` from `createSignedUploadUrl`. Client PUTs file body direct to Supabase. `uploadMasterResumeAction(storagePath: string)` downloads server-side, processes, deletes file in finally block. Storage is transit zone — net usage zero per upload. RLS-scoped to user's own folder (3 policies). No admin client needed. Tested end-to-end with real PDF.
  - **Schema cleanup (Fri):** Dropped 3 dead schema items after verification + diagnostic queries: Log model (0 rows all-time, Pino writes stdout+Sentry only), UserPreference.onboardingComplete column (never read for gating, dashboard uses keywords.length >= 3), ResumeVersion.pdfUrl + docxUrl columns (never populated, binary is discarded after text extraction). TypeScript caught 4 application-code references that grep missed.
  - **Zod preprocess dedupe fix (Sat, commit 19a93ec):** Resolved ~2-3% of jobs failing Zod validation with "Too big: expected array to have <=20 items" where the failure was caused by LLM returning duplicates + truncation fragments (e.g. "s" cut off at 512-token boundary) inflating the count past 20, not by genuinely having >20 unique meaningful skills. The existing sanitize() function had the right dedupe logic but ran AFTER validation — Zod rejected the whole job before sanitize could clean it. Fix: moved cleanup into the Zod schema itself via z.preprocess on the skills field (lowercase + trim + drop fragments <2 chars + dedupe via Set, THEN apply .max(20)). Verified against 8 real failure samples: 5/8 recover, 3/8 correctly remain rejected (genuinely 21+ unique meaningful skills = senior/staff jobs out of beta cohort scope). Drift caught + corrected in real time — user pushback on Chesterton's Fence question "why does MAX_SKILLS=20 exist" prevented lazy "just remove .max()" fix.

**Total in DB (Sun morning 2026-06-07, 8:43 AM Central):** 1,708 active jobs (continued daily scraping adds ~35/day). 1,468 at v4 (86%). 239 NULL remaining. 1 v2 straggler. Today's UTC TPD already burned ~340 enrichments; remaining ~80-90 headroom. Tonight's 00:00 UTC reset (7 PM Central Sun) gives fresh 500k = enough to clear all 239 in one cron run. **Decision: deploy today with 86% backfill because matcher excludes NULLs (job.skills.length === 0 returns score 0) so production users never see them. Cron self-heals overnight.**

---

## 3. EXACT SCHEMA FIELDS (Prisma 7 cheat sheet)

**Source of truth:** `prisma/schema.prisma`.

### User

`id, authId, email (unique), firstName, lastName, phone, country, role, createdAt, updatedAt`

- `firstName`, `lastName` non-null (tightened 2026-06-02). `phone` nullable, normalized to E.164. `country` nullable ISO 3166-1 alpha-2 (added 2026-06-03).
- relations: preferences, applications, jobMatches, blockedCompanies, resumes

### UserPreference (2E.1 expanded)

Core: `keywords[], excludeKeywords[], locations[], jobTypes[], experienceMin, experienceMax, visaSponsorship, stemOptOnly, dailyApplyLimit`
2E.1 fields:

- `visaType` (String?) — "h1b" | "f1_opt" | "stem_opt" | "green_card" | "citizen" | "other"
- `workAuthStatus` (String?) — "needs_sponsorship" | "current_h1b" | "ead" | "citizen_or_gc"
- `salaryMin` (Int?) — annual USD
- `currentEmployment` (String?) — "employed" | "unemployed" | "student" | "freelance"
- `targetRoles` (String[] default []), `avoidCompanies` (String[] default [])
  Canonical enums in `src/shared/schemas/preferences.ts`: `visaTypeValues`, `workAuthStatusValues`, `currentEmploymentValues`.

### Company

`id, slug (unique), name, ats, active, knownToSponsor, notes, lastScrapedAt, lastJobCount, createdAt, updatedAt`

- **WATCH:** `ats` not `source`; `active` not `isActive`

### ScrapingRule

`id, name, ruleType, pattern, enabled, appliesTo, createdAt, updatedAt`

- **WATCH:** `ruleType`, `appliesTo`, `enabled` (not `action`/`field`/`isActive`)

### Job

Core: `id, source, sourceUrl (UNIQUE), externalId, title, company, companySlug, location, remote, description, rawJson, hash, scrapedAt, expiresAt, deletedAt, updatedAt`
AI-filled: `seniority (entry/mid/senior/staff), experienceYears (0-40), skills[], sponsorsVisa (tri-state), stemOptFriendly (tri-state), postedAt`
Enrichment metadata: `enrichedAt`, `enrichmentVersion` (current: `groq-llama-3.1-8b-v4`)

### UserJobMatch (2E.2 expanded)

Core: `id, userId, jobId, matchScore, status, matchedAt, viewedAt, dismissedAt, dismissed, autoDismissed`
2E.2 fields:

- `scoreBreakdown` (Json?) — per-dimension `{score, signal, weighted}` shape; rendered by ScoreBreakdown component
- `reason` (Text?) — LLM-generated paragraph
- `matchVersion` (String?) — current shape: `matcher-v1:${12_char_sha256_hex}`. The hash captures all matcher inputs (preferences + resumeId + parseVersion). When inputs change, hash changes, idempotency triggers re-score. See Section 4 "matchVersion content-addressing" for full rules.
- Index: `[userId, matchVersion]`
- `status`: "fresh" | "viewed" | "applied" | "dismissed" | "rejected"

### Application

`id, userId, jobId, status, resumeId, appliedAt, notes, createdAt, updatedAt, archivedAt`

### ResumeVersion (2E.1 expanded)

Core: `id, userId (REQUIRED), jobId (optional), contentJson, createdAt, applications[]`
2E.1 fields:

- `isMaster` (Boolean default false) — one master per user, atomic switch via transaction
- `parsedJson` (Json?) — AI-extracted: { fullName, email, phone, location, summary, totalYearsExperience, currentRole, currentCompany, education[], workHistory[], skills[], links{} }. **WATCH:** workHistory[].title and workHistory[].company are now nullable in the Zod schema (real LLM output occasionally returns null for implicit/unclear titles in real-world resumes — discovered during DOCX test Wed).
- `parsedAt` (DateTime?), `parseVersion` (String?) — current: `groq-llama-3.3-70b-resume-v3`
- `fileName` (String?), `fileSize` (Int?)
- Indexes: `[userId]`, `[userId, isMaster]`

### UserBlockedCompany

`id, userId, companyId, reason, blockedAt`

---

## 4. LOCKED DECISIONS (do not re-discuss)

| Decision                                        | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FREE TIER ONLY**                              | **No paid APIs ever. Paying a penny is the defeat condition.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Job TTL                                         | 30 days for unmatched jobs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| UserJobMatch auto-dismiss                       | 7 days unviewed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Application archival                            | 90 days after rejection                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Dedup window                                    | 14 days (sha256 of company\|title\|location)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Cleanup model                                   | **User-driven, not time-driven**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Repository pattern                              | NO — direct Prisma                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **AI architecture**                             | **Per-task free-tier model selection via `params.model` override**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Enrichment model                                | `llama-3.1-8b-instant` (Groq free, 500k TPD)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Resume parsing model                            | `llama-3.3-70b-versatile` (Groq free, quality matters)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Reason generator model                          | `llama-3.3-70b-versatile` (8b followed style poorly)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Resume tailoring model                          | `llama-3.3-70b-versatile` split 50/50 across Groq + Cerebras (Phase 2G planned)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Skill match                                     | String intersection (lowercase + word boundary). Embeddings deferred to Phase 2H+.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **MAX_SKILLS = 20 (load-bearing)**              | NOT a sanity check — load-bearing for matcher arithmetic AND user cohort decision. Matcher uses `overlap.length / job.skills.length` (score.ts:89). Raising cap from 20→25 would silently dilute every match score ~20% for content-rich job postings. Cohort decision: beta users are international tech workers seeking visa sponsorship for early/mid-career roles. Jobs that genuinely have 20+ distinct meaningful skills are senior/staff-saturated, out of beta cohort scope. Decision is product-grounded, not technical — keeping at 20 even when LLM returns more, even when it costs us ~3% jobs that stay NULL.                                                                 |
| **Zod preprocess pattern for skills**           | EnrichmentSchema.skills uses `z.preprocess((val) => [dedupe + lowercase + trim + drop <2 chars], z.array(z.string()).max(MAX_SKILLS))`. Preprocess runs BEFORE validation. Why: LLM (8b-instant model especially) returns duplicates ("data" 5×) + truncation fragments ("s") that inflate raw count past 20 without genuine information. Dedupe-first lets cleaned outputs pass while genuinely-over-cap outputs (~3% of jobs) correctly fail. `sanitize()` function in same file preserved unchanged as belt-and-suspenders — its dedupe is now redundant but its slice is the same enforcement Zod does. Defense in depth.                                                               |
| Groq free tier (8b-instant) — REAL              | **30 RPM / 6,000 TPM / 14,400 RPD / 500,000 TPD** — verified via curl Thursday 2026-06-04. Documentation previously said 30k TPM; reality is 6k. At ~1,000-1,200 tokens per enrichment this caps sustained throughput at 5/min and ~415-500 enrichments per UTC day. Throttle uses reactive header reads + pre-flight wait, achieves ~430/cron run.                                                                                                                                                                                                                                                                                                                                         |
| Groq free tier (70b)                            | 1,000 RPD / 6,000 TPM / 100,000 TPD                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Enrichment version                              | `groq-llama-3.1-8b-v4` (current; bumped Thu after context-aware skill blocklist landed)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Enrichment throttle (token-budget)              | Reactive header-based: GroqProvider parses `x-ratelimit-remaining-tokens` + `x-ratelimit-reset-tokens` + `x-ratelimit-remaining-requests` + `x-ratelimit-reset-requests` from every response (200 or 429). Pre-flight `waitForHeadroom(estimated=maxTokens*2)` before each request — if remaining < estimated, sleep until reset window passes. `parseResetWindow()` handles "459ms"/"6s"/"1m30s" formats. Public LLMProvider interface unchanged. Shipped Thu 2026-06-04.                                                                                                                                                                                                                  |
| Enrichment max_tokens                           | 512                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Enrichment truncation                           | 2,000 chars                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Resume parse version                            | `groq-llama-3.3-70b-resume-v3` (current; bumped 2026-06-02 alongside code-side blocklist+canonical-map cleaning)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Resume parse max_tokens                         | 4096                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Resume parse truncation                         | 12,000 chars                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Resume MAX_SKILLS                               | 80                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Reason version                                  | `groq-llama-3.3-70b-reason-v1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Reason max_tokens                               | 2048                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Reason batch size                               | 10 jobs per LLM call                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Reason per-row length cap                       | 900 chars                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| LLM error handling                              | Auth/rate-limit → abort batch; validation/transport → log+continue                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| LLM cron schedules                              | scrape+cleanup 11:00 UTC, enrich 12:00 UTC                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Master/Tailored split**                       | Master locked truth; tailoring rewrites summary/skills/bullets only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Master switching                                | Non-destructive (preserve provenance) — atomic via Prisma transaction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Signed URL upload pattern**                   | 3-step flow to bypass Vercel 4.5 MB body limit. Step 1: `requestResumeUploadUrlAction(filename, fileSize, contentType)` returns `{ uploadUrl, storagePath, token }` via `supabase.storage.createSignedUploadUrl(path)` using cookie-bound `@supabase/ssr` client. Step 2: client PUTs file body direct to Supabase Storage URL, bypassing Vercel. Step 3: `uploadMasterResumeAction(storagePath: string)` downloads server-side, processes, deletes file in finally block. Net storage = zero per upload. Storage is transit zone, not destination.                                                                                                                                         |
| **Storage bucket `resumes` config**             | Private (RLS-enforced). 5 MB file size limit at platform level. MIME types restricted: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain. Path convention: `{auth.uid()}/{timestamp}-{sanitizedFilename}`. `sanitizeFilename()` strips `/\` + `..` + non-`[a-zA-Z0-9._-]` characters.                                                                                                                                                                                                                                                                                                                                                    |
| **Storage RLS policies (3)**                    | All scoped to `auth.uid()::text = (storage.foldername(name))[1]` against authenticated role. INSERT: `resumes_user_can_upload_own_path` (WITH CHECK). SELECT: `resumes_user_can_read_own_path` (USING). DELETE: `resumes_user_can_delete_own_path` (USING). Verified: anonymous client rejected with "new row violates row-level security policy"; cross-user paths rejected by app-level prefix check + RLS double layer.                                                                                                                                                                                                                                                                  |
| **Cleanup-after-processing pattern**            | `uploadMasterResumeAction` uses finally block to call `supabase.storage.from("resumes").remove([storagePath])` regardless of success or failure. Fire-and-forget via `void ... .then()` so cleanup never blocks response. If cleanup itself fails, logged as warn — worst case is a 5 MB orphan per failed upload that can be cleaned via bucket lifecycle policies in a future phase.                                                                                                                                                                                                                                                                                                      |
| **MATCHER VERSION CONTENT-ADDRESSING**          | `matcher-v1:${sha256_first12(stableSerialize(input))}`. Inputs hashed: all UserPreference matcher-read fields (keywords, excludeKeywords, targetRoles, locations, jobTypes, experienceMin/Max, visaSponsorship, stemOptOnly, visaType, workAuthStatus, salaryMin, currentEmployment, avoidCompanies) + resumeId + parseVersion. Computed in `match.ts` via `computeMatchVersion(input)`. When ANY input changes, hash changes, skip-if-exists query returns nothing, matcher re-scores every job. **This is the real correctness mechanism.** Idempotency is preserved when inputs are stable; invalidation is automatic when inputs change. Self-heals — no backfill needed when shipping. |
| **Matcher weights**                             | titleKeywords=25, skills=20, seniority=15, sponsorship=15, location=15, salary=10                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Matcher saturation**                          | 1 kw match=0.7, 2=0.9, 3+=1.0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Matcher skill dampen**                        | <3 job skills → score scaled by (count/3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Matcher relevance gate**                      | Cap at 35 if titleKw=0 AND skills=0 AND both have data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Matcher word matching**                       | Word-boundary regex                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| MIN_SCORE_TO_PERSIST                            | 40                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Min preference keywords**                     | 3 (was 1; bumped Mon after overwrite incident — schema rejects fewer with explanatory error)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **SYNCHRONOUS MATCHER ON SAVE**                 | `savePreferencesAction` and `uploadMasterResumeAction` both call `matchJobsForUser({ userId, force: true })` after persisting their data. Trigger is in an inner try/catch — matcher failure does NOT fail the user-visible save. Match summary `{ jobsConsidered, upserted, scoredAbove }` returned to client. UI shows "Saving and re-matching jobs…" during the wait (~2-3 seconds for 771 jobs) and "Saved. Re-scored X jobs · Y above threshold." in confirmation toast.                                                                                                                                                                                                               |
| **Match summary surfacing**                     | Settings preferences form: enriched savedAt toast with concrete count. Onboarding preferences form: motion.button replaces SubmitButton (useFormStatus doesn't fire with onSubmit+startTransition); pending label "Saving and re-matching jobs…". Resume upload form: "Parsing and matching jobs…" label during upload state.                                                                                                                                                                                                                                                                                                                                                               |
| **PDF text extraction**                         | `unpdf` (serverless-friendly, no worker). Replaced pdf-parse v2 Mon (Next.js worker .mjs not found at runtime).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **DOCX text extraction**                        | `mammoth.extractRawText({ buffer })` only. HTML output mode discarded — raw text is sufficient for LLM parser, and formatting hints don't improve quality enough to justify payload size. Added Wed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Country picker architecture**                 | Curated static list at `src/shared/data/countries.ts` (250+ entries, ISO 3166-1 alpha-2 code + English name + E.164 dial code). No external library, no bundle bloat. No flag emojis (bar forbids emojis in UI). Picker shows `CODE` + `+dial` in trigger; dropdown row shows code (muted) + name + dial (muted).                                                                                                                                                                                                                                                                                                                                                                           |
| **Phone validation (Y-lenient, country-aware)** | Country-aware: profileSchema requires `country` (ISO code) alongside phone. Normalizer detects ANY existing dial code in the input (longest-prefix-match against all known dial codes), strips it, prepends the SELECTED country's dial code. Handles "user changed country picker but kept phone field" correctly — was the real bug caught mid-test Wed. Empty becomes null.                                                                                                                                                                                                                                                                                                              |
| **Drag-drop pattern**                           | Native HTML5 onDragEnter/Leave/Over/Drop. `useRef` counter avoids onDragLeave flicker when entering child elements. No react-dropzone dep.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Upload state machine**                        | 4 discriminated-union states: `idle` \| `uploading` \| `success` \| `error`. AnimatePresence drives state transitions with spring.snappy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Resume file types accepted**                  | PDF (via unpdf) + DOCX (via mammoth) + plain text. 5 MB max. UI accept attribute lists both MIME types + .pdf/.docx extension fallbacks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Mobile breakpoints**                          | `md` (768px) for nav rail collapse; `sm` (640px) for content stacking. Hamburger top bar appears below md.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Mobile nav menu**                             | Slide-in panel from left, 280px wide, dimmed backdrop (bg-black/60). Body scroll-lock while open. Escape + backdrop tap + nav item tap all close.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Score ring mobile**                           | 40px above title on mobile (own row, right-aligned); 48px right of title on desktop. ScoreRing accepts `size?` prop, two instances with md:hidden / hidden md:block.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Onboarding routing strict ordering**          | Centralized in `src/server/lib/onboarding.ts`. `getNextOnboardingStep(state)` returns first incomplete step or null. `canAccessStep(step, state)` returns allowed/redirectTo. Step rules: profile = firstName + lastName non-empty; resume = master ResumeVersion exists; preferences = keywords.length >= 3. Users CAN revisit completed steps (edit name, swap resume, change prefs). Users CANNOT skip ahead — bounces back to first incomplete step. Welcome is intro-only, not a gate.                                                                                                                                                                                                 |
| **Dashboard onboarding gate**                   | Uses `getNextOnboardingStep` helper. If returns non-null, dashboard redirects there. Replaces previous broken hasMasterResume / hasPreferences inline checks with stale "contact the team to seed resume" dead-code placeholder.                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Empty state UX**                              | Auto-trigger matcher + rotating progress phrases + AnimatePresence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Action ownership check**                      | All match Server Actions filter on BOTH matchId AND userId before mutation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Settings vs onboarding save**                 | `savePreferencesAction(input, redirectTo)` — settings passes null to stay on page                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Route group `(app)/`**                        | Shared `AppShell` layout for all authenticated routes; URLs unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **AppShell nav items**                          | Dashboard / Applications (coming soon) / Settings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Cmd+K command palette**                       | Power-user velocity surface (Foundation F7); nav rail is for discovery — both ship together                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Score ring animation**                        | 48px SVG, spring stiffness 120 damping 20, ring + count-up driven by same `useMotionValue`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Stagger-in pattern**                          | Parent variants `hidden`→`visible` with `staggerChildren: 0.08`; animates once on mount, survivors don't re-animate on re-render                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Why-this-score breakdown**                    | Inline expand below reason; height 0→auto via AnimatePresence; per-dimension rows sorted by weighted desc; bars stagger-fill 50ms per row; independent per-card state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Suggested chips integrity**                   | Surface only what resume parser extracted. Never invent. Keyword chips cap 15, target role chips cap 5. Reactive dedup (case-insensitive) against current state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Suggested target roles source**               | `parsedJson.currentRole` + `parsedJson.workHistory[].title`. Computed server-side in both `/onboarding/preferences/page.tsx` and `/settings/page.tsx`. Lowercase + Set-dedupe + slice 5. Rendered above the targetRoles ChipInput on both surfaces.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Skill cleaning architecture**                 | LLM extracts everything verbatim; cleaning happens in code via `SKILL_BLOCKLIST` (Set) and `SKILL_CANONICAL` (Record) in `parse-resume.ts`. Deterministic, auditable, generalizes via blocklist; canonical map currently personalized to one user's corruption patterns. Tuesday lesson: LLM prompts are extraction tools, not quality filters.                                                                                                                                                                                                                                                                                                                                             |
| **Onboarding progress indicator**               | Thin horizontal bar (4px tall, max-w-md), bg-border track + bg-accent fill, width = (current/total)\*100. Spring.snappy fill animation on mount. Step label + percentage in text-xs uppercase tracking-widest below bar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **AuthShell header prop**                       | Optional `header?: ReactNode` slot between brand mark and title block in `auth-shell.tsx`. Centered alignment. Used by onboarding routes to inject progress indicator. Backward compatible — pages without `header` render unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Schema strictness                               | Strict on fields we use; permissive on metadata. workHistory.title/company nullable in Zod (real-world resumes have implicit titles).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **DB migration workflow**                       | `prisma db push` ONLY — never `prisma migrate dev`. migrate dev would offer destructive reset due to existing drift, which would wipe all data. Always pre-flight DB-touching changes with a NULL/integrity check before pressing y.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

---

## 5. SERVICE ARCHITECTURE

### Scrapers (`src/server/services/scrapers/`)

greenhouse.ts/schema.ts, ashby.ts/schema.ts, location.ts, hash.ts, rules.ts

### AI services (`src/server/services/ai/`)

- `llm.ts` — provider-agnostic interface with per-call `model?` override
- `groq-provider.ts` — Groq impl with retry, timeout, Retry-After, and **token-budget throttle** (Thu 2026-06-04). Reads `x-ratelimit-*` headers from every response, sleeps before requests when budget is exhausted. Real Groq 8b-instant limits verified: 6,000 TPM, 500,000 TPD. ~430 enrichments per cron run sustained.
- `enrich.ts` — job enrichment orchestrator. v4 includes `NON_TECH_TITLE_PATTERNS` (~35 patterns: account executive, accountant, sales, recruiter, customer success, marketing manager, partnerships, legal counsel, executive assistant, HR, etc.) + `AI_CODED_HALLUCINATED_SKILLS` (conservative list: ai, artificial intelligence, ml, machine learning, deep learning, neural network, llm, large language model, nlp, natural language processing, computer vision, generative ai, genai, transformers — deliberately excludes python/sql/data science). `applyContextAwareSkillBlocklist()` runs BEFORE sanitize. Self-healing migration via idempotency predicate on ENRICHMENT_VERSION.
- `parse-resume.ts` — resume parser (v3 with SKILL_BLOCKLIST + SKILL_CANONICAL code-side cleaning; workHistory.title/company nullable in Zod)

### Matcher (`src/server/services/matcher/`)

- `score.ts` — pure scoring functions (6 dimensions, weighted composition)
- `filters.ts` — hard pre-filters
- `match.ts` — orchestrator. Exports `computeMatchVersion(input)` returning `matcher-v1:${hash}`. Uses content-addressed version everywhere (skip-if-exists query, upsert payloads, summary return). Self-healing migration when shipped.
- `reason.ts` — batched per-user reason generator (70b, integrity rule). Note: reasons run via daily cron only, NOT triggered synchronously on save. Acceptable lag — scores are primary signal, reasons are explanation.

### Server actions (`src/server/actions/`)

- `auth.ts` — signup/signin/signout (signOutAction is form action)
- `preferences.ts` — `savePreferencesAction(input, redirectTo?)`. Upserts UserPreference, then triggers matcher in inner try/catch with `force: true`. Returns `{ success, matchSummary }` on success. Matcher failures don't fail the save — daily cron picks up.
- `profile.ts` — `saveProfileAction` (firstName/lastName/phone/country, country-aware E.164 normalization with longest-prefix-match dial code detection)
- `resume.ts` — TWO Server Actions for the signed URL upload flow (Fri 2026-06-05). `requestResumeUploadUrlAction(filename, fileSize, contentType)` validates user+input and returns signed Supabase Storage URL scoped to user's own folder via RLS. `uploadMasterResumeAction(storagePath: string)` downloads file from Storage, MIME-routed extraction (unpdf for PDF, mammoth for DOCX, direct buffer for plain text), atomic master-switch transaction, triggers matcher in inner try/catch, deletes file in finally block. `sanitizeFilename()` prevents path traversal. Defense in depth: app-level path prefix check before download + RLS at storage layer.
- `match.ts` — markViewed / dismiss / markApplied / triggerMatcher (all ownership-checked)

### Server lib (`src/server/lib/`)

- `prisma.ts` — Prisma singleton
- `logger.ts` — Pino structured logger
- `supabase-server.ts` — cookie-bound Supabase client (server-only guarded)
- `supabase-admin.ts` — service-role admin client
- `posthog.ts` — analytics
- `onboarding.ts` — Centralized onboarding-progression rules. `getNextOnboardingStep(state)` returns first incomplete step or null. `canAccessStep(step, state)` returns `{ allowed: true }` or `{ allowed: false, redirectTo }`. Used by dashboard for redirect computation, used by each onboarding page.tsx for prior-step enforcement.

### App routes (`src/app/`)

- `/login`, `/signup` (Phase 2B) — outside (app) group
- `/onboarding/welcome` (Phase 2E.5) — outside (app); 3-step preview, "Get started" CTA, redirects fully-onboarded users to /dashboard. Intro-only, NOT a routing gate.
- `/onboarding/profile` (Phase 2E.5) — outside (app); firstName + lastName + phone (with CountryPicker) collection. No prior-step gate (it's the first step). Revisit-allowed (form prefills).
- `/onboarding/resume` (Phase 2E.5) — outside (app); native HTML5 drag-drop, accepts PDF + DOCX. Prior-step gate: profile must be complete (firstName + lastName non-empty).
- `/onboarding/preferences` (Phase 2B + 2E.3.B + 2E.5) — outside (app); preferences form with suggested skill chips + suggested target role chips. Prior-step gate: profile AND resume must be complete.
- `/dashboard` (Phase 2E.3.A + B + matcher-fix) — inside (app)/. If `getNextOnboardingStep` returns non-null, redirects there. Otherwise daily briefing with stagger-in + score reveal + expandable breakdown.
- `/settings` (Phase 2E.3.B) — inside (app)/ — configuration hub with personal info edit + AI-suggested keywords + suggested target roles + dirty field counter
- Future: `/applications` (Phase 2I)

### AppShell (`src/app/(app)/`)

- `layout.tsx` — Server Component, single Prisma query, passes email + initial to AppShell
- `_components/app-shell.tsx` — left rail 220px, wordmark, three nav items, UserMenu at bottom
- `_components/user-menu.tsx` — avatar dropdown trigger, opens upward, click-outside + Escape close

### Dashboard components (`src/app/(app)/dashboard/_components/`)

- `match-card.tsx` — score ring + title + reason + Why this score? toggle + actions; optimistic UI; independent expand state
- `match-list.tsx` — Client Component, Framer Motion stagger container; runs once on mount
- `empty-state.tsx` — auto-triggers matcher; cycles 6 progress phrases
- `score-ring.tsx` — 48px SVG ring with count-up animation, prefers-reduced-motion aware
- `score-breakdown.tsx` — six-dimension expandable view with animated bars and matcher's signal text

### Settings components (`src/app/(app)/settings/`)

- `page.tsx` — Server Component shell. Extracts and passes `suggestedSkills` from `parsedJson.skills` AND `suggestedTargetRoles` from `parsedJson.currentRole + workHistory[].title`. Passes `country` to PersonalInfoSection.
- `_components/personal-info-section.tsx` — Client Component, read-only view by default with Edit toggle. Edit mode: paired CountryPicker + phone input. View mode dl row: Name, Country (name + dial), Phone (normalized E.164). useTransition save via saveProfileAction.
- `_components/preferences-form.tsx` — client form with 6 sections. Two SuggestedChipsRow instances (above Keywords + above Target Roles). matchSummary state captured from action result. Saved toast: "Saved. Re-scored X jobs · Y above threshold." Button label: "Saving and re-matching jobs…" during pending.

### Shared (`src/components/onboarding/`)

- `chip-input.tsx` — chip input WITH optional autocomplete (suggestions prop)
- `country-picker.tsx` — Searchable dropdown for ISO country + dial code. Trigger shows `CODE +dial`. Dropdown: search input + scrollable list (country code muted, name, dial muted). Click-outside / Escape close. AnimatePresence + spring.snappy.
- `experience-range.tsx` — segmented experience buttons
- `job-type-select.tsx` — toggle pills for job types
- `preference-toggle.tsx` — switch with label/description (takes `value` not `checked`)
- `progress.tsx` — 4px-tall horizontal bar, max-w-md, bg-border track + bg-accent fill; spring.snappy fill animation on mount

### Onboarding components (`src/app/onboarding/`)

- `welcome/page.tsx` — Server Component, 3-step preview cards, completion-check redirect
- `profile/page.tsx` — Server Component. Reads firstName/lastName/phone/country. Renders ProfileClientForm.
- `profile/_components/profile-client-form.tsx` — Client form. Paired CountryPicker + phone input. useTransition save, motion.button with isPending spinner.
- `resume/page.tsx` — Server Component. Reads firstName/lastName to enforce prior-step gate via canAccessStep. Renders ResumeUploadForm.
- `resume/_components/resume-upload-form.tsx` — Native HTML5 drag-drop, accepts PDF + DOCX, 4-state state machine. Pending label: "Parsing and matching jobs…". `handleFile` orchestrates 3-step flow: (1) `requestResumeUploadUrlAction` for signed URL, (2) browser PUT direct to Supabase Storage (bypasses Vercel 4.5 MB body limit), (3) `uploadMasterResumeAction(storagePath)` for server-side processing.
- `preferences/page.tsx` — Server Component. Reads parsedJson, computes suggestedSkills + suggestedTargetRoles. Prior-step gate via canAccessStep (profile + resume must be done). Renders PreferencesClientForm.
- `preferences/_components/preferences-client-form.tsx` — Client form. Two suggestion rows (keywords + target roles). motion.button with isPending (NOT SubmitButton — useFormStatus doesn't fire in onSubmit+startTransition context). Pending label: "Saving and re-matching jobs…"

### Data files (`src/shared/data/`)

- `role-suggestions.ts` — curated job titles/skills for ChipInput autocomplete (~80 entries)
- `location-suggestions.ts` — curated US cities + Remote (~40 entries)
- `countries.ts` — Full ISO 3166-1 alpha-2 list (~250 entries) with English name + E.164 dial code. Exports COUNTRIES array, findCountry lookup, DEFAULT_COUNTRY_CODE = "US".

### CLI scripts (`scripts/`)

- `scrape.ts`, `cleanup.ts`, `enrich.ts`
- `parse-resume.ts`, `seed-master-resume.ts`
- `match.ts`, `top-matches.ts`
- `reasons.ts`, `show-reasons.ts`
- `show-breakdown.ts` — dev helper, prints scoreBreakdown JSON for top match
- `show-parsed-skills.ts` — dev helper, prints fileName + skills array from parsed resume
- `show-prefs.ts` — dev helper, prints UserPreference row as JSON
- `show-bad-match.ts` — dev helper, prints job + match breakdown for a low-quality match
- `show-cluster.ts` — dev helper, lists matches in a score range with skills arrays
- `match-diagnostics.ts` — dev helper, total/enriched counts + match score distribution (note: hardcoded to count v2; for v3 stats use ad-hoc Prisma groupBy)
- `test-enrich-prompt.ts` — A/B tests enrichment prompts against known-bad DB jobs without DB writes
- `test-parse-prompt.ts` — A/B tests resume parser prompts (Tue addition)
- `undismiss-all.ts` — dev helper to reset matches for repeated testing

### GitHub Actions

- `daily-cron.yml` — 11:00 UTC, 15-min timeout, scrape + cleanup
- `daily-enrich.yml` — 12:00 UTC, 60-min timeout, runs enrich → match → reasons sequentially

---

## 6. WHAT REMAINS

### Phase 2E.3.B continued (cinematic polish, multi-session, ~6-8h)

Items not yet shipped:

1. **Full accessibility pass** — ARIA, keyboard nav, focus management (~3h)
2. **Keyboard shortcuts in dashboard** — save/dismiss/next via keyboard (~2h)
3. **Loading skeletons + error boundaries** at polish level (~2h)
4. **AI-suggested locations from resume.location** — separate ship (~1h)

### Phase 2E.4 — ✅ SHIPPED (Monday)

Daily cron now runs enrich → match → reasons sequentially via `daily-enrich.yml`. Product is self-sustaining.

### Phase 2E.5 — ✅ COMPLETE for pre-deploy bar (Mon-Wed)

Full first-time onboarding pipeline shipped. End-to-end working with strict-ordering routing guards:

- ✅ Welcome / Profile / Resume / Preferences routes (Mon-Tue)
- ✅ Resume drag-drop + PDF (unpdf) + DOCX (mammoth) (Mon + Wed)
- ✅ Parser v3 with code-side cleaning (Tue)
- ✅ Country picker + country-aware phone normalization (Wed)
- ✅ Edit personal info in /settings (Tue)
- ✅ Onboarding progress indicator (Tue)
- ✅ User.firstName/lastName non-null (Tue)
- ✅ Suggested target roles chips on both surfaces (Wed)
- ✅ Strict-ordering routing guards (Wed)

Only deferred to post-deploy:

- **Fuzzy-matching whitelist for parser cleaning** — replace the personalized SKILL_CANONICAL map with Levenshtein-distance matching against a curated known-technologies whitelist (~5000 entries). Generalizes cleanly to any user's OCR errors. Deferred until real user data informs tuning. (~4-6h)

### Phase 2E matcher correctness fix — ✅ SHIPPED (Wed evening)

Critical architectural fix discovered by user flag. Matcher's idempotency was keyed on a static `matcher-v1` constant, so preference changes never re-scored existing matches — dashboard appeared frozen despite save success. Two-layer fix:

- ✅ Content-addressed matchVersion: SHA256 hash of preferences + resumeId + parseVersion. Hash change → automatic cache invalidation → re-score on next run.
- ✅ Synchronous matcher trigger on save: savePreferencesAction + uploadMasterResumeAction call matchJobsForUser with force=true, graceful failure preserves save success. Match summary surfaces in UI ("Saved. Re-scored X jobs · Y above threshold.").

Real iteration loop closed.

### Phase 2F — Vercel deploy (gated only on backfill completion)

**Pre-deploy prep complete Thu-Fri 2026-06-04 to 2026-06-05. Only one gate remains:**

✅ **v4 enrichment quality verified** — Thu shipped context-aware skill blocklist (commit 4d33852). 23/25 non-tech roles return skills:[], exceeds 18/25 success criterion documented earlier.
✅ **Throughput problem solved** — Thu shipped token-budget throttle (commit e36a6eb). Real Groq TPM is 6,000 not 30,000 (curl-verified). Throttle achieves ~430 successful enrichments per cron run sustained.
✅ **Vercel 4.5 MB body limit blocker resolved** — Fri shipped signed URL upload flow (commit 5da6a29). 3-step pattern: client uploads direct to Supabase Storage, server processes via storagePath, file deleted in finally block. Tested end-to-end with real PDF.
✅ **Schema cleanup** — Fri shipped (commit 5e33f5e). Dropped Log table, UserPreference.onboardingComplete, ResumeVersion.pdfUrl+docxUrl. TypeScript catches 4 dependencies that grep missed.
✅ **Deploy runbook** — Fri shipped `docs/runbooks/deploy.md` (commit f83bcac). 5 pre-flight gates, full Vercel + Supabase config checklist, 7-step deploy sequence with preview-before-prod, rollback plan.
✅ **Vercel account created** — Fri evening, free Hobby plan via GitHub Continue. Project NOT yet imported (correctly waiting for backfill).

✅ **v4 enrichment backfill at 86%** (Sun morning 2026-06-07). 239 NULLs remaining are TPD-blocked, will clear tonight via 00:00 UTC reset + scheduled cron. **Deploy gate revised Sunday morning after honest re-read:** matcher excludes NULLs (score.ts:85 `if (job.skills.length === 0) return { score: 0 }`), so production users NEVER see NULL jobs in their match results. Cron self-heals the 239 overnight without any user impact. 86% backfill is production-correct behavior. Deploying today (Sun afternoon target).
✅ **Zod dedupe fix (commit 19a93ec)** — Sat shipped. Recovers ~2-3% of jobs that were stuck NULL due to LLM duplicates+fragments inflating past Zod max(20). Verified against 8 real failure samples.

⏳ **Vercel project import + env var migration + deploy execution** — Sunday afternoon work per docs/runbooks/deploy.md.

[ORIGINAL BLOCKER DOC PRESERVED FOR HISTORICAL CONTEXT BELOW]

1. **v3 enrichment backfill COMPLETE.** All active jobs must be at `groq-llama-3.1-8b-v3`. Today: 770 v3 / 1 v2 / 810 NULL. Realistic ETA: ~6-10 days at the actual cron throughput (~47-365/day, highly variable due to Groq rate-limit aborts). NOT acceptable to deploy with NULLs — the matcher silently excludes them and users get a degraded, non-transparent view of available jobs. See Drift Pattern #7 in Section 12.

2. **v3 enrichment quality bug fixed.** v3 still hallucinates skills on technical-leaning non-technical titles. Caught Wed evening: "Accounting Technical Solutions Lead @ Stripe" got `skills: [artificial intelligence, ai, accounting]` from v3. This is the v2 problem v3 was supposed to eliminate. Real fix needed before deploy — either v4 prompt iteration OR a post-enrichment validation pass that flags suspicious skill-vs-title pairs. Same Tuesday lesson applies: when the LLM keeps producing bad output, do less in the prompt and more in code (e.g., context-aware skill blocklist).

Throughput problem to investigate as part of #1: Groq returns 429 after ~50 calls in 8 minutes despite math suggesting we're well below TPM/TPD. May need to split the cron into multiple smaller batches spread across the 24h window OR investigate actual Groq free-tier behavior with curl + raw headers.

Real deploy work (only relevant AFTER 1 and 2 are green):

- env var migration to Vercel
- edge vs node runtime decisions (Server Actions are node; Server Components likely edge-safe)
- upload limits (5 MB file body — Vercel free tier supports this)
- cold-start handling (Prisma client + Supabase client initialization)
- domain + Resend SMTP config for production auth callbacks

### Phase 2G — Resume tailoring (multi-session, ~25-35h total)

Full architectural spec lives in this section in detail. Summary: take a master resume + a specific job, generate a tailored variant that re-orders skills/bullets, rewrites summary, and surfaces relevant truth WITHOUT fabrication. Hard problem is verification (catching when LLM crosses into fabrication), not generation.

**Sub-phases (gated on Phase 2F deploy):**

- **Phase 2G.0** (~2-3h): Cerebras provider implementing LLMProvider interface. Free-tier quota check. No tailoring yet.
- **Phase 2G.1** (~10-12h): TailoredResume table + tailorResumeForMatch action + verification pass + structural diff computation.
- **Phase 2G.2** (~8-10h): /dashboard/tailor/[matchId] route with side-by-side preview + change panel + per-change revert.
- **Phase 2G.3** (~5-8h): PDF rendering from tailoredJson. ATS-friendly layout.
- **Phase 2G.4** (~3-5h, optional): DOCX rendering.

**Forbidden transformations (verification must catch all):**

- Add a skill not in master.parsedJson.skills
- Add a bullet that doesn't trace to a master bullet
- Change company/title/dates
- Change education details
- Claim experience master doesn't claim

**Allowed transformations:**

- Reorder skills/bullets
- Rewrite summary using job terminology (every claim must trace to master)
- Rewrite bullet text in job's vocabulary (underlying fact must exist in master)
- Decide which 6-10 bullets to include per role (single-page constraint)
- Truncate work history if too long

**Definition of done:** A user can click "Tailor for this job" from any dashboard match, see master + tailored side-by-side with changes highlighted, revert any disagreement, download clean PDF. Verification catches 100% of fabricated skills and >95% of fabricated bullets.

### Phase 2H+ — Email digest, application auto-fill (Playwright), Gmail intelligence

### Phase 2I — Application tracker

- New `/applications` route (nav placeholder already in AppShell)
- Kanban or list view with status (applied → interview → offer → rejected)
- Notes per application, dates, analytics

---

## 7. KNOWN ISSUES (live, accepted)

1. **Null bytes** — ~0.3% of Greenhouse jobs. Stripped at write; nested JSON occasionally slips. Accepted.
2. **Coinbase** — Greenhouse 404 from GH Actions IPs.
3. **Linear/Supabase (ashby)** — non-US, correctly rejected.
4. **GitHub Actions Node 20 deprecation** — June 2026, bump actions/checkout + actions/setup-node.
5. **Non-technical roles return `skills: []`** — ~60% of jobs. Matcher conditional relevance gate handles correctly.
6. **Enrichment log misleading** — `log.model` shows provider default (70b) while API actually receives override (8b-instant). Cosmetic only.
7. **Hydration warning from Grammarly browser extension** — dev-only, cosmetic.
8. **Settings page resume card is read-only** — drag-drop upload exists at /onboarding/resume but not yet wired into /settings as a "replace resume" surface.
9. **pdf-parse v2 incompatible with Next.js bundled runtime** — fake worker .mjs module not found at runtime. Resolved Monday by switching to unpdf (serverless-friendly). Documented for future reference if anyone considers swapping back.
10. **Cron cleanup occasionally times out on cold-start connection.** Self-healing on next run. Free-tier Supabase behavior, accepted.
11. **LLM enrichment v4 backfill in progress** — End of Fri 2026-06-05: 860/1,673 at v4 (51%), 811 NULL remaining. ETA: 2 cron runs = Saturday afternoon. Real cap is TPD = 500,000 tokens/day = ~415-500 enrichments/day max on free tier.
12. **Reason text may briefly lag matcher scores after preference change** — reason regeneration runs via daily cron, not synchronously on save. After changing preferences, scores update immediately but reason explanations may still describe the previous state until tomorrow's cron. Accepted — scores are the primary signal, reasons are explanation. Documented behavior, not a bug.
13. **`scripts/match-diagnostics.ts` hardcoded to count v2** — script reports v2 count but doesn't show v3 or NULL split. For real enrichment-version stats use an ad-hoc Prisma `groupBy({ by: ["enrichmentVersion"] })`. Will refactor when convenient.

### Recently resolved

- ✅ Phase 2D shipped (LLM abstraction, Groq, enrichment, CLI, cron)
- ✅ Phase 2E.1 backend shipped (resume parser + upload)
- ✅ Phase 2E.2.A backend shipped (matcher engine)
- ✅ Phase 2E.2.A-fix: enrichment model switch + truncation
- ✅ Phase 2E.2.B shipped (reason generator)
- ✅ Phase 2E.3.A shipped (functional dashboard)
- ✅ Phase 2E.3.B wave 1 (score reveal + autocomplete + settings hub + AppShell + route migration)
- ✅ Phase 2E.3.B wave 2 (stagger-in + why-this-score expandable + AI-suggested keywords)
- ✅ Phase 2E.4 shipped Monday (cron wires matcher + reasons after enrichment)
- ✅ Prefs overwrite prevention shipped Monday (schema min(3) keywords + form dirty-field counter)
- ✅ Enrichment v3 shipped Monday (tightened prompt, stops LLM hallucinating skills on non-technical roles)
- ✅ Phase 2E.3.B mobile responsive shipped Monday (AppShell hamburger + dashboard + settings)
- ✅ AI-suggested keywords on onboarding form shipped Monday (server+client split)
- ✅ Phase 2E.5 partial shipped Monday (User schema split + welcome + profile + drag-drop resume upload, end-to-end with unpdf + 70b parse)
- ✅ Edit personal info in /settings shipped Tuesday (PersonalInfoSection with view/edit toggle, useTransition save)
- ✅ Parser architectural fix shipped Tuesday (SKILL_BLOCKLIST + SKILL_CANONICAL code-side cleaning, parse v2→v3, test harness)
- ✅ Phase 2G architectural spec documented Tuesday (full 5-sub-phase plan, ~25-35h total estimate)
- ✅ Onboarding progress indicator shipped Tuesday (thin bar across 4 routes, AuthShell.header prop)
- ✅ User.firstName/lastName tightened to non-null Tuesday (schema migration + email-prefix fallback removed)
- ✅ Suggested target roles chips shipped Wednesday (parsedJson.currentRole + workHistory titles, dedupe, cap 5, both onboarding + settings)
- ✅ Country picker for phone normalization shipped Wednesday (curated 250-entry ISO list, country-aware longest-prefix-match dial code stripping in normalizer, real bug caught mid-test where blind prepend created +9115618877710 corruption)
- ✅ DOCX upload support shipped Wednesday (mammoth.extractRawText, closes known issue #6, workHistory schema null-tolerance fix discovered during DOCX test)
- ✅ Strict-ordering routing guards shipped Wednesday (centralized in src/server/lib/onboarding.ts, dashboard + 3 onboarding pages enforce profile→resume→preferences order with revisit-allowed for completed steps)
- ✅ **Matcher cache invalidation + synchronous re-match on save shipped Wednesday evening** — content-addressed matchVersion with SHA256 hash + synchronous matcher trigger on preferences + resume save actions. Closes the most important product-level bug discovered to date — dashboard scores were frozen for any user iterating, completely breaking the iteration loop. UI now shows real-time feedback: "Saving and re-matching jobs…" → "Saved. Re-scored X jobs · Y above threshold."
- ✅ **v4 enrichment + context-aware skill blocklist shipped Thursday 2026-06-04 (commit 4d33852).** Fixes v3 hallucinations on technical-leaning non-tech titles. Conservative blocklist drops AI-coded skills only on non-tech role patterns, keeps legitimate python/sql/data science. 23/25 non-tech roles return skills:[] (exceeds 18/25 success criterion).
- ✅ **Token-budget throttle for Groq shipped Thursday 2026-06-04 (commit e36a6eb).** Real Groq 8b-instant TPM is 6,000 not 30,000 (curl-verified). Header-based reactive throttle. ~430 enrichments per cron run sustained vs broken cron's 47.
- ✅ **Deploy runbook shipped Friday 2026-06-05 (commit f83bcac).** `docs/runbooks/deploy.md`, 262 lines, 7 sections including pre-flight gates with PASS/FAIL criteria, env var checklist, deploy sequence, rollback plan.
- ✅ **Signed URL upload flow shipped Friday 2026-06-05 (commit 5da6a29).** Resolves Vercel 4.5 MB body limit deploy blocker. 3-step pattern with direct browser→Supabase Storage upload + finally-block cleanup. RLS-scoped to user's own folder, no admin client needed. Tested end-to-end with real PDF.
- ✅ **Schema cleanup shipped Friday 2026-06-05 (commit 5e33f5e).** Dropped Log table (0 rows all-time, never written), UserPreference.onboardingComplete column (never read for gating), ResumeVersion.pdfUrl + docxUrl columns (never populated). TypeScript caught 4 application-code references that grep missed.

---

## 8. CRITICAL FILES (current repo state)

| Concern                  | Path                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Front door               | `README.md`                                                                                                                                                                                                                                                                                                                                                                                                          |
| System map               | `ARCHITECTURE.md`                                                                                                                                                                                                                                                                                                                                                                                                    |
| Working rhythm           | `COLLABORATION.md`                                                                                                                                                                                                                                                                                                                                                                                                   |
| Build narrative          | `AI_JOB_OS_SESSION_JOURNAL.md`                                                                                                                                                                                                                                                                                                                                                                                       |
| Vision                   | `VISION.md`                                                                                                                                                                                                                                                                                                                                                                                                          |
| Decisions                | `docs/adr/*.md`                                                                                                                                                                                                                                                                                                                                                                                                      |
| Design DNA               | `docs/design/principles.md`                                                                                                                                                                                                                                                                                                                                                                                          |
| Deploy runbook           | `docs/runbooks/deploy.md` (Fri 2026-06-05, 262 lines, 7 sections: pre-flight gates, Vercel env vars, Supabase prod config, deploy sequence, cron jobs post-deploy, rollback plan, known concerns)                                                                                                                                                                                                                    |
| Storage bucket `resumes` | Supabase dashboard config (not in code): private bucket, 5 MB limit, 3 MIME types restricted, 3 RLS policies on storage.objects scoped to `auth.uid()`. Path convention: `{authId}/{timestamp}-{sanitizedFilename}`.                                                                                                                                                                                                 |
| Cron runbook             | `docs/runbooks/cron.md`                                                                                                                                                                                                                                                                                                                                                                                              |
| Design tokens            | `src/styles/tokens.ts`, `src/app/globals.css`                                                                                                                                                                                                                                                                                                                                                                        |
| Prisma schema            | `prisma/schema.prisma`                                                                                                                                                                                                                                                                                                                                                                                               |
| SQL triggers             | `prisma/sql/0001_auth_signup_trigger.sql`                                                                                                                                                                                                                                                                                                                                                                            |
| Auth                     | `src/server/actions/auth.ts`, `src/app/login/*`, `src/app/signup/*`, `middleware.ts`                                                                                                                                                                                                                                                                                                                                 |
| Preferences action       | `src/server/actions/preferences.ts` (savePreferencesAction with optional redirectTo, triggers matcher synchronously after upsert)                                                                                                                                                                                                                                                                                    |
| Profile action           | `src/server/actions/profile.ts` (saveProfileAction with country-aware E.164 normalization)                                                                                                                                                                                                                                                                                                                           |
| Resume upload action     | `src/server/actions/resume.ts` (Fri 2026-06-05 rewrite — TWO Server Actions: `requestResumeUploadUrlAction(filename, fileSize, contentType)` returns signed Storage URL; `uploadMasterResumeAction(storagePath: string)` downloads + processes + deletes in finally block. MIME-routed: unpdf for PDF, mammoth for DOCX, plain text. Atomic master-switch transaction. Triggers matcher synchronously after switch.) |
| Match actions            | `src/server/actions/match.ts`                                                                                                                                                                                                                                                                                                                                                                                        |
| Onboarding helpers       | `src/server/lib/onboarding.ts` (getNextOnboardingStep + canAccessStep — centralized routing rules)                                                                                                                                                                                                                                                                                                                   |
| Onboarding welcome       | `src/app/onboarding/welcome/page.tsx`                                                                                                                                                                                                                                                                                                                                                                                |
| Onboarding profile       | `src/app/onboarding/profile/{page,_components/profile-client-form}.tsx` (CountryPicker paired with phone input)                                                                                                                                                                                                                                                                                                      |
| Onboarding resume        | `src/app/onboarding/resume/{page,_components/resume-upload-form}.tsx` (PDF + DOCX accept; canAccessStep gate)                                                                                                                                                                                                                                                                                                        |
| Onboarding prefs         | `src/app/onboarding/preferences/{page,_components/preferences-client-form}.tsx` (suggestedSkills + suggestedTargetRoles; canAccessStep gate; motion.button replaces SubmitButton)                                                                                                                                                                                                                                    |
| AppShell layout          | `src/app/(app)/layout.tsx`                                                                                                                                                                                                                                                                                                                                                                                           |
| AppShell components      | `src/app/(app)/_components/{app-shell,user-menu}.tsx`                                                                                                                                                                                                                                                                                                                                                                |
| AuthShell                | `src/components/auth/auth-shell.tsx` (brand + title + children + optional `header` slot for progress indicator)                                                                                                                                                                                                                                                                                                      |
| Dashboard route          | `src/app/(app)/dashboard/page.tsx` (uses getNextOnboardingStep helper for routing)                                                                                                                                                                                                                                                                                                                                   |
| Dashboard components     | `src/app/(app)/dashboard/_components/{match-card,match-list,empty-state,score-ring,score-breakdown}.tsx`                                                                                                                                                                                                                                                                                                             |
| Settings route           | `src/app/(app)/settings/page.tsx` (passes country + suggestedTargetRoles)                                                                                                                                                                                                                                                                                                                                            |
| Settings form            | `src/app/(app)/settings/_components/{preferences-form,personal-info-section}.tsx` (matchSummary state, enriched toast, CountryPicker in PersonalInfoSection)                                                                                                                                                                                                                                                         |
| Resume parser            | `src/server/services/ai/parse-resume.ts` (v3 with SKILL_BLOCKLIST + SKILL_CANONICAL code-side cleaning; workHistory.title/company nullable)                                                                                                                                                                                                                                                                          |
| Matcher                  | `src/server/services/matcher/{score,filters,match,reason}.ts` (match.ts exports computeMatchVersion; content-addressed cache)                                                                                                                                                                                                                                                                                        |
| Zod schemas              | `src/shared/schemas/{preferences,profile}.ts` (profile has country-aware E.164 phone transform with longest-prefix-match dial code stripping)                                                                                                                                                                                                                                                                        |
| Suggestion data          | `src/shared/data/{role,location,countries}-suggestions.ts` (countries.ts = full ISO 3166-1 list with name + dial)                                                                                                                                                                                                                                                                                                    |
| Reusable inputs          | `src/components/onboarding/{chip-input,country-picker,experience-range,job-type-select,preference-toggle,progress}.tsx`                                                                                                                                                                                                                                                                                              |
| Command palette          | `src/components/command-palette.tsx`                                                                                                                                                                                                                                                                                                                                                                                 |
| Scrapers                 | `src/server/services/scrapers/{greenhouse,ashby,location,hash,rules}.ts`                                                                                                                                                                                                                                                                                                                                             |
| LLM provider             | `src/server/services/ai/{llm,groq-provider}.ts` (groq-provider includes token-budget throttle from Thu 2026-06-04: parseResetWindow + waitForHeadroom + updateRateLimitState — reactive header-based pacing)                                                                                                                                                                                                         |
| Job enrichment           | `src/server/services/ai/enrich.ts` (v4 from Thu 2026-06-04: NON_TECH_TITLE_PATTERNS + AI_CODED_HALLUCINATED_SKILLS + applyContextAwareSkillBlocklist runs BEFORE sanitize)                                                                                                                                                                                                                                           |
| CLIs                     | `scripts/{scrape,cleanup,enrich,parse-resume,seed-master-resume,match,top-matches,reasons,show-reasons,show-breakdown,show-parsed-skills,show-prefs,show-bad-match,show-cluster,match-diagnostics,test-enrich-prompt,test-parse-prompt,undismiss-all}.ts`                                                                                                                                                            |
| GitHub Actions           | `.github/workflows/{daily-cron,daily-enrich}.yml`                                                                                                                                                                                                                                                                                                                                                                    |

---

## 9. HOW TO RESUME

Start a new session with:

> "Read CONTEXT.md first. Confirm schema field names before any code. Free-tier-only is a locked decision — never propose paid APIs."

Then paste CONTEXT.md (or load it via Claude Projects — see Section 10).

I will:

1. Re-read the bar (especially the FREE TIER ONLY rule)
2. Confirm schema fields (Section 3)
3. Plan in plain English before code
4. Write code in ≤30-line chunks
5. Never re-derive context from memory

If fresh Claude (different account): also paste README.md, ARCHITECTURE.md, COLLABORATION.md.

---

## 10. CLAUDE PROJECTS (recommended setup going forward)

If you have Claude Pro, create a Project for AI Job OS. Upload README.md, ARCHITECTURE.md, CONTEXT.md, COLLABORATION.md as project knowledge. New chats in that project auto-include all four — no pasting per session.

When you update CONTEXT.md, re-upload to the project to replace.

---

## 11. NEXT SESSION CHECKLIST (priority order)

Wednesday (2026-06-03) shipped 6 commits in a long, disciplined session:

1. CONTEXT.md surgical refresh (sections 1, 3, 4, 5, 6, 7, 8, 11)
2. Suggested target roles chips on onboarding + settings (~1h)
3. Country picker for phone normalization (~2h, with mid-test corruption-bug catch)
4. DOCX upload support via mammoth (~1.5h)
5. Strict-ordering onboarding routing guards (~1h)
6. **Matcher cache invalidation + synchronous re-match on save** — the most important commit of the week. User flagged dashboard-frozen symptom; agent caught architectural bug present since Phase 2E.2.A. Content-addressed matchVersion via SHA256 hash + sync matcher trigger on save actions. Real iteration loop closed.

Phase 2E.5 is now **COMPLETE for pre-deploy bar.** Only fuzzy-matching whitelist for parser cleaning remains (post-deploy, ~4-6h when real user data informs tuning).

### Saturday/Sunday deploy plan

Thursday (2026-06-04) and Friday (2026-06-05) shipped 5 commits across Phase 2F deploy prep:

- 4d33852 `feat(enrich): v4 with context-aware skill blocklist` (Thu)
- e36a6eb `feat(groq): proactive token-budget throttle using published rate-limit headers` (Thu)
- f83bcac `docs(runbook): phase 2F vercel deploy runbook` (Fri)
- 5da6a29 `feat(upload): signed URL flow bypasses vercel 4.5MB body limit` (Fri)
- 5e33f5e `refactor(schema): drop unused Log table + onboardingComplete + pdfUrl/docxUrl` (Fri)

Only remaining deploy gate is **v4 backfill completion.** End of Fri 2026-06-05: 860/1,673 at v4 (51%). 811 NULL remaining. Real TPD ceiling = ~415-500 enrichments/day = 2 more cron runs to clear.

**Sunday deploy execution plan (2026-06-07):**

1. **9-10 AM Central — CONTEXT.md update** (this commit). Capture Saturday's Zod fix + Sunday morning's revised deploy gate reasoning. Done before any deploy work so docs reflect reality.

2. **10-11 AM Central — Pre-flight gates from `docs/runbooks/deploy.md` Section 1:**
   - Gate 1: backfill state acceptable (86% v4, matcher excludes NULLs = production-correct)
   - Gate 2: v4 quality verified (23/25 spot-check from Thu still holds)
   - Gate 3: `git status` clean
   - Gate 4: `npx tsc --noEmit` clean
   - Gate 5: `npm run build` local production build clean (watch for Turbopack issues flagged in runbook Section 7)

3. **11 AM-1 PM Central — Vercel project import + env var migration.** Per runbook Section 4 Steps 1-3. 14 env variables including DATABASE_URL, all Supabase keys, Sentry DSN, PostHog key, GROQ_API_KEY, Resend keys. Set up Supabase auth callback URL for production domain.

4. **1-2 PM Central — Preview deploy + smoke test.** Per runbook Section 4 Step 4: ~25-item smoke test including auth flow, onboarding (signup → profile → resume upload → preferences), dashboard match scores, settings edit, signed URL upload via Storage.

5. **2-3 PM Central — Promote to production.** Per runbook Section 4 Step 5. Watch production for 30 min. Verify cron continues running.

6. **3-4 PM Central — Post-deploy docs.** Update README.md with live URL + status change "Beta in development" → "Beta deployed." Update CONTEXT.md Section 2 with Phase 2F SHIPPED status + production URL. Add post-mortem section to `docs/runbooks/deploy.md` capturing what surprised us during deploy.

7. **4 PM Central — shipped, stable, observable.**

**If anything in steps 2-5 fails the bar:** STOP. Diagnose. Do NOT ship at 4 PM if gates fail or smoke test reveals issues. Bar pre-check applies — clock target is a goal, bar is the criterion.

**Post-deploy CI/CD plan:** Once Vercel is connected, all future work happens on branches with preview URLs. Production untouched until merge to main. Phase 2G iteration becomes safe to start immediately.

[HISTORICAL CONTEXT — Friday plan below (now all shipped)]

**Saturday plan (in strict order):**

1. **Morning (~7 AM Central, after 12:00 UTC scheduled cron):** Verify scheduled cron ran cleanly. Run backfill diagnostic: expect ~1,290 at v4, ~380-400 NULL remaining.
2. **Mid-day (~12 PM Central, after enough TPD has refreshed):** Trigger manual cron from Actions UI. Wait ~60 min. Run diagnostic again. Expected: ~0 NULLs remaining, all 1,673 at v4.
3. **Afternoon (~3-4 PM Central):** Run all 5 pre-flight gates from `docs/runbooks/deploy.md` Section 1. Execute runbook Section 4 Steps 1-6.
4. **Post-deploy same-day:** Update README + CONTEXT with live URL. Add post-mortem section to deploy.md.

**Sunday is safety margin.** If Saturday hits unexpected issues, deploy moves to Sunday afternoon.

[HISTORICAL CONTEXT — Thursday's deploy prep priorities BELOW (now all shipped)]

**Priorities for next session (in strict order — do not skip):**

1. **Investigate + fix Groq rate-limit throughput problem** (~2-3h diagnostic + fix).
   - Test with curl: `curl -v https://api.groq.com/openai/v1/chat/completions ... -H "Authorization: Bearer $GROQ_API_KEY"` against a single enrichment call. Read the response headers (`x-ratelimit-*`, `retry-after`). Find out the actual limit being hit (TPM? TPD? RPD? Per-second?). Document the real numbers in CONTEXT.md.
   - Based on actual limit, design a throughput fix. Options to evaluate against the bar:
     - Split daily-enrich.yml into N smaller cron triggers spread across 24h
     - Add a budget-aware `--max-tokens-per-run` flag to enrich.ts
     - Move enrichment to a different model with higher headroom (only if it still honors free-tier-only AND quality is equal or better — DO NOT compromise quality for throughput)
   - Success criterion: backfill rate of >=500 jobs/day sustained, with the cron running cleanly to completion (no 429 aborts).

2. **Fix v3 enrichment quality on technical-leaning non-tech titles** (~2-3h).
   - The bug: "Accounting Technical Solutions Lead" got `skills: [artificial intelligence, ai, accounting]`. The LLM is using the word "Technical" in the title to assume the role is technical and hallucinate AI skills.
   - Real candidates (decide against the bar):
     - v4 prompt iteration that explicitly disambiguates "Technical Solutions" / "Sales Engineer" / "AI Account Executive" patterns — but Tuesday's lesson is that prompt tightening over-prunes real signal.
     - Post-enrichment validation pass: if the role title clearly indicates a non-tech function (Accounting, Sales, Recruiter, Legal, etc.) AND the LLM returned generic-sounding AI skills, drop those skills. Code-side filter, same architectural pattern as SKILL_BLOCKLIST.
     - Tighter Zod schema: require evidence in the description for any skill claim. Probably too strict, would reject too much.
   - Success criterion: A spot-check of 20 non-technical roles (Accounting, Sales, Recruiter, Legal, Operations, Customer Success) returns `skills: []` for at least 18 of them.

3. **Re-run full v3 backfill end-to-end ONCE both #1 and #2 are shipped.**
   - Bump ENRICHMENT_VERSION to v4 (so all existing v3 jobs get re-scored under the corrected quality pass + faster throughput)
   - OR: keep v3 and run `enrich --force` once if the quality fix is code-side post-validation
   - Watch the cron complete. Verify backfill goes from 770 v3 + 1 v2 + 810 NULL to ~1581 at the current version, zero NULLs, zero stragglers.

4. **THEN Phase 2F — Vercel deploy** (~3-4h).
   - Env var migration to Vercel project settings (DATABASE_URL, DIRECT_URL, all Supabase keys, Sentry DSN, PostHog key, GROQ_API_KEY, Resend keys)
   - Verify Server Actions work on Vercel (node runtime by default)
   - Check upload limits — 5 MB resume upload + body size on Vercel free tier
   - Set up Supabase auth callback URL for production domain
   - Configure Resend SMTP for production emails
   - Deploy a preview branch first, smoke-test the full onboarding flow + dashboard, then promote to production
   - Update README + CONTEXT with the live URL

**If items 1-3 take longer than expected:** do not move on to Phase 2F early. The bar is "complete + correct," not "good enough to deploy and patch later." See Drift Pattern #7.

**Defensive ground if items 1-3 hit a wall:**

- Resume re-upload from /settings (currently read-only there; the action exists, just not wired)
- Loading skeletons + error boundaries at dashboard polish level
- Accessibility pass (ARIA, keyboard nav, focus management)
- Keyboard shortcuts on dashboard (j/k navigation, a/d for apply/dismiss)

These don't unblock deploy but are real polish work the bar deserves.

**Not on critical path until Phase 2F lands:**

- Cerebras provider (Phase 2G.0 dependency, ~2-3h)
- Resume tailoring (Phase 2G full spec in Section 6, ~25-35h multi-session)
- Email digest / Playwright application auto-fill (Phase 2H)
- Phase 2I application tracker
- Fuzzy-matching whitelist for parser cleaning (~4-6h, post-deploy)

### Reflection notes — patterns worth remembering

Monday (~10-11h, 9 commits): near-miss with `prisma migrate dev` that would have wiped DB. Schema split + onboarding pipeline + mobile responsive shipped end-to-end.

Tuesday (~3h, 6 commits): disciplined. Parser fix discovered architectural lesson — "LLM prompts are extraction tools, not quality filters." Two explicit user pushbacks improved the work (timestamp accuracy + generalizability check).

Wednesday (long, 6 commits, ended with the matcher fix): three of the six were straightforward 2E.5 ships. Then user flagged the frozen-dashboard symptom and the session pivoted to architectural correction. The matcher cache bug had been present since Phase 2E.2.A — months. Survived because nobody ran the system end-to-end as a real user iterating with preferences.

Thursday (~3h, 3 commits): Phase 2F deploy prep. Diagnosed actual Groq rate limits with curl (real TPM = 6,000 not 30,000 — documentation was wrong). Shipped v4 enrichment with context-aware skill blocklist (conservative architecture — keeps python/sql, drops only AI-coded skills on non-tech roles). Shipped token-budget throttle reading published x-ratelimit-\* headers. Real win: rate-limit aborts went from killing the cron after 47 jobs to allowing 188 successful before TPD ceiling hit.

Friday (long, 4 commits, late-night): Phase 2F deploy prep continued. Three real engineering moments: identified Vercel 4.5 MB body limit as deploy blocker during runbook writing; designed signed URL upload flow against the bar (rejected lazy "just lower the limit" fix); discovered `supabase-admin.ts` is dead code while investigating sb*secret*\* JWT bug (Drift #3 catch — was about to fix code with zero callers). User caught 3 real drifts during Friday session. Bar pre-check format invoked explicitly in commit messages (4 questions each: Closer to bar? Senior audit pass? Right vs convenient? Unlimited time same?).

Saturday (extended, 1 commit shipped + 1 doc commit): Diagnosed Zod validation_failed pattern from full 60-min cron logs. Initial drift: agent claimed "1 job in 60 min" without checking — user corrected with "you are mixing two cases here it was a bigger number." Real metrics: ~300 jobs/run sustained at ~5/min, validation failures ~2.7%, transport failures ~0.7%. Throttle working correctly. User pushed back on agent's "just remove the .max(20)" lazy proposal with Chesterton's Fence question. Second analysis pass surfaced the real cause: sanitize() ran AFTER validation, should run BEFORE. Real fix: z.preprocess on skills field. Tested against 8 real failure samples (5/8 recover). Decision NOT to raise MAX_SKILLS=20 was product-grounded — user's beta cohort is non-senior, matcher arithmetic uses overlap/total, raising cap would silently dilute scores for content-rich postings. Drift #2 (lazy-first-proposal) caught and corrected by user.

Sunday morning (deploy day): Backfill at 86%. Initial agent reaction was Drift #1 (push deploy to evening "for bar"). Honest re-read: matcher excludes NULLs (score.ts:85), so 239 remaining NULLs are invisible to users. Production behavior is correct at 86%. Cron self-heals overnight via 00:00 UTC TPD reset. Deploy gate revised mid-session to "production-correct behavior" rather than "zero NULLs." Two drifts caught and corrected within this session alone.

Saturday (extended, 1 commit shipped + 1 doc commit): Diagnosed Zod validation_failed pattern from full 60-min cron logs. Initial drift: agent claimed "1 job in 60 min" without checking — user corrected with "you are mixing two cases here it was a bigger number." Real metrics: ~300 jobs/run sustained at ~5/min, validation failures ~2.7%, transport failures ~0.7%. Throttle working correctly. User pushed back on agent's "just remove the .max(20)" lazy proposal with Chesterton's Fence question. Second analysis pass surfaced the real cause: sanitize() ran AFTER validation, should run BEFORE. Real fix: z.preprocess on skills field. Tested against 8 real failure samples (5/8 recover). Decision NOT to raise MAX_SKILLS=20 was product-grounded — user's beta cohort is non-senior, matcher arithmetic uses overlap/total, raising cap would silently dilute scores for content-rich postings. Drift #2 (lazy-first-proposal) caught and corrected by user.

Sunday morning (deploy day): Backfill at 86%. Initial agent reaction was Drift #1 (push deploy to evening "for bar"). Honest re-read: matcher excludes NULLs (score.ts:85), so 239 remaining NULLs are invisible to users. Production behavior is correct at 86%. Cron self-heals overnight via 00:00 UTC TPD reset. Deploy gate revised mid-session to "production-correct behavior" rather than "zero NULLs." Two drifts caught and corrected within this session alone.

**Seven specific patterns worth remembering:**

1. **Multi-line Node `-e` scripts have backtick escape problems.** Write `.mjs` scripts to disk instead, then `node /tmp/patch.mjs`. Safer for multi-anchor patches.
2. **Commitlint enforces subject-case lowercase.** "ai-suggested" not "AI-suggested" in commit subjects.
3. **`prisma db push` is the workflow for this project — NEVER `prisma migrate dev`.** migrate dev would offer destructive reset due to existing drift. Always pre-flight DB-touching schema changes with a NULL/integrity check before pressing y.
4. **LLM prompts are extraction tools, not quality filters.** Tuesday's parser fix: two prompt iterations trying to teach the 70b model to filter "noise" caused it to drop 7-8 real skills (numpy, pandas, react, etc.). Real fix: revert prompt to "extract everything verbatim," move filtering to deterministic code (Set + Record lookup). Pattern generalizes: when the LLM is dropping real content, the right answer is often "ask less of the LLM, do more in code."
5. **Timestamp accuracy matters for trust.** When agent guesses wall-clock from message timing and gets it wrong, it creates false urgency. Rule: agent does not state wall-clock; user provides it when needed.
6. **Audit the core product loop yourself, periodically — don't just work through queued features.** The matcher cache bug survived months because nobody ran the system end-to-end as a real user iterating. Section 11 priorities are a queue, not a quality bar. Working through the queue while the central product loop is broken is a real failure mode. Periodic system-level audit ("does the dashboard actually update when I change keywords?") is required, not optional.
7. **When user flags a symptom, don't accept the first fix that occurs. Run it against the bar twice.** Tonight: agent's first proposal was "drop the skip-if-exists logic, always re-score." User pushed back with "rethink twice — is this the real fix per the bar?" Second analysis pass surfaced the actual correctness mechanism (content-addressed matchVersion via input hash) — preserves idempotency, fixes invalidation, self-heals. Lazy fix vs Stripe-grade fix. User pushback forced the second pass and the better outcome.

---

## 12. AGENT DRIFT PATTERNS (read before planning anything)

This section exists because the agent (Claude) repeatedly drifted in measurable ways during the 2026-06-03 session, and the user had to catch each one. The patterns below are real and named. Tomorrow's session must read them before proposing any plan, ship, or "honest call."

**The meta-rule:** If you (the agent) catch yourself making one of these moves, STOP. Re-read the bar in Section 1. Re-state the recommendation against the bar, not against the calendar. Acknowledge the drift to the user.

### Drift #1 — Budget-over-bar framing

**The pattern:** Agent frames decisions around "fits the time budget" instead of "matches the bar." Triggers when the agent says things like "this is a 1h ship," "stop here, X is a good day," "deploy can happen anytime starting tomorrow," "the smaller scope is the right call."

**Why it's wrong:** Budget is a guardrail against bad decisions, not the criterion for which decision is right. The bar in Section 1 is the criterion: Apple-grade UI, Stripe-grade backend, never fabricate, system stays correct under partial failure, free tier only.

**When the user catches you:** They will say "remember the bar not the time" or "you keep coming back to budget." If they say this even once, the agent has already drifted. Apologize, re-frame the same decision against the bar, and proceed only after the user confirms the new framing.

**Example from 2026-06-03:** Multiple ships during the day were framed as "fits the 3-hour budget." User caught it repeatedly. The right framing was always "matches the bar" — never "fits the time."

### Drift #2 — Lazy-first-proposal

**The pattern:** When user flags a problem, agent's first proposed fix is the cheap/simple one, not the architecturally correct one. Triggers when the agent proposes a fix in the first 1-2 messages after the user surfaces a bug, without rigorously checking it against the bar.

**Why it's wrong:** "Stripe-grade" means the fix is correct, not minimal. Examples of lazy-first-proposals from this session:

- Matcher cache bug: first proposal was "drop the skip-if-exists logic entirely, always re-score." Real fix was content-addressed matchVersion via SHA256 hash — preserves idempotency AND fixes invalidation.
- Backfill ETA: first proposal was "deploy without 100% backfill done, it'll catch up in 5 days." Real call is to wait for backfill to be COMPLETE before deploying because partial backfill silently degrades match quality for new users.

**When the user catches you:** They will say "rethink twice — is this the real fix per the bar?" or "this is a drop in bar standards." If you hear either, your first proposal was lazy. Second analysis pass is required, run explicitly against Section 1.

**Mandatory drill:** Before proposing any fix, ask out loud: "Is this Stripe-grade or is it the cheap version of Stripe-grade?" If the answer is "cheap version," do not send it. Find the real fix first.

### Drift #3 — Phantom problem chasing

**The pattern:** Agent treats normal system behavior as a symptom of a bug and runs multiple diagnostics before realizing the data was already explaining itself. Triggers when the agent runs 3+ diagnostic queries in a row without stating an explicit hypothesis under test.

**Why it's wrong:** Wastes session time. Erodes user trust. The right question is always "is this expected?" BEFORE "is this a bug?"

**Example from 2026-06-03:** v2 enrichment count showed 1 remaining. Agent treated it as suspicious. Ran 5+ Prisma queries. User caught it: "you yourself has doubt on it — first check if this is expected, then check if it's a bug." The correct answer was already in CONTEXT.md Section 4 (Groq daily limits + cron schedule explain the rate).

**Drill:** Before running ANY diagnostic, write down: (a) what you believe should be true, (b) what the data is showing, (c) whether (b) is explained by stuff already in CONTEXT.md. If you can't justify the diagnostic run after that, don't run it.

### Drift #4 — Section 11 priorities as quality bar

**The pattern:** Agent works through Section 11 priority queue while the central product loop is broken. The Section 11 list is a queue of FEATURES, not a guarantee that previously-shipped features still work correctly.

**Why it's wrong:** Tonight's session uncovered: the matcher's idempotency was keyed on a static `matcher-v1` constant. Once a (user, job) pair scored, it was never re-scored. The dashboard was effectively frozen for any user iterating on preferences. This bug had been in the codebase since Phase 2E.2.A. It survived multiple sessions of building features on top of it because nobody audited the core loop.

**Drill:** At the start of every session, before working through Section 11, ask: "When was the last time someone ran the product end-to-end as a real user iterating with preferences and watched the dashboard update?" If the answer is "not this week" or "I don't know," your first task is to do that audit — change keywords, click save, verify dashboard updates with expected scores. NOT to ship the next queued feature.

**The bigger rule:** A queue of features is not a substitute for system-level health. Audit periodically.

### Drift #5 — Stating wall-clock from inference

**The pattern:** Agent infers the current wall-clock time from message timestamps or session length, states it explicitly, and creates false urgency or false confidence.

**Why it's wrong:** The agent does not have reliable access to wall-clock time. Inference compounds errors across messages. When the agent says "it's been 3 hours" or "you're at the 2.5-hour mark" without the user providing that data, the agent is fabricating.

**Rule:** Agent NEVER states wall-clock or session duration unless the user provided it explicitly in the conversation. If the agent needs to reason about time (budget left, ETA), ask the user for the current time.

**This is documented as Pattern #5 in Section 11 reflection notes. It continues to be a real drift trigger — call it out whenever it surfaces.**

### Drift #6 — Over-asking for file pastes

**The pattern:** Agent asks for narrow file slices via `sed -n` or `grep` in 4-5 consecutive turns instead of asking for the full file once. This wastes user time and creates context bloat.

**Why it's wrong:** Each round trip costs user effort. The right move is usually: ask for the whole file in question ONCE, work from the complete picture for several patches, only ask for verification at the end.

**Drill:** Before asking for a partial file view, ask: "Will I need to see another part of this same file in my next 1-2 turns?" If yes, ask for the whole file now. Use `cat path | pbcopy && wc -l path` to make the paste cheap.

### Drift #7 — Documenting incomplete fixes as "shipped"

**The pattern:** Agent declares a feature "complete" or proposes shipping when the bar isn't actually met. Triggers when the agent uses language like "good enough," "minimum viable," "acceptable for now," "will catch up later," "doesn't block deploy."

**Why it's wrong:** The bar is not "minimum viable." It's Apple-grade and Stripe-grade. Apple doesn't ship the iPhone with 60% of the buttons working because the rest "will be patched."

**Example from 2026-06-03:** After diagnosing the backfill rate (~150/day, ETA ~6 days for 810 NULLs), agent proposed deploying with NULLs still pending because "the matcher uses v3 jobs that exist" and "NULL backfill is background work." User correctly flagged: "this is a drop in bar standards." The right call is: deploy is gated on backfill complete AND v3 quality issues (e.g., the Accounting role hallucinating AI skills) resolved.

**Drill:** Before declaring anything "complete" or "ready to ship," check each item against the bar in Section 1. If even one item fails the bar — even if it's "small" — it's not shipped, it's partial. Document it honestly as partial.

### Drift #8 — Bar Pre-Check Required Before Every Action

**The pattern:** Agent proposes any action (commit, code change, config change, ship decision, "stop here" recommendation) without first running it through an explicit 4-question check against the bar in Section 1. Drift is most likely to happen on actions that feel small or routine — exactly the actions where the agent's defenses are down.

**Why it's wrong:** Every prior drift (#1 through #7) traces back to the same root cause: an action shipped without an explicit bar check. The agent's pattern-matching brain CAN catch drift when forced to think about it explicitly, but CANNOT catch drift when running on autopilot. The explicit check is the brake pedal.

**The 4-question pre-check (apply BEFORE every action):**

1. **Closer to bar?** — Does this action move us toward the bar in Section 1 (Apple-grade UI, Stripe-grade backend, never fabricate, FREE TIER ONLY, system stays correct under partial failure)? Or does it just move forward without raising the bar?

2. **Would a senior engineer approve?** — Imagine pasting this commit / decision in front of a Stripe senior engineer for code review. Would they say "ship it" or "this needs more rigor"? If you can't honestly say "ship it," the action isn't done yet.

3. **Right vs convenient?** — Is this the architecturally correct fix, or the easy fix that we'll regret later? "It works" is not the same as "it's right." Convenient solutions accumulate technical debt; right solutions compound quality.

4. **Same answer with unlimited time?** — If you had unlimited time and resources, would you do the same thing? If the answer is "I'd do it differently with more time," then you're optimizing for budget, not bar — that's Drift #1.

**Examples from 2026-06-05 (Friday) session when this drill caught drift:**

- About to "just upgrade supabase-js to 2.107.0 and hope it fixes sb*secret*\*." Bar pre-check Q3 (Right vs convenient) said "convenient — we haven't verified the changelog includes the fix." Stopped to verify. Found the bug was unfixed AND found the admin client itself is dead code. Real fix was "don't use admin client for user-initiated operations" (RLS via cookie-bound client). Two layers of drift caught.
- About to call 8 KB resume size a bug. Bar pre-check forced verification against disk first. Real PDF is 8.4 KB (text-only). Not a bug. Drift #3 prevented.
- About to drop schema columns without checking row counts. Bar pre-check forced pre-flight diagnostic. Found 1 orphaned `onboardingComplete=true` (developer's own row, safe). All other columns confirmed empty. Drop proceeded safely instead of blindly.

**Mandatory drill before EVERY action:**

Before sending any non-trivial response that proposes shipping code, running commands, making schema changes, or making product decisions, the agent must write out the 4 questions and answer each one explicitly:

```
## Bar pre-check on this action
1. Closer to bar: <YES / NO with one sentence reasoning>
2. Senior audit: <PASS / FAIL with one sentence on what they'd say>
3. Right vs convenient: <RIGHT / CONVENIENT with one sentence>
4. Unlimited time: <SAME / DIFFERENT with one sentence>
→ Proceeding / Stopping / Re-thinking
```

If any question returns a problematic answer (NO / FAIL / CONVENIENT / DIFFERENT), STOP. Either redesign the action, or explicitly ask the user whether to proceed with the known compromise.

**When the user catches you skipping this:** They will say "did you bar pre-check this?" or "what's the bar say?" If they have to ask, you've drifted. The check should be in the output BEFORE the user has to ask.

**The deeper rule:** The bar is held by discipline, not by intuition. Every commit message in the 2026-06-05 session included an explicit bar pre-check in the commit body. That's what makes the discipline real and durable across sessions — it's encoded in the artifacts, not just in this session's chat.

---

### How to use this section

At the start of every session, after re-reading Sections 1-11, re-read this section. When you (the agent) propose any of the following:

- A plan or scope estimate
- A "stop here, this is a good place to pause"
- A fix proposal in response to a user-flagged bug
- A "ready to deploy" or "this is complete"

…run it against the 7 drift patterns above. If your proposed move pattern-matches to any of them, revise before sending.

When the user pushes back with language like "remember the bar not the time," "is this the real fix per the bar," "you keep optimizing for X," or "this is a drop in bar standards" — you've drifted. Acknowledge it explicitly, name the drift number, re-propose against the bar, wait for the user to confirm before proceeding.

The user has been more rigorous than the agent at holding the bar this session. The user trusts the agent to hold it without supervision. This section exists to make that trust earnable in future sessions.
