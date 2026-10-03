---
phase: 04-tamper-demo-visual-proof
plan: 01
subsystem: tamper-demo
tags: [sqlite, triggers, tamper, gate, seed, vitest]
requires: [01-03]
provides:
  - "src/lib/dev/gate.ts: tamperEnabled(), tamperDisabledError()"
  - "src/lib/dev/tamper.ts: tamperEntry(db, entryId), mutatePayload()"
  - "POST /api/dev/tamper/[entryId] (gated)"
  - "seedTampered(db): Legacy Audit (tampered), Broken at entry #2"
affects: [04-02, 04-03]
key-files:
  created: [src/lib/dev/gate.ts, src/lib/dev/tamper.ts, src/lib/dev/tamper.db.test.ts, "src/app/api/dev/tamper/[entryId]/route.ts", src/app/api/dev/tamper/tamper.api.test.ts]
  modified: [src/lib/seed.ts, scripts/seed.ts, src/lib/seed.db.test.ts]
key-decisions:
  - "entryId is the ledger_entries.id integer row id (documented in route header)"
  - "Drop/UPDATE/recreate runs in one .immediate() transaction on the app connection; trigger count asserted inside the tx, mismatch rolls back"
  - "Rollback proven via a Proxy db whose exec throws (or no-ops) on CREATE TRIGGER"
requirements-completed: []
completed: 2026-10-03
---

# Phase 4 Plan 1: Tamper helper, gated route, tampered seed Summary

Atomic tamper helper (drop update trigger, alter only payload_json, recreate triggers via the shared TRIGGERS_SQL, all in one immediate transaction), strict per-request gate with an explanatory 403, and a pre-tampered seed project.

## Tasks
1. Gate + tamper helper + DB tests - 013ffcf
2. Gated route + route tests - b8d2342
3. Seed "Legacy Audit (tampered)" - 01e0dbf

## Proof (requested)
- (a) verify Broken at tampered idx, later entries untrusted (idx 2 and idx 0 cases; route test too).
- (b) trigger count 2 before and after, including after unknown-id 404 and after rollback.
- (c) plain UPDATE and DELETE still throw "append-only" after tamper.
- (d) failure after DROP+UPDATE (exec throws on CREATE TRIGGER) and trigger-count mismatch both roll back: rows byte-identical, 2 triggers, chain still valid.
- Gate matrix: unset, false, empty, 1, TRUE, and true under NODE_ENV=production return 403 naming ENABLE_TAMPER_DEMO; 403 beats 404; ids abc/0/-1/1.5/missing return 404; only POST exported.

## Verification
`npx vitest run`: 9 files, 77 tests pass. `npx tsc --noEmit` clean. `npx next build` succeeds and lists the dev tamper route. `npx tsx scripts/seed.ts` on a temp DB printed "Seeded Legacy Audit (tampered): Broken at entry #2".

## Deviations from Plan
- Test fixtures use 3 milestones (project creation requires at least 3); no production change.
- tamper.ts is imported only by the route (dynamic) and src/lib/seed.ts (static), as required.

## Known Stubs
None.

## Notes
Requirements TAMP-01..03 intentionally NOT marked complete (phase finishes after 04-03). STATE.md/ROADMAP.md not modified by this run.

## Self-Check: PASSED
