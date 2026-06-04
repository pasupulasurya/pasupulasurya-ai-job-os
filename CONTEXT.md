# AI Job OS — Session Context

> **Paste this file at the start of every new session with Claude.**
> Last updated: 2026-06-03 evening session (Phase 2E.5 complete + matcher cache invalidation architectural fix)

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

**Total in DB:** 1,581 active jobs across all companies. 771 enriched at v3, 1 v2 straggler, 810 NULL (pre-v3 scrape window, working through daily cron at ~120/day). v3 backfill expected complete approximately Friday June 5.

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
- `onboardingComplete` (Boolean default false) — present in schema but NOT used as a gate; routing/dashboard gates check `keywords.length >= 3` and other actual data presence

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
Enrichment metadata: `enrichedAt`, `enrichmentVersion` (current: `groq-llama-3.1-8b-v3`)

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

Core: `id, userId (REQUIRED), jobId (optional), contentJson, pdfUrl, docxUrl, createdAt, applications[]`
2E.1 fields:

- `isMaster` (Boolean default false) — one master per user, atomic switch via transaction
- `parsedJson` (Json?) — AI-extracted: { fullName, email, phone, location, summary, totalYearsExperience, currentRole, currentCompany, education[], workHistory[], skills[], links{} }. **WATCH:** workHistory[].title and workHistory[].company are now nullable in the Zod schema (real LLM output occasionally returns null for implicit/unclear titles in real-world resumes — discovered during DOCX test Wed).
- `parsedAt` (DateTime?), `parseVersion` (String?) — current: `groq-llama-3.3-70b-resume-v3`
- `fileName` (String?), `fileSize` (Int?)
- Indexes: `[userId]`, `[userId, isMaster]`

### UserBlockedCompany

`id, userId, companyId, reason, blockedAt`

### Log

`id, action, payload, level, createdAt`

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
| Groq free tier (8b-instant)                     | 14,400 RPD / 30,000 TPM / 500,000 TPD                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Groq free tier (70b)                            | 1,000 RPD / 6,000 TPM / 100,000 TPD                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Enrichment version                              | `groq-llama-3.1-8b-v3` (current; bumped Mon after tightened anti-hallucination prompt)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Enrichment throttle                             | 500ms between successful jobs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
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
- `groq-provider.ts` — Groq impl with retry, timeout, Retry-After
- `enrich.ts` — job enrichment orchestrator
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
- `resume.ts` — `uploadMasterResumeAction` (5MB cap, MIME-routed extraction: unpdf for PDF, mammoth for DOCX, direct buffer for plain text). After atomic master-switch transaction, triggers matcher in inner try/catch. Returns `{ success, resumeId, matchSummary }`.
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
- `resume/_components/resume-upload-form.tsx` — Native HTML5 drag-drop, accepts PDF + DOCX, 4-state state machine. Pending label: "Parsing and matching jobs…"
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

### Phase 2F — Vercel deploy (~3-4h)

**Only remaining blocker before deploy: v3 enrichment backfill completion** (810 NULL jobs working through cron at ~120/day; expected complete approximately Friday June 5).

Real deploy work:

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
11. **LLM enrichment v3 backfill in progress** — 810 NULL jobs still working through cron at ~120/day, expected complete approximately Friday June 5.
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

---

## 8. CRITICAL FILES (current repo state)

