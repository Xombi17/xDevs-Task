---
phase: 02-services-rest-api-seed
plan: 01
subsystem: api
tags: [zod, services, dto, rate-limit, sqlite, vitest]
requires: [01-03]
provides:
  - "src/lib/http/errors.ts: AppError, errorResponse, notFound/conflict/badJson/rateLimited/validation, fromLedgerError"
  - "src/lib/http/parse.ts: parseBody"
  - "src/lib/http/rate-limit.ts: rateLimit, resetRateLimit, decisionLimit"
  - "src/lib/services/{schemas,dto,projects,review}.ts"
affects: [02-02, 02-03]
key-files:
  created: [src/lib/http/errors.ts, src/lib/http/parse.ts, src/lib/http/rate-limit.ts, src/lib/services/schemas.ts, src/lib/services/dto.ts, src/lib/services/projects.ts, src/lib/services/review.ts, src/lib/services/services.db.test.ts]
key-decisions:
  - "fromLedgerError exported from errors.ts so services and errorResponse share one mapping"
  - "Review DTO omits project id and token; token only in agency detail DTO"
duration: ~10min
completed: 2026-10-03
---

# Phase 2 Plan 1: Services and HTTP helpers Summary

Atomic createProject (project + milestones + genesis entry in one transaction), IDOR-safe decide with 409 mapping, allow-list DTOs, zod 4 strict schemas, parseBody, AppError mapping and an in-memory sliding-window limiter. No route files touched.

## Tasks
1. Failing service tests (RED, module-not-found) - 0c31db9
2. HTTP helpers, schemas, DTOs, limiter - ad6975a
3. Services (GREEN; test tweak to await async getLedger) - ebb5f49

## Verification
`npx vitest run`: 5 files, 46 tests pass. `npx tsc --noEmit` exits 0.

## Deviations from Plan
- Task 2 committed before its limiter tests could pass (tests need Task 3 services to import); limiter cases pass after Task 3.
- getLedger/getVerify are async (verifyProject is async); test updated to await.

## Known Stubs
None.

## Self-Check: PASSED
