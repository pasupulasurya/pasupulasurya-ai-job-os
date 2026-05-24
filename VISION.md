# AI Job OS — Vision

## What we're building

An AI-powered job application operating system that turns the application
process from a draining marathon into a deliberate, intelligent workflow.

A user uploads their master resume once. The system:

1. Continuously scrapes US companies for relevant openings
2. Filters by hard rules (sponsorship, location, citizenship)
3. Matches surviving jobs to each user's preferences with AI scoring
4. Tailors resumes per job using AI (without fabrication)
5. Auto-fills applications, pausing for human review
6. Tracks the full lifecycle, including inbox intelligence

## Who it's for

People hunting for jobs who care about quality over quantity. Specifically:
the first cohort is 10 friends — most need US visa sponsorship, all are
technical/early-career, all are tired of LinkedIn Easy Apply spam.

## The bar

### Frontend — cinematic

Every screen feels like an Apple product. Deep blacks, generous whitespace,
restrained color, premium typography. Motion has purpose; nothing decorative.
The UI tells the story of the user's job journey.

### Backend — world-class

Stripe-grade reliability, observability, and type safety. Every action
is logged. Every input is validated. Every operation is idempotent. The
system stays correct under partial failure and graceful under load.

## Non-negotiable principles

### Product

- Human review is mandatory before any submission
- Never fake resume content — no fabricated companies, titles, or dates
- The user's data belongs to the user, and we delete on request
- Surface uncertainty honestly (match scores, confidence levels)

### Engineering

- No `any` types in TypeScript
- Every external input passes through a Zod schema
- Every async operation has structured logging
- Every domain function is unit-testable
- Every API endpoint is idempotent or explicitly documented as not
- Every secret rotates without code changes
- No `console.log` in production code paths

### Design

- 8px grid, no exceptions
- One accent color, used sparingly
- Spring-based motion, never linear easing
- Dark mode first; light mode is a port, not an afterthought
- Empty states are designed with the same care as full states

## What we will NOT do

- Build for the resume-spam market (quantity over quality)
- Auto-submit applications without human review
- Reproduce copyrighted job descriptions verbatim
- Track users across the web or sell their data
- Ship features that aren't observable from day one

## Success metrics (beta)

- 10 friends actively using it for 3 weeks
- ≥80% of generated resumes accepted without manual edit
- ≥1 interview per friend within the beta window
- Zero data loss incidents
- Zero unauthorized submissions
- p95 page load < 1 second
