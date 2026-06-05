# Phase 2F — Vercel Deploy Runbook

> **Status:** Not yet executed. This document is the pre-flight checklist + step-by-step execution plan written 2026-06-05 ahead of the deploy.
> **Bar:** Deploy is gated per CONTEXT.md Section 6 Phase 2F. Must clear: (1) v4 backfill complete, zero NULLs in active jobs (2) v4 quality verified at >= 18/20 non-tech roles returning `skills: []`.

---

## 1. Pre-flight gates (must all be GREEN before deploy)

Run these checks. If any are RED, stop. Do not deploy.

### Gate 1: v4 backfill complete

```bash
cat > /tmp/check-backfill.ts << 'EOF'
import { prisma } from "../src/server/lib/prisma";
async function main() {
  const counts = await prisma.job.groupBy({
    by: ["enrichmentVersion"],
    where: { deletedAt: null },
    _count: true,
  });
  for (const r of counts) {
    console.log(`  ${(r.enrichmentVersion ?? "NULL").padEnd(30)} ${r._count}`);
  }
  const nullCount = counts.find(c => c.enrichmentVersion === null)?._count ?? 0;
  const oldCount = counts.filter(c => c.enrichmentVersion !== null && c.enrichmentVersion !== "groq-llama-3.1-8b-v4").reduce((s,r) => s + r._count, 0);
  if (nullCount > 0 || oldCount > 0) {
    console.log(`\nFAIL: ${nullCount} NULL + ${oldCount} non-v4 still pending`);
    process.exit(1);
  }
  console.log("\nPASS: all active jobs at v4");
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
EOF
npx dotenv -e .env.local -- tsx /tmp/check-backfill.ts && rm /tmp/check-backfill.ts
```

**PASS:** "all active jobs at v4"
**FAIL:** any NULL or non-v4 jobs — trigger more cron runs, do not deploy.

### Gate 2: v4 quality verified

Run the v4 quality diagnostic. Need >= 18/20 non-tech roles returning `skills: []`. See CONTEXT.md Section 11 success criterion.

### Gate 3: No uncommitted work

```bash
git status
```

Must show "nothing to commit, working tree clean" and "Your branch is up to date with 'origin/main'".

### Gate 4: TypeScript compiles clean

```bash
npx tsc --noEmit
```

Must produce no output (zero errors).

### Gate 5: Local production build works

```bash
npm run build
```

Must complete without errors. If Turbopack build fails on Vercel, fallback is removing `--turbopack` from build script.

---

## 2. Vercel environment variables checklist

All 14 environment variables must be set in Vercel project settings (Production environment). Some are also needed in Preview environment for testing deploys.

### Public variables (NEXT*PUBLIC*\*, safe to expose)

| Variable                      | Source     | Production value                                             | Preview value                         |
| ----------------------------- | ---------- | ------------------------------------------------------------ | ------------------------------------- |
| NEXT_PUBLIC_SUPABASE_URL      | .env.local | same as local                                                | same as local                         |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | .env.local | same as local                                                | same as local                         |
| NEXT_PUBLIC_SENTRY_DSN        | .env.local | same as local                                                | same as local                         |
| NEXT_PUBLIC_POSTHOG_KEY       | .env.local | same as local                                                | same as local                         |
| NEXT_PUBLIC_POSTHOG_HOST      | .env.local | same as local                                                | same as local                         |
| NEXT_PUBLIC_SITE_URL          | .env.local | **CHANGE** to production domain (e.g. `https://aijobos.app`) | preview URL or vercel.app preview URL |

### Server-only secrets (never expose to client)

| Variable                  | Source                   | Production value                               | Preview value |
| ------------------------- | ------------------------ | ---------------------------------------------- | ------------- |
| DATABASE_URL              | .env.local               | same as local (Supabase pooler)                | same as local |
| DIRECT_URL                | .env.local               | same as local (Supabase direct)                | same as local |
| SUPABASE_SERVICE_ROLE_KEY | .env.local               | same as local                                  | same as local |
| SENTRY_DSN                | .env.local               | same as local                                  | same as local |
| SENTRY_AUTH_TOKEN         | .env.sentry-build-plugin | same as local — required for source map upload | same as local |
| LLM_PROVIDER              | .env.local               | `groq`                                         | `groq`        |
| GROQ_API_KEY              | .env.local               | same as local                                  | same as local |

