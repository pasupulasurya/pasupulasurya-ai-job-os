# Cron Runbook

## What runs and when

A single GitHub Actions workflow runs daily at **04:00 PT** (11:00 UTC).

**File:** `.github/workflows/daily-cron.yml`
**Job sequence:**

1. `npm run scrape:gh` — scrape all active Greenhouse companies
2. `npm run scrape:ashby` — scrape all active Ashby companies
3. `npm run cleanup` — auto-dismiss stale matches, archive old rejections, delete unmatched jobs

Steps 1 and 2 have `continue-on-error: true` so a single provider failure doesn't block the rest.

## How to run manually (verify or backfill)

1. Go to the **Actions** tab on GitHub
2. Click **Daily scrape + cleanup** in the left sidebar
3. Click **Run workflow** (top-right dropdown)
4. Pick branch `main`, click **Run workflow**
5. Watch the run in real time — full Pino logs visible

Use this to:

- Verify after secret changes
- Backfill after a missed day
- Test a new scraper before scheduling it

## How to debug a failure

### Step 1 — read the logs in GitHub

Actions tab → failed run → click the step that has a red X. Pino logs and stack traces are right there.

### Step 2 — check Sentry

`scripts/scrape.ts` and `scripts/cleanup.ts` route every `logger.error` to Sentry via the Pino transport. Recent errors show up at:

> https://sentry.io → AI Job OS project → Issues

Look for `scrape.greenhouse.fetch_failed`, `scrape.ashby.fetch_failed`, `cleanup.*.failed`.

### Step 3 — reproduce locally

```bash
npm run scrape:gh -- --slug=<the_failing_slug>
npm run scrape:ashby -- --slug=<the_failing_slug>
npm run cleanup -- --dry-run
```

If it reproduces locally, fix and push. Next cron run will pick up the fix.

## Secrets the cron needs

Three GitHub repo secrets:

- `DATABASE_URL` — Supabase pooler connection string (same as `.env.local`)
- `DIRECT_URL` — Supabase direct connection string (same as `.env.local`)
- `SENTRY_DSN` — server-side Sentry DSN

Not needed: any `NEXT_PUBLIC_*` (those are browser-only) or `SUPABASE_SERVICE_ROLE_KEY` (not used by scrapers).

## How to add a new provider (e.g., Lever, Workday)

1. Build `src/server/services/scrapers/<provider>.ts` + `<provider>.schema.ts`
2. Add `<provider>` to the dispatcher in `scripts/scrape.ts`
3. Add `scrape:<provider>` script in `package.json`
4. Add this step to `daily-cron.yml`, with `continue-on-error: true`:

```yaml
- name: Scrape <Provider>
  run: npx tsx scripts/scrape.ts <provider>
  continue-on-error: true
```

## Cost

- GitHub Actions: free for public repos, **2,000 free minutes/month** for private. Daily 15-min runs ≈ 450 min/month. Well under the cap.
- Supabase: queries from the cron count against the free tier; current job count (~1k jobs) uses well under 1% of read budget.

## When to revisit this setup

- If GitHub Actions usage > 1,500 min/month → split scrapers into separate workflows
- If a provider scrape regularly takes > 5 min → parallelize Greenhouse and Ashby jobs
- If Sentry alerts get noisy → add a Slack webhook for `cron.*.failed` events only