| Concern              | Path                                                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Front door           | `README.md`                                                                                                                                                                                                                                               |
| System map           | `ARCHITECTURE.md`                                                                                                                                                                                                                                         |
| Working rhythm       | `COLLABORATION.md`                                                                                                                                                                                                                                        |
| Build narrative      | `AI_JOB_OS_SESSION_JOURNAL.md`                                                                                                                                                                                                                            |
| Vision               | `VISION.md`                                                                                                                                                                                                                                               |
| Decisions            | `docs/adr/*.md`                                                                                                                                                                                                                                           |
| Design DNA           | `docs/design/principles.md`                                                                                                                                                                                                                               |
| Cron runbook         | `docs/runbooks/cron.md`                                                                                                                                                                                                                                   |
| Design tokens        | `src/styles/tokens.ts`, `src/app/globals.css`                                                                                                                                                                                                             |
| Prisma schema        | `prisma/schema.prisma`                                                                                                                                                                                                                                    |
| SQL triggers         | `prisma/sql/0001_auth_signup_trigger.sql`                                                                                                                                                                                                                 |
| Auth                 | `src/server/actions/auth.ts`, `src/app/login/*`, `src/app/signup/*`, `middleware.ts`                                                                                                                                                                      |
| Preferences action   | `src/server/actions/preferences.ts` (savePreferencesAction with optional redirectTo, triggers matcher synchronously after upsert)                                                                                                                         |
| Profile action       | `src/server/actions/profile.ts` (saveProfileAction with country-aware E.164 normalization)                                                                                                                                                                |
| Resume upload action | `src/server/actions/resume.ts` (MIME-routed extraction: unpdf for PDF, mammoth for DOCX, plain text. Atomic master-switch. Triggers matcher synchronously after switch.)                                                                                  |
| Match actions        | `src/server/actions/match.ts`                                                                                                                                                                                                                             |
| Onboarding helpers   | `src/server/lib/onboarding.ts` (getNextOnboardingStep + canAccessStep — centralized routing rules)                                                                                                                                                        |
| Onboarding welcome   | `src/app/onboarding/welcome/page.tsx`                                                                                                                                                                                                                     |
| Onboarding profile   | `src/app/onboarding/profile/{page,_components/profile-client-form}.tsx` (CountryPicker paired with phone input)                                                                                                                                           |
| Onboarding resume    | `src/app/onboarding/resume/{page,_components/resume-upload-form}.tsx` (PDF + DOCX accept; canAccessStep gate)                                                                                                                                             |
| Onboarding prefs     | `src/app/onboarding/preferences/{page,_components/preferences-client-form}.tsx` (suggestedSkills + suggestedTargetRoles; canAccessStep gate; motion.button replaces SubmitButton)                                                                         |
| AppShell layout      | `src/app/(app)/layout.tsx`                                                                                                                                                                                                                                |
| AppShell components  | `src/app/(app)/_components/{app-shell,user-menu}.tsx`                                                                                                                                                                                                     |
| AuthShell            | `src/components/auth/auth-shell.tsx` (brand + title + children + optional `header` slot for progress indicator)                                                                                                                                           |
| Dashboard route      | `src/app/(app)/dashboard/page.tsx` (uses getNextOnboardingStep helper for routing)                                                                                                                                                                        |
| Dashboard components | `src/app/(app)/dashboard/_components/{match-card,match-list,empty-state,score-ring,score-breakdown}.tsx`                                                                                                                                                  |
| Settings route       | `src/app/(app)/settings/page.tsx` (passes country + suggestedTargetRoles)                                                                                                                                                                                 |
| Settings form        | `src/app/(app)/settings/_components/{preferences-form,personal-info-section}.tsx` (matchSummary state, enriched toast, CountryPicker in PersonalInfoSection)                                                                                              |
| Resume parser        | `src/server/services/ai/parse-resume.ts` (v3 with SKILL_BLOCKLIST + SKILL_CANONICAL code-side cleaning; workHistory.title/company nullable)                                                                                                               |
| Matcher              | `src/server/services/matcher/{score,filters,match,reason}.ts` (match.ts exports computeMatchVersion; content-addressed cache)                                                                                                                             |
| Zod schemas          | `src/shared/schemas/{preferences,profile}.ts` (profile has country-aware E.164 phone transform with longest-prefix-match dial code stripping)                                                                                                             |
| Suggestion data      | `src/shared/data/{role,location,countries}-suggestions.ts` (countries.ts = full ISO 3166-1 list with name + dial)                                                                                                                                         |
| Reusable inputs      | `src/components/onboarding/{chip-input,country-picker,experience-range,job-type-select,preference-toggle,progress}.tsx`                                                                                                                                   |
| Command palette      | `src/components/command-palette.tsx`                                                                                                                                                                                                                      |
| Scrapers             | `src/server/services/scrapers/{greenhouse,ashby,location,hash,rules}.ts`                                                                                                                                                                                  |
| LLM provider         | `src/server/services/ai/{llm,groq-provider}.ts`                                                                                                                                                                                                           |
| Job enrichment       | `src/server/services/ai/enrich.ts`                                                                                                                                                                                                                        |
| CLIs                 | `scripts/{scrape,cleanup,enrich,parse-resume,seed-master-resume,match,top-matches,reasons,show-reasons,show-breakdown,show-parsed-skills,show-prefs,show-bad-match,show-cluster,match-diagnostics,test-enrich-prompt,test-parse-prompt,undismiss-all}.ts` |
| GitHub Actions       | `.github/workflows/{daily-cron,daily-enrich}.yml`                                                                                                                                                                                                         |

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

