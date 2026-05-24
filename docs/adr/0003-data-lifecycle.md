# ADR 0003: Data Lifecycle & Cleanup Strategy

**Status:** Accepted
**Date:** 2026-05-24
**Authors:** Surya Pasupula

## Context

The platform scrapes thousands of jobs from third-party ATSes daily.
Without strict data lifecycle management, the Supabase free tier (500 MB)
will be exhausted within months. We also need to prevent the user
experience from degrading as stale matches accumulate.

Additionally: a user who has been rejected by a company (or has had a
bad experience) should never see that company again. This is both a
UX win and a data-pruning opportunity.

## Decisions

### Job TTL

- **30 days** from `scrapedAt`
- Computed via `Job.expiresAt = scrapedAt + 30 days`
- Daily cleanup deletes expired jobs that have NO active application
- Jobs with active applications are preserved (the user still needs the URL)

### UserJobMatch auto-dismiss

- **7 days** since match creation, if `viewedAt` is null
- Sets `dismissed = true, autoDismissed = true, status = "dismissed"`
- Keeps the row for analytics ("did we match well?")
- Hidden from the user's feed query

### Application archival

- Applications with `status IN ('rejected', 'declined')` AND `updatedAt > 90 days ago`
- Set `archivedAt = NOW()` (soft delete)
- Still queryable for analytics; hidden from default dashboard

### Company blocklist

- New table `UserBlockedCompany`
- Blocking a company:
  1. Adds row to `UserBlockedCompany`
  2. Sets all existing `UserJobMatch` for that company → `dismissed = true`
  3. Matcher filters out the company forever for that user
- Reason field tracks why (rejected | not_interested | ghosted | low_quality)
- Provides "you've been rejected by X, want to block all their future jobs?" UX

### Deduplication

- Before insert, compute `hash = sha256(company|title|location)`
- If a job with the same hash was inserted in the last **14 days**, skip
- Prevents reposts from creating duplicates

### Cleanup cron

- Runs daily at **04:00 PT** (GitHub Actions cron)
- Sequence:
  1. Delete expired jobs with no active application
  2. Delete orphan jobs (no UserJobMatch, no Application)
  3. Auto-dismiss UserJobMatch where `matchedAt < NOW() - 7 days` AND `viewedAt IS NULL`
  4. Archive rejected applications older than 90 days
- Logs every action via Pino → captured by Sentry on errors

## Trade-offs accepted

- **30-day TTL might lose a slow-mover's dream job.** Mitigation: if they applied,
  the job is preserved indefinitely as long as the application is active.
- **7-day auto-dismiss may surprise users returning from vacation.** Mitigation:
  display in onboarding that we keep feeds fresh by hiding stale matches.
- **Soft-archive of rejections retains some data.** Acceptable for analytics value;
  we can hard-delete >180 days old in a future cleanup pass if storage becomes tight.
- **Hash-based dedup is approximate.** A retitled job (`Senior Software Engineer` →
  `Sr. Software Engineer`) might bypass dedup. Acceptable: we'd rather over-include
  than miss a real job.

## Consequences

### Positive

- Database stays under 100 MB steady-state for 10-user beta
- Feeds remain actionable (no overwhelming backlogs)
- Users get explicit control to mute companies
- Analytics retained: we can answer "which companies reject most?" and
  "which keywords yield most interview-stage matches?"

### Negative

- Adds 4 new SQL operations to daily cron (very fast, < 1s total)
- New schema fields require migration (one-time cost)
- Slightly more complex matcher logic (checks blocklist + dedup hash)

## Future tightening

If DB usage spikes:

1. Drop TTL to 21 days
2. Drop auto-dismiss to 5 days
3. Hard-delete soft-archived applications older than 180 days
4. Compress `Job.rawJson` JSONB → drop fields we never query