### Resend SMTP (for auth emails)

Already configured in Supabase Auth dashboard, not in app env vars. Verify:

1. Supabase Auth → SMTP settings → Resend host/port/credentials are set
2. Sender domain is verified in Resend dashboard
3. Production NEXT_PUBLIC_SITE_URL matches the callback URL allowed in Supabase Auth → URL Configuration

---

## 3. Supabase production configuration

### Auth callback URLs

In Supabase project → Authentication → URL Configuration:

1. Add production domain to "Site URL" (e.g. `https://aijobos.app`)
2. Add to "Redirect URLs" allow list:
   - `https://aijobos.app/auth/callback`
   - `https://aijobos.app/**`
   - Vercel preview pattern: `https://pasupulasurya-ai-job-os-*.vercel.app/**`

### Database connection pooling

Already configured via `DATABASE_URL` (pooler) and `DIRECT_URL` (direct connection for migrations). Both env vars deploy to Vercel. No changes needed.

### Row Level Security (RLS)

Verify RLS is active on all tables. (Should already be from Phase 2B but worth confirming before exposing publicly.)

---

## 4. Deploy execution sequence

### Step 1: Connect repository to Vercel

1. Go to https://vercel.com/new
2. Import `pasupulasurya/pasupulasurya-ai-job-os`
3. Framework preset: Next.js (auto-detected)
4. Root directory: `./` (default)
5. Build command: `npm run build` (default)
6. Output directory: `.next` (default)
7. Install command: `npm install` (default, runs postinstall: prisma generate)
8. Do NOT click "Deploy" yet — env vars first.

### Step 2: Set environment variables

