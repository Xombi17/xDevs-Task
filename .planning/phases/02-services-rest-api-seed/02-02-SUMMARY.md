---
phase: 02-services-rest-api-seed
plan: 02
subsystem: api
tags: [next16, route-handlers, rate-limit, integration-test, vitest]
requires: [02-01]
provides:
  - "7 route handlers under src/app/api (projects, ledger, verify, public verify, review, decision)"
  - "src/app/api/api.integration.test.ts: 7-step flow, 429, 10-parallel decisions"
affects: [02-03]
key-files:
  created:
    - src/app/api/projects/route.ts
    - src/app/api/projects/[id]/route.ts
    - src/app/api/projects/[id]/ledger/route.ts
    - src/app/api/projects/[id]/verify/route.ts
    - src/app/api/verify/[id]/route.ts
    - src/app/api/review/[token]/route.ts
    - src/app/api/review/[token]/decision/route.ts
    - src/app/api/api.integration.test.ts
key-decisions:
  - "Decision route rate-limits on the supplied token string before parseBody and DB work"
  - "Public verify returns only projectId, title, clientName plus VerifyResult"
  - "No tamper route created (Phase 4)"
duration: ~10min
completed: 2026-10-03
---

# Phase 2 Plan 2: REST route handlers Summary

Seven Next 16 route handlers (nodejs runtime, force-dynamic, awaited async params, errors via errorResponse) over the plan-01 services, proven by a handler-level integration test: full 7-step flow, 429 with Retry-After, and 10 parallel decisions yielding exactly one 200 and nine 409 with a valid ledger.

## Tasks
1. Failing integration test (RED, missing route modules) - 3d7147a
2. Agency and public-read routes - 8790692
3. Review token routes with rate limiting, test green - c808c48

## Verification
- `npx vitest run`: 6 files, 49 tests pass
- `npx tsc --noEmit`: exit 0
- `npx next build`: succeeds; all 7 API routes listed as dynamic (ƒ)

## Deviations from Plan
- Test calls `listGET()` with no argument because the list handler takes no request (minor test tweak, assertions unchanged).

## Known Stubs
None.

## Self-Check: PASSED