### Thursday plan

The only remaining priority before deploy is the v3 enrichment backfill. Then Phase 2F (Vercel deploy) becomes the next session's milestone.

**Priorities for next session:**

1. **Verify v3 enrichment backfill progress** (~5 min diagnostic) — Run an ad-hoc Prisma `groupBy({ by: ["enrichmentVersion"] })` to see v2 / v3 / NULL counts. Target: backfill complete by Friday June 5. Today's state: 770 v3, 1 v2, 810 NULL.

2. **Phase 2F — Vercel deploy** (~3-4h) — Once backfill is done:
   - Env var migration to Vercel project settings (DATABASE_URL, DIRECT_URL, all Supabase keys, Sentry DSN, PostHog key, GROQ_API_KEY, Resend keys)
   - Verify Server Actions work on Vercel (they're node runtime by default, should be fine)
   - Check upload limits — 5 MB resume upload + body size on Vercel free tier
   - Set up Supabase auth callback URL for production domain
   - Configure Resend SMTP for production emails
   - Deploy a preview branch first, smoke-test the full onboarding flow + dashboard, then promote to production
   - Update README + CONTEXT with the live URL

3. **Polish items if Phase 2F isn't ready** (~1-2h each, defensive ground):
   - Resume re-upload from /settings (currently read-only there; the action exists, just not wired)
   - Loading skeletons + error boundaries at dashboard polish level
   - Accessibility pass (ARIA, keyboard nav, focus management)
   - Keyboard shortcuts on dashboard (j/k navigation, a/d for apply/dismiss)

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

**Seven specific patterns worth remembering:**

1. **Multi-line Node `-e` scripts have backtick escape problems.** Write `.mjs` scripts to disk instead, then `node /tmp/patch.mjs`. Safer for multi-anchor patches.
2. **Commitlint enforces subject-case lowercase.** "ai-suggested" not "AI-suggested" in commit subjects.
3. **`prisma db push` is the workflow for this project — NEVER `prisma migrate dev`.** migrate dev would offer destructive reset due to existing drift. Always pre-flight DB-touching schema changes with a NULL/integrity check before pressing y.
4. **LLM prompts are extraction tools, not quality filters.** Tuesday's parser fix: two prompt iterations trying to teach the 70b model to filter "noise" caused it to drop 7-8 real skills (numpy, pandas, react, etc.). Real fix: revert prompt to "extract everything verbatim," move filtering to deterministic code (Set + Record lookup). Pattern generalizes: when the LLM is dropping real content, the right answer is often "ask less of the LLM, do more in code."
5. **Timestamp accuracy matters for trust.** When agent guesses wall-clock from message timing and gets it wrong, it creates false urgency. Rule: agent does not state wall-clock; user provides it when needed.
6. **Audit the core product loop yourself, periodically — don't just work through queued features.** The matcher cache bug survived months because nobody ran the system end-to-end as a real user iterating. Section 11 priorities are a queue, not a quality bar. Working through the queue while the central product loop is broken is a real failure mode. Periodic system-level audit ("does the dashboard actually update when I change keywords?") is required, not optional.
7. **When user flags a symptom, don't accept the first fix that occurs. Run it against the bar twice.** Tonight: agent's first proposal was "drop the skip-if-exists logic, always re-score." User pushed back with "rethink twice — is this the real fix per the bar?" Second analysis pass surfaced the actual correctness mechanism (content-addressed matchVersion via input hash) — preserves idempotency, fixes invalidation, self-heals. Lazy fix vs Stripe-grade fix. User pushback forced the second pass and the better outcome.
