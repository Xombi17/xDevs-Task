---
phase: 02-services-rest-api-seed
plan: 03
subsystem: seed
tags: [seed, tsx, idempotent, vitest]
requires: [02-01]
provides:
  - "src/lib/seed.ts: seedDemo(db) idempotent, title-guarded"
  - "scripts/seed.ts + npm run seed"
affects: []
key-files:
  created: [src/lib/seed.ts, scripts/seed.ts, src/lib/seed.db.test.ts]
  modified: [package.json]
key-decisions:
  - "Idempotency guard is SELECT by title 'Website Redesign'; no writes when present"
duration: ~5min
completed: 2026-10-03
---

# Phase 2 Plan 3: Seed Summary

Idempotent `seedDemo` builds "Website Redesign" (4 milestones; 2 approved, 1 changes requested, 1 pending, all by Jane Doe) strictly via createProject/decide, so every ledger row comes from the real append path.

## Tasks
1. Failing seed test (RED) - 56dc3d0
2. seedDemo, CLI script, npm run seed (GREEN) - see git log (feat(02-03))

## Verification
`npx vitest run`: 7 files, 51 tests pass. `npx tsc --noEmit` exits 0. `npm run seed` twice on a temp DB_PATH: first "Seeded Website Redesign" + review link, second "Already seeded". Temp DB deleted. No `INSERT INTO ledger_entries` in seed files.

## Deviations from Plan
None - plan executed exactly as written.

## Known Stubs
None.

## Self-Check: PASSED