1. Project → Settings → Environment Variables
2. Add all 14 variables from Section 2 above
3. Use "Production" + "Preview" + "Development" scopes per the checklist
4. For `NEXT_PUBLIC_SITE_URL` in Preview: leave blank or set to Vercel preview pattern (Vercel auto-provides `VERCEL_URL` env var that we'd need to read in code; for now, manual override is fine)

### Step 3: Trigger preview deploy from feature branch

Do NOT deploy from main first. Create a preview deploy from a branch:

```bash
git checkout -b deploy/2f-vercel-preview
git push -u origin deploy/2f-vercel-preview
```

Vercel auto-deploys the branch as a preview. Wait for green check on Vercel dashboard.

### Step 4: Smoke test on preview URL

Open the preview URL (`https://pasupulasurya-ai-job-os-deploy-2f-vercel-preview-*.vercel.app`).

Execute manual test sequence in order, marking each PASS/FAIL:

#### Auth flow

- [ ] Visit `/signup` — page renders without errors
- [ ] Enter test email, submit — Resend sends magic link to inbox
- [ ] Click magic link — redirects to `/auth/callback` then to `/onboarding/welcome`
- [ ] `/onboarding/welcome` renders, "Get started" button visible

#### Onboarding pipeline

- [ ] `/onboarding/profile` — enter firstName, lastName, select country, enter phone. Save.
- [ ] Verify in DB: User row has firstName, lastName, phone (E.164), country (ISO code)
- [ ] `/onboarding/resume` — drag-and-drop a real PDF resume. Upload completes.
- [ ] Verify in DB: ResumeVersion row with isMaster=true, parsedJson populated, parseVersion=groq-llama-3.3-70b-resume-v3
- [ ] `/onboarding/preferences` — suggested skills chips appear from parsed resume. Select 3+ keywords. Save.
- [ ] Verify in DB: UserPreference row with keywords, matcher triggered (UserJobMatch rows created)

#### Dashboard

- [ ] `/dashboard` — top 10 matches render with score rings, titles, reasons
- [ ] Click "Why this score?" on one match — expandable breakdown shows
- [ ] Dismiss a match — disappears with animation, status updated in DB
- [ ] Mark applied — status updated

#### Settings

- [ ] `/settings` — personal info section shows (read-only)
- [ ] Click Edit on personal info — form appears, save works
- [ ] Change a keyword in preferences — save triggers "Saving and re-matching jobs…"
- [ ] Saved toast shows match summary count
- [ ] Return to dashboard — new scores visible

#### Auth/security

- [ ] Try accessing `/dashboard` while signed out — redirects to `/login`
- [ ] Try accessing another user's match action — Server Action rejects (need 2nd test user)
- [ ] Sign out — redirects to home, session cleared

#### Performance + observability

- [ ] Dashboard initial load < 3 seconds (acceptable for free-tier infra)
- [ ] Sentry receives a test event (force an error in dev console or wait for one)
- [ ] PostHog dashboard shows pageview events

### Step 5: Promote to production

If all smoke tests PASS:

1. Vercel dashboard → Deployments → click the green preview deployment
2. Click "Promote to Production" button
3. OR merge branch to main, Vercel auto-deploys main to production

### Step 6: Production smoke test (abbreviated)

Repeat the auth flow + dashboard + settings save tests on the production URL. If anything regresses, immediately rollback via Vercel dashboard ("Promote previous deployment").

### Step 7: Update docs

After successful deploy:

1. Update README.md: status line gets production URL
2. Update CONTEXT.md Section 6: Phase 2F shipped, deploy URL noted
3. Update CONTEXT.md Section 11: Phase 2F removed from priorities, Phase 2G becomes next
4. Add a `docs/runbooks/deploy.md` post-mortem note: any surprises, lessons for next deploy

---

## 5. Cron jobs after deploy

The current GitHub Actions cron will continue running independently. It connects directly to Supabase, not through the Vercel deployment. Real implication: cron works the moment we point production at the same Supabase project. No additional setup needed for Phase 2F.

Future consideration (Phase 2H+): migrating cron to Vercel Cron Jobs. Free tier allows 2 cron jobs. We have 2 (`daily-cron.yml` + `daily-enrich.yml`) so it would fit. Sentry auto-instrumentation already enabled via next.config.ts `automaticVercelMonitors: true`. But not blocking Phase 2F.

---

## 6. Rollback plan

If production deploy goes bad:

1. Vercel dashboard → Deployments → find last known-good deployment
2. Click "..." menu → "Promote to Production"
3. Production URL serves the previous deployment within ~30 seconds
4. Diagnose the broken deploy on the preview URL, not production

For DB issues: schema is shared (same Supabase) so a code rollback fixes app issues but DB state stays as-is. If we need to roll back schema changes (unlikely for Phase 2F since we're not changing schema), it would require a manual `prisma db push` against an older schema file.

---

## 7. Known Vercel + Next.js 16 concerns to verify on deploy day

1. **Turbopack build:** `npm run build` uses `--turbopack`. Vercel may or may not support Turbopack production builds. Fallback: remove `--turbopack` from build script.

2. **Server Actions:** App Router uses Server Actions extensively. These run on Vercel's serverless functions by default (node runtime). Cold-start latency may be 1-2 seconds on first request. Acceptable for beta.

3. **Upload body size:** 5 MB resume upload. Vercel free tier serverless function body limit is 4.5 MB by default. **REAL CONCERN.** May need to verify or use Vercel's `bodyParser` config. Worst case: route the upload through Supabase Storage directly from client instead of through Server Action.

4. **Prisma Client:** Already runs in Node runtime (Server Actions are node by default). `postinstall: prisma generate` already in package.json. Should just work.

5. **Edge runtime considerations:** None of our current routes use Edge. All run on Node. Standard Vercel serverless behavior.

6. **Sentry source map upload:** Requires `SENTRY_AUTH_TOKEN` in Vercel env vars. Must be added per Section 2.
