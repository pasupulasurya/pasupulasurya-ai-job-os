# AI Job OS — Session Journal

> The full dated build narrative. Every session log lives here, in chronological
> order, verbatim as written at the time. This is the story of how the system
> was built — read it for context, learning, or sharing.
>
> For current state, locked decisions, schema, and what remains, see CONTEXT.md
> (the lean working file pasted at the start of each session). This journal is
> the archive; CONTEXT is the source of truth.
>
> Each entry was written at the close of its session. Where an older entry's
> "next session" note conflicts with a later entry or with CONTEXT, the later
> record wins — earlier notes are preserved as they were, not edited in hindsight.

---

## SESSION LOG — 2026-06-07 (Sunday evening) — Landing page + Phase 2I tracker

> Appended at end of a long session. Read this for the most recent state; it supersedes older "next session" notes where they conflict.

### Shipped to production this session (all LIVE on https://pasupulasurya-ai-job-os.vercel.app)

- **AIML keyword suggestion fix.** Root cause was TWO bugs: (1) `ROLE_SUGGESTIONS` was never wired into the `ChipInput` `suggestions` prop in `preferences-client-form.tsx` — autocomplete was dead for ALL input; (2) `chip-input.tsx` used naive `includes()` substring match, so "AIML" matched nothing. Fix: wired the curated list in + added `matchSuggestions(query, pool)` + `SUGGESTION_ALIASES` map in `role-suggestions.ts` (aliases like aiml/ml/ai/genai → ML Engineer, AI Engineer, etc.). Alias-first, then substring fallback. Mirrors the SKILL_CANONICAL pattern.
- **Cinematic landing page** (replaces the old placeholder `/`). Components in `src/app/_components/`: `hero.tsx` (benefit-led headline "Stop scrolling job boards. Start getting matched."), `product-demo.tsx` (animated dashboard vignette — cards walk through per-hue highlights, confetti on apply; cursor was removed as it wouldn't position correctly), `how-it-works.tsx` (4 Apple-style stage cards Scrape/Enrich/Match/Apply with per-hue glow), `whats-next.tsx` (roadmap "coming soon" cards), `final-cta.tsx` (single "Get started" finale), `ambient-bg.tsx` (page-wide drifting gradient orbs), `landing-nav.tsx` (built then removed per design). DESIGN DECISION: page has NO nav and only ONE "Get started" button, at the very bottom, so visitors scroll the full story first.
- **Application tracker (Phase 2I) + Dismissed page.** See locked decisions below.
- **Production user table cleaned** to just the one real account (usr_98b04a8e..., suryaprakashreddy9908@gmail.com). Six null/test users deleted from both public.User (script) and auth.users (dashboard by hand).

### NEW LOCKED DECISIONS (do not re-discuss)

- **Landing page palette rule (NEW — landing surface only):** The landing page (`/`) is allowed a RICHER palette than the product UI — gradients, multiple hues (semantic tokens + violet #bf5af2), confetti animation. This is DELIBERATE and does NOT loosen the product-UI bar: dashboard/settings/onboarding STAY locked to OLED black + single accent #0A84FF + no emojis. Two surfaces, two rules. Reason: restraint signals quality in the app; vibrancy pulls on marketing (Apple does the same split). Confetti is allowed on the landing demo; emojis still are not.
- **Application status model:** Stored on the `Application` table's `status` String. Five states in order: `applied → under_consideration → interview → offer → rejected`. Constants live in `src/shared/data/application-status.ts` (APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, isApplicationStatus). The apply flow now CREATES an Application row: `markMatchAppliedAction` in `match.ts` both flips UserJobMatch.status AND creates an idempotent Application row (skips if user already has one for that job). `updateApplicationStatusAction` in new `src/server/actions/application.ts` moves between states (powers "reconsider a mistaken rejection"). Page: `/applications`, list grouped by status with a per-row status dropdown.
- **Dismissed page (`/dismissed`):** Its own route + sidebar nav item (Archive icon). Reads dismissed UserJobMatch rows (dismissed:true) showing match score + job + an Undismiss button. `undismissMatchAction` in `match.ts` reverses a dismiss (status:fresh, dismissed:false, clears dismissedAt/autoDismissed) — brings the job back to dashboard matches. Purpose: analysis surface for "scored high but dismissed — why?". Kept SEPARATE from the applications tracker (dismiss = not-interested pre-apply; rejected = applied-and-failed).

### NEW KNOWN ISSUES

- **Email signup blocked by rate limit (THE friend-blocker).** Supabase built-in email pool caps ~3-4 emails/hour. Real production signup-by-email is effectively untestable when the limit is hit, and won't scale past a tiny beta. NOT a code bug. The localhost-link bug IS fixed (emailRedirectTo now uses the correct Vercel NEXT_PUBLIC_SITE_URL — set in Vercel env). Resolving this needs the deferred Resend + domain decision ($15/yr), or staying on the pool for a handful of friends.
- **Service-role key invalid.** `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` is a well-formed but INVALID `sb_secret_` key — every admin API call returns 401 "Invalid API key" (verified via scripts/probe-admin.ts). App's normal flow works (uses anon key). Admin scripts (create user, etc.) are broken until a CURRENT secret key is pulled from Supabase dashboard → Settings → API Keys. NOTE: diagnosis showed the SDK (@supabase/supabase-js 2.106.1) is NOT the problem — sb*secret* keys are supported; the key value itself is stale/wrong. Do NOT upgrade the SDK to "fix" this.
- **Dashboard greeting uses UTC date.** Shows "Monday June 8" on a Sunday evening in US Central because date is computed server-side in UTC. Cosmetic; fix by computing in the user's timezone.
- **37 matches on stale matcher-v1 version.** Of the real account's 45 matches, 37 carry the old static `matcher-v1` (pre content-addressing), 8 carry hashed versions. They display fine but reflect older scoring. A fresh `matchJobsForUser` run would re-score all to the current version.

### NEW DEV SCRIPTS ADDED (scripts/)

- `check-email.ts <email>` — is an email FREE or EXISTS in User table
- `list-users.ts` — all users (id, email, firstName)
- `audit-users.ts` — per-user counts (prefs/resumes/matches/apps)
- `delete-test-users.ts` — cascade-deletes a hardcoded list of test user ids (children first, then User), with a safety check excluding the real account
- `match-status.ts` — status + matchVersion breakdown for the real account
- `probe-admin.ts` — tests the admin API key (prints key prefix/length + admin.listUsers result)

### NEXT-SESSION PLAN (priority order)

1. **Email/domain decision — THE gate to inviting friends.** Either: buy a domain (~$15/yr), verify in Resend, switch Supabase Auth back to Custom SMTP; OR accept the built-in pool for a tiny (<10) friend beta. User deferred the domain purchase twice — do not re-pitch; present the two paths and let user choose.
2. **Finish `resolveSiteUrl` hardening.** Currently in `git stash` (message "wip: resolveSiteUrl hardening"). It hardens `auth.ts` to fail loudly if the site URL is localhost in prod. BUG IN THE STASHED VERSION: it guards on `NODE_ENV === "production"`, which throws on local `npm run build` too. FIX: guard on `process.env.VERCEL_ENV === "production"` instead, so only real Vercel prod deploys throw. Pop stash, apply that change, build, ship.
3. **Branch cleanup.** `chore/upgrade-supabase-sdk` branch is unused (we diagnosed instead of upgrading) — delete it. The git stash needs popping (item 2) or dropping. Landing + tracker are merged to main.
4. **Optional polish:** re-score the 37 stale matches (run the matcher); fix the UTC date greeting; pull a fresh service-role key if admin scripts are needed.

### SESSION META

- All work done on branches with preview deploys, merged to main via squash PR (landing = PR #1, tracker = PR #2). This is the established workflow now: branch → push → preview → PR → squash-merge → prod. Production never touched directly.
- Lesson reinforced: run `npm run build` (not just `tsc --noEmit`) before every push — tsc missed a missing-module that the Turbopack build caught.
- Heredoc caution: multi-line JSX `<a>` tags got mangled by `cat << EOF` pastes twice. For JSX edits prefer Node patch scripts; keep anchor/link tags single-line.

---

## PHASE 2G DESIGN NOTES — Resume generation (worked out 2026-06-07, not yet built)

> This is THE core value of the product — the reason matching/scoring exists. Captured from a design conversation; build is a future multi-session effort (~25-35h). Read this before starting 2G.

### The core problem

A world-class resume must satisfy two opposed readers at once: the ATS parser (wants exact keyword matches, simple parseable structure, standard headers — dumb and literal) and the human recruiter (wants story, impact, specificity — skims in ~6s). Most tools do one badly. 2G must thread both.

### The structural advantage (the unlock)

Unlike generic resume tools that start from "paste the job description," WE ALREADY HAVE THE MATCH DATA. The matcher's 6-dimension breakdown tells us exactly which skills matched, where the gaps are, what the job wants. So generation is not "rewrite for this job" — it's "given we scored X on skills / Y on experience, surface the true evidence that closes those specific gaps." The match breakdown IS the tailoring blueprint.

### The 6-step flow (designed)

1. User picks a match → sees a GAP ANALYSIS (matched skills vs missing skills, derived from the 6-dimension breakdown).
2. User can CONFIRM-AND-ADD a truly-held skill that wasn't in their master resume — behind a "confirm this is true" guard.
3. System GENERATES the tailored resume: reorder / reweight / rephrase the master resume to maximize HONEST overlap, woven with evidence. Never fabricates (locked non-fabrication decision).
4. PREVIEW PAGE — user reads the full resume before doing anything.
5. DOWNLOAD as an ATS-safe single-column PDF.
6. (LATER, Phase 2H) the page auto-applies (Playwright auto-fill).

### Two key design insights (the "why" behind the decisions)

- **The confirm-guard IS a quality mechanism, not just ethics.** When the user adds a skill back, don't let it be a bare keyword — require a sentence of real evidence ("where did you use GraphQL?"). A bare keyword is weak (ATS sees it, human doesn't believe it); a skill demonstrated in a bullet is strong for BOTH readers. So the truthfulness guard and the resume quality are the same lever. Also: confirmed-added skills should flow BACK into the master resume so gap-closing compounds across jobs.
- **"ATS-safe" means restraint, the same principle as the product UI.** A world-class ATS PDF is nearly the opposite of a designer's PDF. Hard rules: single column (multi-column scrambles parse order), real text not images, standard section headers ("Experience"/"Skills"/"Education"), simple fonts, no layout tables, left-aligned. It can still look clean (typography, whitespace, hierarchy) — it just can't be clever. Flawlessly parseable first, handsome second.

### Build-time technical flags (for when 2G starts)

- Gap analysis reads from the existing matcher 6-dimension breakdown — no new scoring needed, just surface what's already computed.
- PDF generation server-side: clean single-column HTML→PDF template, or a text-positioning library. Will touch the existing signed-URL upload infra + Vercel 4.5MB body limit (see 2E/2F notes).
- Confirm-and-add must write back to the master resume (UserPreference / ResumeVersion area) — design the write-back path so it's not a per-job re-entry.
- Output format decision LOCKED: ATS-safe single-column PDF (not a pretty multi-column PDF).

---

## SESSION LOG — 2026-06-09 (Monday) — Auth email flow + resume parse resilience + UTC date

> Appended at end of a long session. Read this for the most recent state; it supersedes older "next session" notes where they conflict. Three production bugs fixed end-to-end, all verified on https://pasupulasurya-ai-job-os.vercel.app. Context note: this session resumed from a fresh chat after older chats were deleted — the four-file bundle (README/ARCHITECTURE/CONTEXT/COLLABORATION) carried the project state successfully, which is the whole point of the resumption bundle.

### Shipped to production this session (all LIVE, all verified)

- **Magic-link / email-confirmation login fixed (commit 99822de).** Root cause: the email links used the PKCE `code` flow — `signInWithOtp`/`signUp` send a link, `/auth/callback` called `exchangeCodeForSession(code)`, which REQUIRES the PKCE code-verifier cookie set in the SAME browser that requested the link. On mobile (iPhone), tapping a link in Mail opens it in a different browser context than the one holding the verifier cookie, so the exchange failed every time and bounced to `/auth/auth-code-error`. The user-facing symptom was "link expired in one hour" — misleading; the token was valid (Supabase `/verify` returned 303 success), the failure was downstream in `exchangeCodeForSession`. Diagnosis confirmed by the redirect trail in Vercel logs (`/verify` 303 -> `/auth/callback` -> `/auth/auth-code-error` -> `/login`).
  - **Fix:** moved email links off the PKCE `code` flow onto the `token_hash` + `verifyOtp` flow, which carries the token in the link itself and needs NO verifier cookie — immune to the cross-browser/mobile problem. This is Supabase's current recommended Next.js SSR pattern for email links.
  - **Callback change (`src/app/auth/callback/route.ts`):** now detects `token_hash` + `type` and calls `supabase.auth.verifyOtp({ type, token_hash })`. Keeps the old `code` + `exchangeCodeForSession` path as a fallback (harmless, useful for future OAuth). All existing onboarding-routing logic (fresh-user -> /onboarding/welcome, getNextOnboardingStep, explicit ?next) preserved unchanged below a shared user-extraction.
  - **Verified:** fresh magic link clicked on iPhone now lands on /dashboard (existing onboarded user), no error-page bounce.

- **Email templates customized + repointed to `token_hash` (Supabase dashboard, not in repo).** Both "Confirm signup" and "Magic Link" templates rewritten as bulletproof table-based inline-styled HTML — text-based wordmark "AI Job OS" + tagline "AI that works for the candidate", `#0A84FF` accent button only, fuller welcome copy on confirm (3 value points + "what happens next" + footer). DESIGN NOTE: email is a DIFFERENT bar than the product UI — email clients strip `<script>`, block WebGL/canvas (no 3D/animation possible), block images by default, ignore modern CSS. Bulletproof HTML and text-based brand (never image-based) is the craft. Each button href is `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email` (confirm) / `&type=magiclink` (magic link) — so the design change and the working-link fix are the same artifact.

- **Resume upload fixed + made resilient (commit 024a2fb).** The break: every resume upload failed at the Groq parse step with banner "Couldn't parse the resume." DIAGNOSIS ARC (with two corrections worth recording):
  - First (wrong) hypothesis was a missing `GROQ_API_KEY` in Vercel. Misread Vercel's "No history is available for this environment variable" as "variable absent" — it actually means no VERSION history (never edited). The key IS present, scoped Production + Preview. Corrected by reading the env-vars screen directly. (Same misread-class as a Drift #3 phantom-chase; caught and reversed.)
  - Real cause, from the Vercel log (`ai.resume.parse.validation_failed` / `resume.upload.parse_failed`): an `LLMValidationError` — the 70B model returned education `startYear`/`endYear` as STRINGS ("2021") but `ResumeParseSchema` declared them `z.number()`. Zod rejected all four (2 schools x start+end), the parse threw, the whole resume was discarded even though name/email/skills/workHistory all parsed correctly. Deterministic, every upload, both PDF and DOCX (ruling out extraction).
  - **Fix (per-field tolerance, in `parse-resume.ts`):** added `yearField` = `z.preprocess` coercing numeric-string -> number, non-numeric -> null; `softStr()` helper = `z.string().nullable().catch(null)`; applied `.catch()` degradation to every field/sub-object (education, workHistory, skills, links all degrade to `[]`/null instead of throwing). Matches the existing `z.preprocess` pattern already used on the enrichment `skills` field. No single field can hard-fail the parse anymore.
  - **Fix (parse floor, in `resume.ts`):** `parseResume` failure no longer returns an error banner — it logs `resume.upload.parse_failed_degraded` and proceeds with `parsed = null`. The transaction writes `parsedJson: parsed ?? undefined`, `parsedAt`/`parseVersion` null when not parsed (honest). Onboarding is never hard-blocked by an LLM hiccup. The existing empty-file gate (`rawText.trim().length < 100` -> "Resume looks empty or unreadable") is UNCHANGED — a truly blank/unreadable file still correctly blocks.
  - **Verified:** the exact resume that was failing now uploads end-to-end and continues to preferences.
  - **BEHAVIOR-CHANGE TRADEOFF (user chose this deliberately — "full resilience"):** a degraded parse now lets the user through with empty `parsedJson`, so matcher + suggested-skills chips get nothing until re-upload. Logged via `resume.upload.parse_failed_degraded`. FUTURE FOLLOW-UP: a soft "we couldn't read part of your resume, re-upload anytime" nudge when parsedJson is empty/thin.

- **Dashboard UTC-date greeting fixed (`greeting-date.tsx`).** Was showing "Tuesday June 9" on a Monday evening Central because the date was computed server-side with `new Date().toLocaleDateString(...)` and the server runs in UTC. Resolves the known issue in the 2026-06-07 evening log + NEXT-SESSION item 4.
  - **Fix:** extracted the date into a client component `src/app/(app)/dashboard/_components/greeting-date.tsx` using `useSyncExternalStore` (getServerSnapshot = nbsp placeholder for hydration safety, getSnapshot = real local date). Renders in the VIEWER'S timezone — correct for the user and every friend wherever they are. `page.tsx` server-side date calc removed, component wired in.
  - **WHY `useSyncExternalStore` and not `useEffect`+`setState`:** the repo's eslint config enforces `react-hooks/set-state-in-effect` (bans SYNCHRONOUS setState in an effect body). Two attempts using `useEffect(() => setState(...))` were correctly rejected by the pre-commit hook. `useSyncExternalStore` has no effect/no setState, so nothing for that rule to catch — and it's the correct primitive for hydration-safe client/server divergence. Lesson reinforced: read the repo's existing client-component patterns (e.g. `score-ring.tsx` uses setState inside a subscription CALLBACK, which is allowed) before writing; verify with `tsc` AND `eslint` before commit, not just `tsc`.

### NEW LESSON / cross-cutting principle (worth a future locked decision)

- **Server runs in UTC — anything user-facing that involves "now"/"today" MUST be computed client-side or explicitly timezone-adjusted, never from server `new Date()`.** THREE separate symptoms this session traced to this single root: the "expired link" framing (UTC made the slow-link story plausible early), the dashboard date, and the recurring confusion reading Vercel/Supabase logs (timestamps shown in UTC vs Central). Pre-empting this everywhere would have saved real time.

### Bugs SEEN this session (full list, including the ones that turned out not to be bugs)

1. **Magic link "expired" (REAL, FIXED):** PKCE verifier-cookie loss on cross-browser mobile open. -> token_hash + verifyOtp.
2. **Resume parse failure (REAL, FIXED):** Zod rejecting year-as-string from the LLM. -> preprocess coercion + per-field `.catch()` + parse floor.
3. **Dashboard date off by a day (REAL, FIXED):** server-UTC date. -> client-side `useSyncExternalStore`.
4. **`GROQ_API_KEY` "missing" (NOT a bug):** misread Vercel "no version history" as "absent." Key is present. No action.
5. **`list-users.ts` `ECONNREFUSED` (ENVIRONMENT, not code):** local script can't reach the DB — likely the documented Supabase shared-pooler maintenance window and/or a `.env.local` `DATABASE_URL` pointing at the down pooler. Did NOT investigate further (user is production-only now).
6. **eslint `set-state-in-effect` rejections (TOOLING, expected):** two greeting-date attempts blocked by the pre-commit hook before reaching prod. Working as designed — the hook held the bar.

### STILL OPEN / carried forward (NOT done this session)

- **Test-user cleanup — NOT DONE.** User created a throwaway account ("just for testing") and wanted it removed. Could not run `delete-test-users.ts`: (a) its hardcoded TARGETS list doesn't include the new test user's id, and (b) local DB connection was refused (`ECONNREFUSED`, see bug #5). PATH FORWARD: do it via the Supabase dashboard / SQL Editor (runs server-side, immune to the local-connection issue) — delete the `public.User` rows in dependency order (UserJobMatch -> Application -> ResumeVersion -> UserBlockedCompany -> UserPreference -> User), then delete the matching `auth.users` row BY HAND in Authentication -> Users (the prod service-role key is invalid per existing known issue, so admin-API deletion won't work). Need the test user's email/id first (find newest in Auth -> Users).
- **Bug A (fresh-signup routing, from Section 13) — STATUS NOW UNCERTAIN, NEEDS VERIFICATION.** Today's `/auth/callback` rewrite (token_hash + verifyOtp) touches the EXACT code path Bug A lives on, and the callback's fresh-user routing (firstName=NULL -> /onboarding/welcome) was preserved. Bug A may now be resolved as a side effect — but it was NOT verified end-to-end with a fresh signup this session (email rate-limit + production-only testing made a clean fresh-user run impractical). VERIFY NEXT: fresh incognito signup -> fresh email (not cached) -> confirm lands on /onboarding/welcome, not /onboarding/preferences.
- **Bug B (target-roles autocomplete, from Section 13) — LIKELY ALREADY FIXED.** The 2026-06-07 evening log's "AIML keyword suggestion fix" wired `ROLE_SUGGESTIONS` into ChipInput + added `matchSuggestions`/`SUGGESTION_ALIASES`. That is almost certainly the same root cause as Bug B. Treat Bug B as probably-resolved pending a quick confirm.
- **Email/domain decision — UNCHANGED, still THE gate to inviting friends.** Built-in pool ~3-4 emails/hour. Two paths unchanged: buy domain (~$15/yr) + verify in Resend + Custom SMTP, OR stay on pool for <10 friends. User has deferred the purchase multiple times — present both paths, do not re-pitch.
- **`resolveSiteUrl` hardening — still in `git stash`** (from 2026-06-07 evening NEXT-SESSION item 2). Known bug in the stashed version: guards on `NODE_ENV === "production"` (throws on local build too); fix is guard on `VERCEL_ENV === "production"`.
- **Branch/stash cleanup** (`chore/upgrade-supabase-sdk` unused branch; stash needs popping or dropping) — carried forward.
- **37 stale matcher-v1 matches** on the real account — carried forward, cosmetic.

### SESSION META / process notes

- Workflow held: command-line edits (Node patch scripts with PATTERN-NOT-FOUND guards + `cat >`/`cat >>`), `tsc` (and `eslint` where the hook demands it) before every push, push to main, verify deploy Ready in Vercel before testing on production. User does NOT do manual file edits or PRs — everything goes through edit-command -> push.
- Drift caught by user this session: agent ran a guess-and-check loop on the greeting-date component (shipped a lint-failing version twice) — user invoked the "no trial and error, read the files first" rule. Correct response was to read the repo's own client-component pattern (`score-ring.tsx`) and verify against `eslint` before proposing, not to keep retrying. Two `cat >` heredocs also silently failed to land mid-session — lesson: confirm a write actually landed (`sed -n`/`grep`) before verifying against it.
- Heredoc caution (reaffirmed from prior log): multi-line content with backticks/template-literals in `node -e` is fragile; prefer guarded patch scripts and confirm the write landed.

## SESSION LOG — 2026-06-09 (evening) — Settings redesign + Phase 2G design locked

> Appended at end of session. Read this for the most recent state; supersedes
> older "next session" notes where they conflict.

### Shipped to feat/settings-redesign (preview verified, PR open)

- **Settings page redesigned.** Was a single centered max-w-2xl column with
  every section stacked at the same width — read as one long form. Now uses
  max-w-6xl container with a label-left / content-right grid via new
  `SettingsSection` primitive (md:col-span-3 for label, md:col-span-9 for
  content card). Account header full-width at top, Sign out as a quiet row
  at the bottom. Mobile stacks back to single-column. Closes known issue
  "settings page looks odd / centered form."
- **Resume management surface added.** Was a read-only card showing only the
  master with a disabled "Upload UI coming soon" button. Now lists ALL the
  user's ResumeVersion rows (orderBy createdAt desc), master clearly marked
  with an accent badge, non-master rows have a "Make master" button. Upload
  card sits above the list using the proven 3-step signed URL flow
  (requestResumeUploadUrlAction → direct PUT to Supabase Storage →
  uploadMasterResumeAction). Auto-resets idle ~1.5s after success and calls
  router.refresh() so new master appears at top of list. Closes known issues
  "settings resume card is read-only" and "master-resume-not-switchable
  (schema supported, UI never exposed)."
- **New Server Action `setMasterResumeAction(resumeId)`** appended to
  src/server/actions/resume.ts. Mirrors uploadMasterResumeAction's
  master-switch transaction (find current master → unset → set target) and
  matcher-trigger pattern (force:true, inner try/catch, match summary
  returned). Used by the Make-master button on the new resume list.
  Non-destructive: previous master row stays with isMaster=false to preserve
  provenance for tailored resumes (Phase 2G).
- **PersonalInfoSection duplicate header stripped.** SettingsSection now
  owns the "Personal info" label, so the inner h2 was removed; Edit button
  floats top-right of the card.

### NEW LOCKED DECISIONS (do not re-discuss)

- **Settings container width: max-w-6xl** with md:col-span-3/9 grid inside
  SettingsSection. Wider was tempting (looks more "spread") but breaks
  reading lines on Preferences. This is the chosen compromise.
- **Settings = upload + see all + pick master.** Generate/tailor stays on
  the dashboard match flow because it needs job context. Generate has no
  meaning without a match.
- **Master-switch is non-destructive** (already true via existing
  upload action, now re-confirmed for setMasterResumeAction). Tailored
  resumes will reference masterResumeId in 2G and must keep pointing at
  the master they were derived from even after a switch.
- **No resume delete yet.** ResumeVersion is referenced by Application
  (audit history) and will be referenced by TailoredResume (Phase 2G).
  Proper delete requires soft-delete via a deletedAt column + filter
  propagation everywhere ResumeVersion is queried, plus product-policy
  on what happens when you delete a resume an Application points at.
  Captured as future follow-up; visibility of all resumes in the list
  covers most of what the user wanted.
- **No upload cap.** Storage nets to zero per upload (file deleted after
  processing); ResumeVersion rows in Postgres are effectively unbounded
  for friend-scale beta. Arbitrary numeric limits without a reason fail
  the bar.

### KNOWN ISSUES STILL CARRIED FORWARD

(unchanged from earlier in the file, restated so the next thread doesn't
miss them in the noise)

- Email/domain decision — built-in Supabase pool ~3-4 emails/hr caps the
  beta at <10 friends. Two paths: buy domain (~$15/yr) + Resend Custom
  SMTP, or stay on pool. User has deferred multiple times.
- resolveSiteUrl hardening still in git stash (VERCEL_ENV vs NODE_ENV bug).
- 37 stale matcher-v1 matches on the real account, cosmetic.
- Test-user cleanup pending (do via Supabase dashboard / SQL editor).

### PHASE 2G — LOCKED DESIGN (full plan, ready to build)

> Worked out in detail in the design conversation 2026-06-09. This section
> captures everything we settled so a fresh thread can resume building
> without re-derivation.

**Why 2G exists:** the heart of the product. Matcher/scoring/dashboard
exists to feed _this_. Generic resume tools tailor cold ("paste the job
description"); this product already has the matcher's 6-dimension
breakdown for every (user, job) pair, so generation isn't "rewrite for
this job" — it's "surface the true evidence that closes these specific
gaps." The match breakdown IS the tailoring blueprint.

**Bar specific to 2G:** the integrity guarantee is the product. A
gorgeous resume that quietly adds a skill the user doesn't have isn't
95%-perfect — it's a total failure. Verification catching fabrication is
the hard problem; generation is the easy 80%. Stated bar: 100% catch on
fabricated skills (architectural — structurally impossible), >95% catch
on fabricated bullets (verification pass).

**Build order:** 2G.0 Cerebras provider → 2G.1 table + engine + harness
→ 2G.2 UI → 2G.3 PDF render → 2G.4 (optional) DOCX render.

**Data model — `TailoredResume` table** (not overloading ResumeVersion):

- Keyed on matchId (one tailored resume per match).
- Stores tailored content + change ledger (per-change provenance) +
  verification result + status (`generated` | `verified` | `saved`).
- Master stays in ResumeVersion as locked truth. References master via
  masterResumeId so non-destructive master-switching preserves provenance.

**The change ledger is load-bearing.** Each AI-produced change carries:
which skill it closes, the user's evidence sentence (truth source), the
move (new vs augment), target role/bullet, before-text (null for new),
after-text, parent trace (master bullet id for augment, evidence
sentence for new). The ledger is what makes (a) verification work,
(b) per-change revert work, (c) write-back-to-master work.

**Generation engine — decomposed, not monolithic.** Three distinct LLM
jobs, nothing else:

1. **Summary rewrite** — master summary → tailored summary in job's
   vocabulary, every claim tracing to master.
2. **Bullet rephrase** — 1:1, one master bullet in, one tailored bullet
   out, carrying parent link.
3. **Gap-closing generation** — evidence sentence → AI classifies
   new-bullet vs augment-existing (AI proposes, user accepts/reverts) →
   generates the line.

Everything else (which skills surface, which bullets keep, ordering,
single-page constraint) is **code, not LLM** — driven by the matcher's
6-dimension breakdown.

**No free-text editing.** User supplies _truth_ (via evidence sentences),
AI supplies _prose_. Two user actions only: structural curation
(reorder/select/revert/drop) and gap-closing. Free typing would orphan
changes from the ledger and break verification.

**Write-back to master fires at confirm-time** (not Save). When user
confirms a gap skill is true, it flows immediately into ResumeVersion's
parsedJson skills. Independent of whether they keep this tailored
version. UI must acknowledge the master change gently (never silently).

**Verification architecture — by construction first, check second.**
Only two ops can produce a bullet (rephrase or generate-from-evidence),
each carrying its source link. An orphan bullet _cannot exist_ —
fabricated bullets are structurally impossible. Fabricated skills are a
set-membership check (every tailored skill must be in master.skills or
confirmed-added). The residual job is a **per-bullet claim-drift check**:
one tailored bullet vs its single parent, flagging any claim (number,
scope, technology, outcome) not in the parent. Decision: **both layered**
— code heuristics for cheap numeric/entity catches + LLM-as-verifier on
the narrow parent-child pair for semantic drift. Defense in depth, same
belt-and-suspenders pattern as Zod-preprocess + sanitize.

**Generation timing: on-demand, not pre-generated.** User clicks "Tailor
for this job" on a match → batched calls run → side-by-side appears in
~few seconds → user curates/closes gaps → Save. Then `tailoredJson` is
persisted, reopening that match is instant. Pre-generating for every
match would burn through Cerebras's 1M TPD on resumes nobody opens.

**Batching: per-role, not per-bullet.** One LLM call sends all of a
role's bullets together and returns a structured array, each item tagged
with parent master-bullet index. A 4-role resume is ~4 generation calls,
not 40. Provenance survives batching because each returned item carries
its parent link. Same pattern as the existing reason generator.

**Model routing (2026-06-09 web-search-verified free tiers):**

- **Cerebras for tailoring generation** — Llama 3.1 70B on the 1M
  tokens/day free tier (most generous daily volume of any free
  inference provider, no credit card). This is where the volume goes.
- **Cerebras DeepSeek R1 Distill for the LLM verifier layer** —
  reasoning model on the same free tier, purpose-fit for "does this
  child bullet claim anything its parent doesn't." Candidate to A/B
  on the harness against running verifier on the same 70B.
- **Groq stays on enrichment + parsing + reasons** — its 100K TPD on
  llama-3.3-70b-versatile undisturbed by tailoring volume.
- Provider-agnostic LLMProvider interface absorbs both. Per-call
  `model` override already supported in codebase. If any free tier
  changes, swap is one new provider file.

**UI — `/dashboard/tailor/[matchId]`:**

- Entry point: "Tailor for this job" button on each dashboard match card.
- Context header (top, full-width): job title + company + score ring
  (reuse existing score-ring.tsx) + status line (generated → verified →
  saved).
- First load triggers generation, uses empty-state pattern (rotating
  progress phrases under spring motion).
- Two side-by-side panes: master (read-only, visually recessed, locked
  truth) | tailored (working copy, changes highlighted with #0A84FF
  left-edge accent).
- Right pane is NOT a text editor — no cursor, no freeform typing. Every
  line is a rendered AI-authored artifact the user curates.
- Gap analysis panel: per missing skill, prompt "You used X? If yes,
  where?" with a short evidence input. User submits → AI classifies new
  vs augment → result appears highlighted in right pane → user accepts
  or reverts.
- Curation controls on right pane: reorder skills, select which bullets
  appear per role, accept/revert per AI rewrite, drop a section. All
  structural — drag handles, toggles, per-line revert. Never a text
  field.
- Bottom action bar: Save (writes tailoredJson + ledger + verification
  result) + Download (renders ATS-safe single-column PDF from
  tailoredJson on demand, never stored). Same render path serves
  Playwright auto-fill in 2H.
- Master pane visibly updates mid-session when confirm-and-add fires —
  page must acknowledge the master change gently, never silently.
- Mobile: side-by-side collapses to Master/Tailored tabs below `md`.

**PDF format locked: ATS-safe single-column.** Single column (multi-
column scrambles parser order), real text (not images), standard
section headers ("Experience"/"Skills"/"Education"), simple fonts, no
layout tables, left-aligned. Restraint over cleverness — flawlessly
parseable first, handsome second. Different bar than the product UI but
same principle (restraint signals quality).

**Harness — separate from the main flow, mandatory before any live
rollout.** Pattern follows existing scripts/test-enrich-prompt.ts and
scripts/test-parse-prompt.ts. Pulls real (master, job) pairs from DB,
runs generation, runs verification pass, no DB writes, prints result.
Includes ADVERSARIAL fixtures — a job demanding a skill the user
clearly lacks — and asserts verification CATCHES the fabrication.
Measures call count and token usage per resume so we know a full
tailoring run fits the free-tier budget before going live.

**Forbidden transformations (verification must catch all):**

- Add a skill not in master.parsedJson.skills (or confirmed-added set)
- Add a bullet that doesn't trace to a master bullet or evidence sentence
- Change any company / title / dates
- Change education details
- Claim experience master doesn't claim

**Allowed transformations:**

- Reorder skills / bullets
- Rewrite summary using job terminology (every claim traces to master)
- Rewrite bullet text in job's vocabulary (underlying fact must exist
  in master)
- Choose which 6–10 bullets to include per role (single-page constraint)
- Truncate work history if too long

**Two-masters question — DEFERRED.** User raised it ("I have two
identities — data science and AI/ML — and I'm good at both"). Picked
**one master, job drives everything** for now. The matcher's 6-dimension
breakdown will naturally surface data-science truth for DS jobs and
ML truth for ML jobs from the same master. If the master becomes
genuinely too-blended to serve either well, revisit with two-master
support (uses existing isMaster boolean + a "switch active master"
control in settings, both of which now exist as of this branch).

### WORKFLOW LOCKED FOR 2G (and going forward)

- Branch → push → preview → PR → squash-merge → prod. Production never
  touched directly.
- Pre-push gate: `tsc --noEmit` + `npm run build` (Turbopack, mandatory,
  not optional — tsc misses what build catches) + `eslint` (husky hook
  enforces this on commit).
- Pre-commit gate also enforced by husky: commitlint (body lines ≤100
  chars, conventional format). Multi-line commit messages: write to
  /tmp/commit-msg.txt and use `git commit -F`.
- 2G.0 next: feat/2g0-cerebras-provider. Self-contained, no schema
  changes, follows Groq reference pattern. Then 2G.1 introduces the
  TailoredResume table + engine + harness on its own branch.

### LESSONS FROM 2026-06-09 SETTINGS SESSION

Three drift catches by the user during the branch work, all named so
they don't repeat in 2G:

1. **Heredoc + shell escaping is fragile for multi-line content with
   `<`/`>`/`'`.** New files via `cat > "EOF"` (quoted tag) — fine.
   Edits to existing files via Node patch scripts written to disk:
   `cat > /tmp/patch.mjs << 'EOF' ... EOF && node /tmp/patch.mjs`.
   Never inline `node -e` for multi-line anchors.
2. **`&&` chains hide failing checks.** `grep -c "foo" file && tsc`
   exits with grep's code when match count is 0, masking what's
   actually broken. Use `;` for verification chains, with explicit
   echo labels.
3. **eslint + build are part of the chunk loop, not just the push gate.**
   Run `npx eslint <touched files>` and `npm run build` at every
   natural seam (each major component shipped, each file boundary
   closed). Catching pre-commit-hook failures during the chunk where
   the mistake was made is cheaper than catching them at push time
   with stash-restore friction.

## SESSION LOG — 2026-06-09/10 (late evening) — 2G.0 + 2G.1 SHIPPED

> Most recent state; supersedes older notes where they conflict.

### Shipped to main earlier this session

- **2G.0 Cerebras provider (merged, PR #4-equivalent).** CerebrasProvider
  implements LLMProvider. Free tier verified via curl: 5 req/min, 150/hr,
  2400/day; 30K tok/min, 1M/hr, 1M/day. Models on tier: gpt-oss-120b
  (default), zai-glm-4.7 — BOTH reasoning models (chain-of-thought
  consumes tokens before output; default maxTokens 2048 vs Groq's 512).
  Llama models NOT on current Cerebras free tier despite older docs.
- **RLS enabled on all 9 public tables + TailoredResume** (Supabase
  security advisor was flagging rls_disabled_in_public on everything;
  app unaffected — all DB access via Prisma/service role; zero
  supabase.from() in app code).
- **Duplicate `.env.local ` file (trailing space) deleted.**

### Shipped to feat/2g1-tailoring-engine (pushed, PR pending)

- **TailoredResume schema** — keyed unique on matchId (idempotent
  re-use = locked decision; re-tailoring resumes the draft). FKs:
  userId (Cascade), matchId (Cascade), masterResumeId (Restrict),
  jobId (Restrict). Json fields: tailoredJson, changeLedger,
  verificationResult. status: generated|verified|saved.
  generationVersion current: cerebras-gpt-oss-120b-tailor-v2.
- **tailor.ts engine.** tailorResumeForMatch: idempotency check ->
  load master+match+job -> derive matched/gap skills (code set-diff,
  not LLM) -> summary rewrite -> per-role BATCHED bullet rephrase ->
  verify->retry->fallback per item -> assemble -> persist. Education +
  personal info copied verbatim, never sent to LLM. Skills ordering is
  code (matched-first), not LLM.
- **verify.ts two-layer verification.** Layer 1 code drift check
  (invented numbers + DRIFT_TERM_PATTERNS domain qualifiers) — free,
  per-item, fails fast. Layer 2 LLM verifier. BATCHED per role
  (verifyBulletsBatch: one call per role, per-index verdicts, strict
  length validation, silent-skip = hard error). Summary verified
  against FULL master corpus (summary+skills+all bullets) — surfacing
  unstated-but-true content from workHistory is legitimate;
  job-domain language absent from master is fabrication, including
  aspirational framing ("aim to apply to safety-focused...").
- **Retry-then-fallback quality model (locked):** flagged item gets
  ONE retry with violations fed back; fallback to master verbatim is
  the worst-worst case (target <5%); gap-closing has NO fallback —
  hard error tells the user to rephrase evidence.
- **generateBulletFromEvidence.** Evidence = truth source. AI
  classifies new_bullet vs augment_bullet (AI proposes — locked).
  Structural validation of indices. Verified against evidence.
  Write-back of confirmed skill to master parsedJson at CONFIRM-TIME
  (locked). Ledger entry with full provenance.
- **Harness 7/7 (test-tailor-harness.ts, zero DB writes).** Full-loop
  adversarial tests: fintech-bait rephrase stayed clean; thin evidence
  ("I know Spark") correctly REFUSED rather than inflated; rich
  evidence converged on retry (verifier corrected "entire year" ->
  "approximately one year").

### Proven on real data (smoke tests)

- v1 prompts inserted "safety" domain terms into BYJU'S bullets for an
  OpenAI Safety job — exactly the fabrication failure mode. v2
  integrity rules + verifier eliminated it. Verifier also caught
  "Streamlined" vs master's "Helped streamline" (strength inflation)
  and retry corrected it.
- Batching cut runtime 184s -> 63s per resume (~6 requests; Cerebras
  5 req/min is the binding constraint, near request-count floor).

### NEW LOCKED DECISIONS

- Tailoring generation model: cerebras gpt-oss-120b (only viable
  instruction model on tier; reasoning overhead accepted, maxTokens
  2048 default).
- Verification batched per role; summary verified against full master
  corpus; aspirational domain claims = fabrication.
- Thin-evidence refusal is correct UX: loop errors with "rephrase
  your evidence with more specifics" rather than emit weak/inflated
  bullets.

### KNOWN FOLLOW-UPS (filed, not blockers)

- tokensUsed always null — provider doesn't surface usage; needs
  LLMProvider interface change (ripples to Groq). tokensUsed measured
  manually via harness for now.
- Skill write-back doesn't bump matchVersion hash — match scores
  don't refresh until another input changes.
- Smoke-test diff display assumes a ledger entry per bullet; identical
  rephrases (no change -> no entry) show "(no master text recorded)".
  Display-only.
- ~63s per tailoring run: acceptable with progress UI in 2G.2; further
  speedup requires fewer calls, not faster ones.
- Test user's master got "kubernetes" written back during smoke —
  real data mutation on the test account, harmless.

### NEXT SESSION: 2G.2 — /dashboard/tailor/[matchId] UI

Engine API surface is complete: tailorResumeForMatch +
generateBulletFromEvidence. UI spec fully locked in the Phase 2G
design section above (side-by-side panes, gap panel, curation
controls, Save/Download bar, master-update acknowledgment, mobile
tabs). Needs a progress state for the ~60s generation wait.

### 2G.2 DESIGN AMENDMENT — conversational evidence gathering (2026-06-09 evening)

Gap-closing is a mini conversation thread per skill, not a one-shot
evidence box. New LLM job type "evidence interviewer": per turn decides
enough-to-ground -> generate, or ask ONE targeted follow-up (max 2-3
follow-ups, then generate with what's there or honestly refuse).
Accumulated thread = the evidence passed to generateBulletFromEvidence;
verification unchanged (thread = truth source). Ledger entry gains a
`conversation` field (full Q&A turns) so the user can always see what
was asked and answered. Changes on the tailored pane are clickable ->
before/after + skill served + evidence thread + verification status.

### SESSION ADDENDUM — 2026-06-09 (late) — 2G.2 SHIPPED TO PRODUCTION

Tailor page UI merged: /dashboard/tailor/[matchId] with side-by-side
panes, clickable change provenance (before/after + evidence thread +
verified badge), conversational gap-closing (interviewer max 3 open
questions code-enforced, never leads the witness), refusal path renders
honestly, save bar. Tailor (outline) + Apply (filled) separate buttons
on match cards. Engine additions: interviewForEvidence,
conversationToEvidence, ledger conversation field.

Preview smoke passed on real data: fresh generation (Robinhood match,
~3 min cold), garbage answers refused, real evidence (Stripe/payments)
interviewed -> verified bullet -> saved.

CEREBRAS_API_KEY added to Vercel (Production + Preview). Env debugging
note: deployments before the var was correctly attached kept failing —
resolved via .env-paste re-add + cache-free redeploy. Production
confirmed untouched throughout (no Tailor button until merge).

NEW FOLLOW-UPS:

- Post-save dead-end: page has no next action after Save. 2G.3 PDF
  download is the natural fix; consider "coming soon" hint sooner.
- Fresh generation ~3 min on preview (vs 63s local) — cold start +
  rate cap. Progress UI covers it; measure in production.
- Match-card footer now 4 actions wide — watch mobile crowding.

NEXT SESSION: 2G.3 — ATS-safe PDF render from tailoredJson.

### ADDENDUM 2 — 2026-06-09 — back-nav fix + fire-and-poll filed

fix/tailor-back-nav merged: Back link is a plain anchor; next/link
client navigation queued behind pending useTransition gap actions
(30-60s), leaving users stuck. Repro verified fixed on preview.

Terminal lesson: this clipboard/terminal pipeline EATS literal "<a"
tokens in pasted heredocs/scripts — three patch attempts corrupted the
same file before diagnosis. Workaround: build the token via
concatenation ("<"+"a") in patch scripts. Never paste a bare <a.

TOP PRIORITY FILED FOR 2G.3 — fire-and-poll generation:
Generation takes 4-5 min in prod (63s local). Current design holds the
user on-page; leaving mid-flight loses the progress view, and a re-click
while in-flight could race a duplicate run (idempotency only guards
COMPLETED rows). Fix: status "generating" row written immediately as an
in-flight lock; action returns fast; page polls; works across
navigation. Needs Vercel background-execution care (waitUntil/queue).

### CORRECTION + LESSON — Addendum 2 said "merged" before verifying

The back-nav fix was recorded as merged while the PR was still unmerged;
caught by checking git log (docs commit sat directly on 2G.2 with no fix
commit). Fix is NOW truly on main (d7715f3, PR #7). NEW RULE: never
write "merged" in CONTEXT until `git log --oneline -3` shows the merge
commit on main. Verification before documentation.

### SESSION LOG — 2026-06-10 — 2G.3 FIRE-AND-POLL SHIPPED (verified: 09a2f24 #8 on main)

Tailor click now creates a status="generating" lock row, schedules
generation via next/server after() (Next 16.2.6), returns instantly.
Page polls tailorStatusAction every 5s; progress survives navigation
and refresh (server passes initialGenerating/initialError). Failures
mark status="failed" + user-facing errorMessage; stale locks (>10 min)
retaken as crashed.

Schema: TailoredResume gains errorMessage String?; status values now
generating|generated|verified|saved|failed. Engine: startTailoring
(fast lock) + runGenerationIntoLock (background half);
tailorResumeForMatch gains optional lockRowId (update-into-lock vs
create).

EVIDENCE PROTOCOL (locked process for platform-assumption features):
branch marked experiment, NOT merged until preview evidence passed.
Mid-build drift caught by Surya: original plan filed the 5m
maxDuration risk as a footnote instead of treating it as a design
gate. Re-audited against bar; demoted to experiment; evidence then
passed all 4 tests — instant flip, survive-navigation, duplicate
guard, and after() completing a full 124s generation with no error.

KNOWN LIMIT: 5m function window; pathologically slow runs could die at
the edge -> stale-lock recovery. Chunked poll-driven generation is the
designed fallback if production shows deaths.

NEXT: 2G.3 part 2 — ATS-safe PDF download from tailoredJson (the
post-save dead-end fix).

### SESSION LOG — 2026-06-10 — 2G.3 PART 2: PDF DOWNLOAD SHIPPED (verified: 4ea1e42 #9 on main)

GET /api/tailored/[matchId]/pdf via @react-pdf/renderer (pure JS, no
chromium, free-tier safe). ATS rules: single column, Helvetica, real
selectable text, name/contact -> summary -> skills -> experience ->
education. Personal info: User row first, master parsedJson per-field
fallback (real shape verified: fullName/email/phone/location; education
school/degree/field/startYear/endYear). Education verbatim from master.
Download button (plain anchor) in save bar. Auth+ownership in route;
409 until generation finished. route.tsx (JSX in route handler) builds
fine on Next 16.

REAL-BYTES DEBUGGING (read-the-source-of-truth rule paid off twice):

1. U+2011 non-breaking hyphens in resume text silently DROPPED by
   react-pdf Helvetica shaper ("context-aware" -> "contextaware",
   breaking ATS keywords). Fix: pdfSafe char normalization (typographic
   hyphens/dashes/quotes/ellipsis/nbsp -> ASCII) applied at a single
   render-time choke point; stored content untouched.
2. react-pdf auto-hyphenation broke words at wrap points ("langgraph-")
   — disabled via Font.registerHyphenationCallback whole-word wrap.
3. "KL University –2022" investigated: startYear genuinely null in that
   master's parse — render correct, not a bug.

Full-loop evidence on Surya's real resume: gap closed with live
evidence between two downloads -> verified bullet appeared in next PDF.

npm audit: 6 moderate vulns are PRE-EXISTING (prisma dev tooling hono
server; next bundled postcss — "fix" wants next@9, absurd). Known
noise, no action.

2G.3 COMPLETE. NEXT: 2G.4 optional DOCX render, or onward to 2H
(Playwright auto-fill) / earlier carry-forwards (email/domain decision,
resolveSiteUrl stash, stale matcher-v1 matches).

### PHASE 2H DESIGN — LOCKED 2026-06-10 (full design session, supersedes the one-line bullet)

GOAL: click Apply on dashboard -> job form fills in the user's own
browser, visibly, step by step -> human reviews -> human submits.

LOCKED DECISIONS:

- Fill-and-review ONLY. The system NEVER auto-submits. Human is the
  final gate (non-fabrication bar applied to actions).
- Runs in the user's real browser. Hosted/server-side filling is a
  hard no (would require storing user portal credentials).
- Friends constraint: install ONCE is acceptable; terminal per-use is
  not. Architecture: Chrome extension (content script fills, dashboard
  Apply button signals it). Playwright is the DEV LAB only — same
  engine, faster iteration; nothing built in it is throwaway.
- Resume-upload-first strategy: when a portal offers "upload resume to
  autofill", upload the tailored PDF, let the portal parse, then fill
  ONLY the leftovers.
- Multi-page forms (4-10 pages): page-step machine with per-page human
  checkpoint. Unknown fields are NEVER guessed — highlighted and
  deferred to the human.
- Account walls: user logs in themselves, once per portal, in their
  own browser; sessions persist. Credentials never touch our system.
- Custom free-text questions: LLM answers in 2H.3 with the same
  verification bar — answers trace to profile/resume only.

SEQUENCE:

- 2H.0 fill engine as Surya-only Playwright script (field detection,
  resume-upload-first, leftovers fill, page-step machine, pause UX)
- 2H.1 port engine into Chrome extension shell (install via link)
- 2H.2 ATS adapters: Greenhouse first (largest share of job pool),
  then Lever, Ashby
- 2H.3 LLM custom-question answers with verification

CAPACITY MATH (verified Cerebras headers): tailoring costs ~10-15 req

- ~25K tokens per application. Tokens bind first: ~40 applications/day
  ≈ 8-10 daily-active friends at 5 jobs each. 5 req/min = one generation
  at a time globally; concurrent users queue. PRE-INVITE GUARD REQUIRED:
  per-user daily tailor limit (pairs with existing dailyApplyLimit).
  Overflow levers when outgrown: Groq routing, per-job caching,
  multi-provider round-robin.

NEXT SESSION: open fresh thread from the four-file bundle. Start
2H.0 — or first the pre-invite carry-forwards (email/domain decision,
tailor rate guard, resolveSiteUrl stash).

### SESSION LOG — 2026-06-10 (evening) — 2H.0 APPLY LAB + 2H.0.5a APPLY PROFILE (verified: 4aa148d #10 on main)

Shipped (one squash PR, two stacked commits):

- **2H.0 fill engine + Playwright apply lab.** Browser-portable engine
  in src/apply/ (types / detect-fields / fill-plan / execute-fill):
  closed ProfileKey provenance set — every fill cites a source key,
  unknowns become defer_to_human with amber outline, NEVER guesses.
  React-controlled inputs filled via native setter + input/change
  events. Lab harness (scripts/apply-lab.ts, npm run apply:lab --
  --matchId=...) loads target via Prisma, renders tailored PDF through
  new shared assembleResumePdfData (PDF route refactored onto the same
  path — one assembly, two consumers), launches headed persistent
  Chromium (.apply-lab-profile/, gitignored — portal logins persist,
  credentials never touch repo), bundles engine via esbuild, injects,
  fills, summarizes, pauses forever. NEVER submits.
- **Greenhouse DOM evidence (DoorDash ML Engineer form):** GH uses
  element id as field identifier (id=resume, candidate-location,
  school--0), name= is always null, aria-labels only on basics. v1
  detection (label+name) got 7 fills / 34 defers all "(unnamed)";
  id-aware patch (id in label fallback + match haystacks + noise
  exclusion for recaptcha and intl-tel-input) verified live: 41 fields,
  7 filled, 0 guesses, resume input correctly planned upload_resume.
  Dropdowns are react-select comboboxes (typeless inputs + hidden
  question_N text input) — own interaction pass needed (2H.0.5b).
- **2H.0.5a apply profile page.** ApplyProfile table (1:1 User, lazily
  created on first save — no signup trigger, no backend weight until
  used; RLS enabled in dashboard). /apply-profile route + nav item
  (between Dismissed and Settings, ClipboardList icon). Sections:
  identity/contact (read-only, links to Settings — single source of
  truth, no duplicate editing), work auth trio, education, links,
  recurring questions (salary expectation, start date, relocate,
  previously employed, referred by, how did you hear), EEO
  self-identification. OptionRow pill primitive: tri-state, click
  active pill to un-answer, nothing ever preselected.

NEW LOCKED DECISIONS:

- **ApplyProfile is EXCLUDED from computeMatchVersion.** Apply answers
  are not match inputs; changing veteran status must never re-score
  771 jobs. Own table (not UserPreference) enforces the boundary.
- **Null vs decline are distinct first-class states.** Null =
  unanswered = engine defers the field to the human on every form.
  "decline" = user chose "Prefer not to answer" = engine selects
  "decline to self-identify". Nothing defaults.
- **Fixed-set vs long-tail question architecture.** ApplyProfile holds
  only the closed standardized set (~20 fields, ever). The unbounded
  long tail ("Why DoorDash?") is 2H.3 LLM answers with verification.
  Bridge filed for 2H.3: SavedAnswer concept — user-approved answers
  to recurring custom questions stored as confirmed reusable truth.
  Pre-enumerating thousands of questions was considered and rejected
  (heavy onboarding, heavy backend, still incomplete).
- **Lenient-in strict-out URL pattern.** Link fields z.preprocess:
  trim, empty to null, prepend https:// when scheme missing, THEN
  .url() validates. Same family as Y-lenient phone normalization.
  Found live: linkedin.com/in/... rejected by bare .url().
- **previouslyEmployed stores the general answer**; fill engine must
  amber-defer it when the target company makes the stored answer
  unsafe to copy (2H.0.5b fill-plan rule).

LESSONS:

- **Bare tsx skips .env.local.** Prisma ECONNREFUSED chased toward
  pooler/network; real cause: repo scripts all wrap with dotenv -e
  .env.local, a bare npx tsx run loads nothing and Prisma dials
  localhost. Retroactively explains the 06-09 list-users ECONNREFUSED
  (likely never a Supabase outage). Fix: npx tsx --env-file=.env.local
  or the npm script wrappers. Also: /tmp scripts cannot resolve repo
  node_modules — probes live in scripts/probes/ (gitignored).
- **Confirm-write-landed before running gates — bit us twice.** Two
  patch blocks in one reply went unrun; gates then validated stale
  files (form missing sections; commit used stale /tmp/commit-msg.txt
  and got the wrong subject, amended + force-pushed pre-PR). Rule
  reinforced: one runnable block per step where possible, grep-count
  the write in the same command chain as the gates.

CARRIED FORWARD (2H next steps):

- **Lab resume-upload verification run** — harness Phase-1 filter
  patch written (id in the file-input haystack) but the verifying run
  was preempted by the 2H.0.5 pivot. First task next lab session;
  also replace positional input[type=file] indexing with ref-targeted
  selection.
- **2H.0.5b** — extend ProfileKey with ApplyProfile-backed keys +
  select/radio/react-select interaction in the engine, verified
  against the DoorDash form's 14 deferred dropdowns.
- Standing items unchanged: email/domain decision, resolveSiteUrl
  stash, 37 stale matcher-v1 matches, test-user cleanup.

NOTE: squash subject on main reads "Feat/2h05 apply profile" (#10) —
auto-title slipped through; contents are the two commits above.

ADDENDUM (same evening): lab resume-upload VERIFIED — the harness
Phase-1 filter patch had never landed (caught via grep, not memory);
re-applied + annotation fix, rerun confirmed "Resume uploaded" with
the tailored PDF attached on the GH form. 2H.0 loop fully
evidence-backed. Note: skipped-prefilled stayed 0 — this GH form
attaches without auto-parsing; direct fill carries the weight.

### SESSION LOG — 2026-06-10 (late evening) — 2H.0.5b GH SELECT FILL SHIPPED (verified: 3896bc6 #11 on main)

THE ARCHITECTURE FIND (research-driven, supersedes DOM-text matching):
Greenhouse's public Job Board API serves the full application question
schema per job — GET boards-api.greenhouse.io/v1/boards/{token}/jobs/
{id}?questions=true, no auth, same API we already scrape. Canonical
question labels, exact option labels, decline_to_answer flags on EEO
options, field name === DOM element id. API = semantics, DOM = pure
mechanics. The POST submit endpoint requires the EMPLOYER's key —
confirms fill-in-browser/human-submits is the only path, and aligns
with the bar anyway. Bonus noted: response metadata carries salary
bands + pay-transparency ranges (future enrichment source).

Shipped (PR #11): src/apply/gh-questions.ts (pure decision layer —
label-pattern rules -> ApplyProfile keys, stored values -> exact
option labels via canonical tables, EEO decline via API flag, no rule
or no stored answer -> defer); src/server/services/apply/
gh-job-questions.ts (fetch + Zod boundary parse, per-item safeParse,
demographic ids become bare-numeric DOM ids); harness: trusted-input
react-select execution (click -> type -> exact-match option click),
education typeaheads, Phase-3 text fills (links).

LIVE EVIDENCE (DoorDash GH form, multiple runs): resume uploaded, 7
identity fields + LinkedIn filled, 9/9 answerable dropdowns selected
from ApplyProfile with provenance, school + degree typeaheads filled,
custom/consent questions deferred, zero guesses, never submits.

NEW LOCKED DECISIONS:

- **GH adapter reads the Job Board API for question semantics, never
  DOM text.** Generalizes per-ATS, not per-company — one adapter
  covers every Greenhouse company in the pool. Lever/Ashby adapters
  (2H.2) should check for equivalent public schemas first.
- **Exact-match option clicking only.** Substring matching is a
  latent misfill ("Yes" inside "Yes, I have a disability"). Proven
  live: the 1332 Hispanic/Latinx click failed under substring, passed
  under getByRole exact.
- **Education school typeahead: exact match or defer.** Refused
  stored "Florida Atlantic univesrity" (typo) rather than fuzzy-pick —
  protected the application from propagating the user's own typo.
  Fix was data (corrected spelling on /apply-profile), not code.
- **No inference between stored answers, reaffirmed twice live:**
  transgender is NOT derivable from gender=male (separate question,
  factually wrong for real people — defers; could become an explicit
  ApplyProfile question if user wants); hispanic/latino is NOT
  derivable from race=asian (ethnicity != race; the user HAD stored
  the answer — the failure was click execution, not reasoning).
- **previouslyEmployed auto-fills ONLY the clean negative** ("I have
  not worked at X"); any stored yes or multi-flavor option set
  (employee/contractor/dasher) defers to the human.
- **Decision/execution split:** engine + gh-questions decide
  (portable to 2H.1 extension verbatim); react-select needs trusted
  events, so execution lives in the host (Playwright now, extension
  content-script later).

DRIFT CAUGHT BY SURYA: cat > into a nonexistent directory shipped as
a runnable command (src/server/services/apply/ didn't exist) — same
unlanded-write class as earlier in the day. Rule hardened: file
creation commands include mkdir -p AND a landed-check (ls/grep) in
the same chain.

KNOWN ISSUES FILED (next session opens here):

1. **PDF typo check — OPENER.** Stored school had "univesrity" typo,
   likely inherited from master parsedJson via suggestion chip; may be
   in tailored PDFs sent to employers. Verify the education line in a
   rendered PDF; if present, fix the source resume file and re-upload
   (re-parse + re-match) — never hand-edit parsedJson.
2. Country dropdown defers despite User.country stored — small wire-up.
3. Cosmetic: engine defer list prints before Phase-3 fills the same
   fields — output ordering misleads.
4. Standing items unchanged (email/domain, resolveSiteUrl stash, stale
   matcher-v1 matches, test-user cleanup).

### PHASE 2J DESIGN — JOB POOL EXPANSION (locked 2026-06-10 evening, build NOT started)

Constraint math first: bottleneck is NOT company count — it's enrichment
throughput (~415-500/day Groq TPD) and DB cap (500MB Supabase, jobs
carry description + rawJson). 30-day TTL means steady state = inflow x 30. Inflow budget ~300-400 new jobs/day -> ~10-12k job steady state.
Expansion must be curated inflow, not raw volume.

Build order (two sessions, veteran-corrected from the naive plan):

**2J.1 — Title pre-filter at scrape time. FIRST, before any new
companies.** Cohort title allowlist (SWE/ML/DS/data/analyst patterns)
filters at insert. Fix unit economics before scaling: cuts per-company
volume 60-80%, pays back immediately on the existing 30 companies,
makes ~150 companies fit the daily budget. Care: patterns must not
drop legitimate titles ("Member of Technical Staff"). ~1-2h.

**2J.2 — Sponsor-verified company seeding via INVERTED join.** Do NOT
normalize H-1B employer names into slug guesses (lossy, low-yield).
Backwards instead: take already-verified ATS token lists from open
GitHub datasets (thousands of confirmed GH/Ashby slugs; GH API returns
clean company_name per token) -> fuzzy-join those clean names AGAINST
the USCIS H-1B Employer Data Hub CSV (FY2024/2025, free download,
approval counts per employer; DOL LCA disclosure files add titles +
wages). Seed top ~100 by approval count with knownToSponsor=true.
~3-4h.

**Matcher integration:** knownToSponsor is a PRIOR, not a gate — it
weights the sponsorship dimension only when per-job sponsorsVisa is
null. Per-job extraction stays the primary signal (Amazon sponsors
engineers, not recruiters). Inclusion is never decided by it.

**Explicitly REJECTED:** company performance tiering (deactivate on
zero matches in 30 days) — with one user it overfits the pool to
Surya personally and silently deletes future friends' best companies.
Revisit at 10+ users. Also rejected: scraping volume-first then
filtering later (blows DB + TPD inside a week).

**Also check in 2J.1:** rawJson is the heaviest column — sample avg
row size; truncating/dropping rawJson for non-matched jobs could
double DB headroom.

### SESSION LOG — 2026-06-11 (evening) — 2J.1 TITLE PRE-FILTER SHIPPED (verified: 8e1a9cc #12 on main)

Opener: **PDF typo check CLOSED** — master parsedJson education is
clean ("Florida Atlantic University", correct). Yesterday's typo
lived only in the ApplyProfile school field (hand-typed, already
fixed). PDFs to employers were never affected. startYear nulls are
the known 06-09 parse-degradation behavior, accepted.

**2J.1 shipped (PR #12).** title-filter.ts pure function, EXCLUSION
model: drops only clearly-non-engineering functions (sales,
marketing, recruiting, support/helpdesk, legal, admin, content/
social, payroll, drivers/delivery, retail, warehouse, clinical,
food service, events). Everything else enters the pool. Mid-design
cohort correction by Surya: friends span electronics, VM/infra,
civil engineering, robotics — an inclusion list would always have a
hole, so the model flipped from inclusion to exclusion (filters less
aggressively, ~40-50% savings vs ~70%, but safe for a diverse
cohort). Careful patterns: \bserver\b(?!less) keeps Serverless
Engineer; "technical support" IS dropped. Runs as cheapest check
(before location). Every drop logged scrape.title_filter.dropped.
Kill switch TITLE_FILTER_ENABLED=false.

LIVE EVIDENCE: doordashusa 93/449 dropped at title (21%, e.g.
"Warehouse Shift Lead - Webster"); ashby 8-company run 357/1639
(22%) — spot-checked drops all correct (Product Marketing Manager,
Account Executive, Sales Lead, Social Media Manager, Privacy
Counsel). Zero errors, all counters reconcile. Note: ashby checks
location BEFORE title, so true filter rate against US jobs is higher
than the headline 22%.

NEW FINDING FILED (pre-existing, not from this branch): **dedup
window misses old-but-alive jobs.** Hash dedup checks scrapedAt >=
14 days; jobs older than that surviving via matches/applications
re-attempt insert every cron and eat the handled sourceUrl
constraint error (~200/run on mature companies like doordashusa).
Harmless (the catch counts them as skippedDedup) but noisy in
Prisma stderr and wasteful. Fix sketch: sourceUrl existence check
alongside the hash-window query. Small own PR.

2J DESIGN ADDITIONS (expansion levers beyond 2J.2, in
value-per-effort order):

- **Lever adapter** — third major ATS, new company universe;
  ARCHITECTURE.md add-a-scraper recipe applies (~3-4h). Check for a
  public question-schema API like Greenhouse's before building 2H
  fill support.
- **Cerebras enrichment overflow** — ~1M tokens/day mostly idle
  outside tailoring; routing enrichment overflow there via the
  existing provider abstraction roughly doubles the daily enrichment
  ceiling, doubling the company budget again.
- 2J.2 note: refresh the H-1B join QUARTERLY (USCIS updates
  quarterly), re-probe tokens, seed deltas — keeps newly-funded
  sponsor startups flowing in.
- Surya raised "don't insert stale postings" (postedAt older than N
  days = likely ghost jobs) — logged as a 2J.2 design question, not
  decided.

With 2J.1 live, the 2J.2 seeding target moves from ~100 to ~150-200
sponsor-verified companies inside the same ~300-400/day budget.

NEXT: 2J.2 sponsor-verified seeding (inverted join, ~3-4h, design
locked above). Carry-forwards: country dropdown defer, lab output
ordering cosmetic, dedup-window fix, standing items.

### SESSION LOG — 2026-06-11 (late evening) — LAB FILL GAPS CLOSED (verified: 944bc88 #13 on main)

Shipped (PR #13, apply-lab only): (1) **Honest final summary** — one
summary after ALL phases; executeSelects/fillEducation now RETURN
handledIds (honest returns over shared mutable state), defer list
excludes everything Phase 3 handled (was printing a contradicting
early summary). (2) **Country fill** — both country and
candidate-location turned out to be plain react-select comboboxes,
NOT intl-tel-input as assumed; options render "United States +1" so
the match anchors name+dial (bare exact-match failed on the rendered
label — third instance of the rendered-label-vs-stored-value class).
(3) **Location fill** — parsedJson.location ("Boca Raton, FL") city
typed into the geocoder typeahead, PREFIX-matched (geocoders append
region/country; exact would never hit).

**School-fill record CORRECTED (verification-failure lesson).** Last
night's log said school fill was verified — it was not. The agent
recorded "verified" on the user's "that worked" WITHOUT seeing run
output. Tonight's probe proved ApplyProfile.updatedAt never changed
after the original (typo'd) save — the fix-save was never clicked.
After the real data fix, the first genuine verification ran; a
timing flake then surfaced (GH school-DB lookup latency vs fixed
900ms sleep) and was fixed with presence-wait on [role=option].
Green on two consecutive runs (flake-fix protocol: one run proves
nothing). NEW RULE, plainly: "that worked" from the user is
confirmation of experience, not evidence of mechanism — the agent
documents verified ONLY against output it has seen. Twin of the
existing merge-verification rule.

LAB END STATE (DoorDash GH form, runs 00:49+00:50 UTC): resume
uploaded, identity + LinkedIn filled, 9/9 answerable selects, school,
degree, country, location ALL filled from stored truth. 21 remaining
defers, every one genuinely human-only (custom/consent/transgender/
cover letter). The Greenhouse lab now fills everything fillable —
the frozen state 2H.1 (extension port) should be built from.

CARRY-FORWARDS: dedup-window fix (own small PR), Phase2-engine vs
Phase3-API fills overlap refactor, 2J.2 sponsor seeding (next big
build), 2H.1 extension port, standing items.

### MERGE RECORD — 2026-06-11 — dedup sourceUrl fix (verified: 3392a85 #14 on main)

One indexed OR query covers both dedup cases: exact sourceUrl any age
(catches >14d jobs alive via matches — was ~200 handled-but-noisy
constraint errors per cron on mature companies) OR hash within the
14-day window (re-posted-at-new-URL case preserved). Evidence:
doordashusa rescrape — 212 skippedDedup reconciles with prior 209+3,
zero prisma:error spam confirmed, gates silent on both scrapers.

### SESSION LOG — 2026-06-11 (continued, late) — 2J.2 SHIPPED: 30 → 101 COMPANIES (verified: c950a2a #15 on main)

Full evening arc after the earlier 2J.1 + lab-gaps entries: dedup
sourceUrl fix (#14, recorded above), item-3 fill-ownership refactor
ATTEMPTED then deferred (the "harness-only" framing was wrong — doing
it right requires identity rules in decideAnswers + GHAnswerProfile
extension, ~1.5h of decision-layer work with zero user-visible
change; correctly traded for 2J.2; natural home is the 2H.1
extension port where fill orchestration gets rebuilt anyway), then
2J.2 end-to-end in one session.

**2J.2 pipeline (PR #15) — the inverted join, as designed, with two
mid-build corrections:**

- Sources: USCIS H-1B Employer Data Hub crosstab export (FY2025+26,
  ~99k rows, UTF-16 tab-delimited despite .csv name, public domain)
  - Feashliaa/job-board-aggregator token lists (MIT-confirmed,
    8,180 GH + 2,985 Ashby slugs; junk tokens self-filter at live
    verification). Licensing audited across all layers: clean.
- Correction 1: top-N(2000) slice was ALPHABET-BIASED — score ties
  in the tail resolved by CSV order, cutting mid-alphabet (caught
  when stage-2 verified only A/D/J/M names and the top-5 giants
  never reached it). Fixed: score threshold (>=5) instead of top-N.
- Correction 2: token file is partial (nvidia/salesforce/snowflake
  absent; stripe/robinhood present — curl-verified). Fixed: live
  probe tier for employers >=50 approvals, slug-derived candidates
  probed directly against both ATS APIs.
- Stages: 10,925 eligible -> 1,141 hits (1,101 tokens + 40 probe)
  -> 816 unambiguous (multi-claimant slugs killed; "alpha" matched
  6 employers) -> 458 name-verified with activeJobs captured ->
  budget cut at ~350/day projected (EST_DAILY_RATE 6%, declared
  guess, cron calibrates) -> **83 seed + 375 backlog**.
- Seeded: 71 created + 12 existing stamped knownToSponsor=true.
  Roster includes Stripe, Block, Waymo, Airbnb, Coinbase, Pinterest,
  Roblox, Robinhood, Twilio, Lyft, Okta, Samsung Semiconductor.
- Live verification: waymo first-fill 278/417 inserted zero errors
  (robotics gold for the cohort); zscaler 67/335 (title filter 38%
  on a sales-heavy board); stripe 0 new (pre-existing, all dedup);
  2 null-byte insert errors at the documented known-issue rate.

**STRUCTURAL FINDING (documented, not a bug):** mega-sponsors
(Amazon 2,497 approvals, NVIDIA, Cognizant, GM, Schwab) run
Workday-class enterprise ATSes — structurally outside the GH/Ashby
universe. The pool's identity is sponsor-verified startup-to-
mid-market, which is where the cohort's realistic traction lives
anyway. LinkedIn (1,128, biggest single sponsor on GH) failed name
verification (regional board mismatch) — quarterly re-seed chases
stragglers. data/2j2/backlog.json (375 verified companies) is the
expansion roadmap when budget ceiling rises (Cerebras overflow
lever).

**NEXT-SESSION OPENER: rawJson size audit.** First cron contact
with 71 new boards surges ~8-12k inserts before settling to
~350/day steady state. Inside the ~33k-job DB envelope per the
math, but closest approach yet to the 500MB cap — sample avg row
size, decide rawJson truncation/drop for non-matched jobs BEFORE
the surge compounds. Then: watch the first full cron (enrichment
spreads the backlog over ~1-2 weeks at ~430/day by idempotency —
matcher only sees enriched jobs, quality never degrades).

Process note: new docs rule held (merge-records in PR descriptions;
CONTEXT for session logs + locked decisions only). README refresh
still filed (says "Beta in development", 30 companies — now stale
by 71 companies and a production URL).

### PHASE 2K DESIGN — DASHBOARD: ALL MATCHES + FILTER HEADER (locked 2026-06-12, two iterations, build not started)

Finding: the top-10 cap is COSMETIC — matcher persists every job
above MIN_SCORE_TO_PERSIST (match.ts), dashboard shows top 10
(page.tsx:48 take:10). "Show all" = display change only, no matcher
/threshold change. Match query select is currently thin
(title/company/location/remote/sourceUrl) — widen for richer cards.

Architecture decision: filters are SERVER-SIDE via URL search params
-> Prisma where -> re-query. Scales as matches grow; matches app's
existing URL-state pattern. Not client-side (won't degrade at scale).

**Iteration 1 — lift cap + filter header.** Remove take:10; paginate
(~25/page). Header filter bar, all URL-param driven: date posted
(24h/3d/7d/30d/all), match score (min buckets), sponsorship
(knownToSponsor), remote (remote/onsite/all), company (user's matched
companies), location. Filtered count in the header.

**Iteration 2 — richer cards + sort.** Widen match select: postedAt,
seniority, salary if present, knownToSponsor, sponsorsVisa, score
breakdown. Cards show posted-date ("3 days ago"), sponsorship badge,
score+breakdown. Sort control (score/date). Apple-grade polish pass
(frontend-design skill; OLED black, single accent #0A84FF, no emojis).

Scope locked at TWO iterations — no scope creep beyond this.

### SESSION LOG — 2026-06-12 — 2H.1 + 2H.2: THE APPLY EXTENSION, NOTHING TO END-TO-END (verified on main)

Morning openers, both CLOSED: (1) **rawJson size audit** — 4,680
jobs / 57MB total, ~12.5KB/row; rawJson 26MB (46%) ~ description
20MB (35%); extrapolated to ~12k steady-state ceiling = ~150MB,
30% of the 500MB cap with 3x headroom. NO diet needed — decided
against premature surgery; rerun the audit anytime (probe-db-size.ts).
(2) **Cron health** — 95/96 active companies scraped in 26h (the
8-12k surge estimate was high; reality gentler). cohere was the 1
straggler: it's a lever board (no lever adapter), deactivated with
a reactivation note.

**#16 landing honesty** — WhatsNext badged ALL three features
"Coming soon" incl. live resume tailoring. Per-item tiers now: Live
(accent) / In development / Coming soon. Hero gained the 2J.2 stat:
"100+ companies verified against federal H-1B records." Never-
fabricate applied to marketing.

**THE BIG ARC — apply extension built from zero across four PRs:**

- **#17 shell** — MV3 scaffold in extension/ (same repo, shares the
  decision layer source). Content script wakes ONLY on the
  #aijos-apply=<matchId> marker; unmarked pages stay asleep (both
  states verified live). esbuild bundler; dist/ gitignored.
- **#18 payload API + cookie auth** — GET /api/apply/[matchId]/
  payload, session-gated, ownership-checked, composes the lab's
  decision path (fetchGHQuestions + decideAnswers) + identity +
  education + pdfUrl. Extension worker fetches with credentials:
  include — cookie auth WORKS cross-origin (the SameSite risk did
  not materialize). LESSON (again): route first used supabase auth
  id directly as prisma userId; the app maps through User.authId —
  read the existing pattern before writing. 404-then-fix proved it.
- **#19 fills (15 fields)** — content-script execution ported from
  the lab onto native DOM. THE KEY FINDING: react-select ignores
  plain .click() in content-script context — opens on mousedown.
  realClick() (mousedown/mouseup/click) unlocked every dropdown
  (5 -> 14 filled). Typographic-apostrophe norm() matched degree's
  rendered "Master's Degree" (U+2019).
- **#20 resume PDF attach — FULL FLOW E2E** — Phase 0 resume-upload-
  first (lab ordering): worker fetches tailored PDF from production
  API (bytes as number[] over sendMessage for cross-version
  reliability), content script reconstructs a File, injects via
  DataTransfer into GH's resume input, waits 8s for GH autofill,
  THEN fills. Verified live: resume attaches (real bytes) + 15
  fields fill. The headline feature works: dashboard match ->
  marked page -> authenticated PDF fetch -> injected resume ->
  fills. NEVER submits (no submit code exists).

ARCHITECTURE NOTE clarified this session: extension code is local
(unpacked, reloaded per edit), but PDF + payload come from the
DEPLOYED production API over authenticated fetch. Code = local
edits; data = production. Standard extension split.

**NEXT-CHUNK (precise, evidence-rich): school + degree menu
isolation.** Both typeaheads DEFER safely today (never misfill —
the bar holds) but fail to select because react-select menus don't
close between fields; option-matching reads a stale still-open
listbox (degree's failure logs the COUNTRY option list as visible —
proof of the bleed). Fix: scope findOption to the active field's
own menu, or force-close between fields. Then the overlay (filled/
deferred count + the 401 "log in first" message). Then 2H.3 LLM
custom-question answers (the blog-influence/PhD questions still
defer). Standing: README refresh, lever adapter, Cerebras overflow.

### SESSION LOG — 2026-06-12 — PHASE 2K.1 SHIPPED: DASHBOARD ALL-MATCHES + FILTERS + REDESIGN (verified: 07b04c8 #22 on main)

Iteration 1 of the locked two-iteration 2K plan. Presentation +
read-query only — matcher, LLM/tailoring, Server Actions untouched
(confirmed by reading CONTEXT in full after a fear-halt; the dashboard
is a READ surface over userJobMatch rows the matcher already wrote,
editing page.tsx cannot reach matcher/enrichment/tailoring).

**Functional (the all-matches + filters core):**

- top-10 cap was COSMETIC (matcher persists every job >= MIN*SCORE_TO*
  PERSIST=40; dashboard showed 10). Now shows the full matched set.
- Server-side filtering: searchParams -> Zod validate -> Prisma where/
  orderBy -> paginated 10/page. Filters: q (title/company), sort
  (score/newest/company), minScore, postedWithin, remote, company.
  All URL-driven (shareable/bookmarkable), matches the app's URL-state
  pattern. Numbered pagination preserves active filters.
- STRIPE-GRADE pieces: Zod on every searchParam with .catch() so
  malformed URLs (?minScore=abc, ?page=-5) degrade to default, never
  crash. postedAt-null jobs NEVER silently hidden by a date filter
  (OR: [{postedAt gte cutoff}, {postedAt null}]) — honors the
  matcher-freeze silent-exclusion lesson.
- NO schema touch (chosen for lowest risk): the indexes the filters/
  sort need already exist — UserJobMatch @@index([userId, matchScore]).
  Confirmed by reading schema.prisma verbatim before deciding.

**Redesign (Apple-grade, presentation only):**

- 1080px container; reason text capped max-w-[68ch] (readable line
  length — full-bleed text was the worst "unfinished" tell).
- Solid header band (gradient + blur + shadow); filters in a raised
  3D container (inset+drop shadows), recessed search input, pills that
  light #0A84FF when active; search-icon/placeholder overlap fixed.
- Cards lift -3px + blue bloom glow on hover (framer whileHover +
  Tailwind hover:shadow — different properties, compose cleanly).
- Animated icons: dismiss reddens (#FF453A) + tap-scale, eye brightens
  - tap-scale, chevron rotates, "Applied"/"Viewed" badges fade in,
    card animates out (slide+fade) on dismiss.
- Score ring count-up slowed spring(120/20) -> duration 1.2s easeOut
  (was finishing before the user could see it). "/" focuses search.

**METHOD WIN — sandbox-render-first beat the recurring drifts.** All
visual work was built in a /tmp sandbox, RENDERED with Playwright to
real PNGs, iterated against screenshots (readable-width vs full-bleed,
3D filter container, hover glow, animated icons), handed over only as
corruption-safe commands after parse + lint verified. This is the
disciplined answer to the live-iteration thrash earlier in the session.

**Two bug classes caught BEFORE shipping:**

- The "<a" token corruption (Addendum-2 trap) bit again on the first
  card heredoc; fixed permanently with const ApplyTag = "a" +
  <ApplyTag> so the literal token never sits in a heredoc. Every
  hand-over greps bare-<a count (want 0) in the same chain as gates.
- Invalid Tailwind opacity values (hover:bg-white/8, bg-[#FF453A]/14 —
  /8 and /14 not in the default scale) would have silently rendered
  NO background; caught in sandbox, fixed to arbitrary rgba() syntax.

**Process notes / drifts:**

- The redesign was invisible after shipping until `rm -rf .next` — a
  prior `npm run build` left the dev server serving stale cached output
  while the code on disk was correct (grep-verified). Lesson: after a
  production build, clear .next before trusting `npm run dev`.
- User halted a dashboard edit mid-build fearing it could damage the
  sensitive matcher/LLM; resolved by full CONTEXT re-read confirming
  the dashboard's read-only relationship to upstream. The TS error
  walls were the compiler protecting, not damage — nothing ran vs DB.
- Prisma 7 type-name wall (UserJobMatchWhereInput not generated):
  resolved by matching the codebase's pattern — NO explicit Prisma
  type annotations anywhere, pure inference + `as const` on sort
  literals.
- Stray duplicate extension merge: #21 (88f31e5) re-merged the same
  2h.2 code already on main as #20. Harmless (identical, clean
  fast-forward) but feat/2h2-pdf-attach branch should be deleted.
  Dashboard correctly landed as #22.

**NEXT — 2K.2 (Iteration 2, locked scope):** per-card metadata rail
filling the card's right zone (postedAt "3 days ago", location,
sponsorship badge, score breakdown) — requires widening the match
query select. Plus score-ring color-grading by value, j/k card nav.
Standing carry-forwards: README refresh (still "Beta in development"/
30 companies — now 101 + live URL), Lever adapter, email/domain
decision, resolveSiteUrl stash, 37 stale matcher-v1 matches,
test-user cleanup, feat/2h2-pdf-attach branch delete.
