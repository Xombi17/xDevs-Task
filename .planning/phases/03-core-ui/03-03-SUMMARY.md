---
phase: 03-core-ui
plan: 03
subsystem: ui
tags: [next16, review-page, smoke, privacy, http-404]
requires: [03-01, 03-02]
provides:
  - "/review/[token] mobile-first client decision page (noindex, no-referrer)"
  - "npm run smoke:ui: seed + production build + fetch + assert"
  - "Real HTTP 404 for unknown project ids and review tokens"
affects: [04]
key-files:
  created:
    - src/app/review/[token]/page.tsx
    - src/app/review/[token]/review-panel.tsx
    - src/app/review/[token]/not-found.tsx
    - scripts/smoke-ui.mjs
  modified:
    - package.json
    - src/app/(home)/page.tsx (moved from src/app/page.tsx)
    - src/app/(home)/loading.tsx (moved from src/app/loading.tsx)
  deleted:
    - src/app/projects/[id]/loading.tsx
    - src/app/projects/[id]/audit/loading.tsx
key-decisions:
  - "Root loading.tsx was the real cause of HTTP 200 on not-found: it wraps every route in Suspense, so the shell (status 200) flushes before notFound() runs. Segment loading files removed and the root one moved into a (home) route group so only the dashboard has a skeleton."
  - "ReviewPanel reads the token with useParams() instead of a prop, so it is not serialized into page props."
  - "No review loading.tsx: it would flush a 200 before a bad token could 404."
completed: 2026-10-03
---

# Phase 3 Plan 3: Client review page and UI smoke Summary

Client review page at /review/[token] (name field, approve, request changes with required note, distinct 404/409/429/422 messages) plus a production-build smoke script that also proves real HTTP 404s and that the review token does not leak into rendered HTML.

## Tasks
1. Review page (server) with privacy headers - f1be5b5
2. Review panel client component - f1be5b5 (same commit; the page imports the panel)
3. Production-build smoke script - 4faf711
Fix: real HTTP 404 for unknown ids - dc2563a

## Verification
- `npm run smoke:ui`: all checks pass; no leftover process on 3199 or temp dir
- `npx vitest run`: 7 files / 51 tests pass
- `npx tsc --noEmit`: clean
- `npx next build`: succeeds

Smoke token assertions: dashboard and audit HTML never contain the token; project page has it only as the `/review/<token>` copy-link path inside script data (not in visible HTML); review page visible HTML and head do not contain it; review title is generic.

## Deviations from Plan
**1. [Rule 1 - Bug] Unknown project id returned 200** - Found: known issue from 03-02. Fix: removed `[id]` and `audit` loading.tsx, and moved root loading.tsx/page.tsx to `src/app/(home)/` (URL unchanged). Bad project, audit and review token all return 404 now.
**2. [Rule 2 - Privacy] Token via useParams, not a prop** - ReviewPanel takes only `milestones`. Next's router payload still carries the path param, so the smoke checks visible HTML and head rather than raw script data on the review page.
**3. Plan listed review/[token]/loading.tsx** - intentionally not created (would reintroduce the 200-on-404 problem).

## Known Stubs
None. The tamper-controls slot from 03-02 remains an intentional Phase 4 placeholder.

## Self-Check: PASSED
