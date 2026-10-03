---
phase: 01-ledger-core
plan: 03
subsystem: database
tags: [sqlite, better-sqlite3, triggers, hash-chain, transactions, vitest]
requires: [01-01, 01-02]
provides:
  - "src/lib/db/ddl.ts: SCHEMA_SQL, TRIGGERS_SQL, TRIGGER_NAMES (single DDL source)"
  - "src/lib/db/index.ts: openDb(path), getDb() globalThis singleton"
  - "src/lib/ledger/append.ts: append (immediate tx), LedgerError"
  - "src/lib/ledger/chain.ts: getEntries, verifyProject, sha256Hex"
  - "src/lib/ledger/token.ts: generateToken"
affects: [phase-2-api, phase-4-tamper]
key-files:
  created: [src/lib/db/ddl.ts, src/lib/db/index.ts, src/lib/ledger/append.ts, src/lib/ledger/chain.ts, src/lib/ledger/token.ts, src/lib/ledger/ledger.db.test.ts, src/lib/ledger/append-worker.fixture.ts]
key-decisions:
  - "sha256Hex lives in chain.ts (node-only); append.ts imports it from there"
  - "Rollback test forces a CHECK violation on the milestone UPDATE, which runs after the ledger INSERT"
duration: ~10min
completed: 2026-10-03
requirements-completed: [LEDG-01, LEDG-02, LEDG-03, LEDG-04, LEDG-05, LEDG-06]
---

# Phase 1 Plan 3: DB layer and single writer Summary

Shared DDL with append-only triggers, HMR-safe DB singleton, `.immediate()` single-writer `append` with decide-once, chain loader/verifier and token generator, proven on real SQLite files.

## Tasks
1. DDL + singleton - f5604df
2. append, chain, token - 6cd877c (tdd flag dropped; tests written in Task 3)
3. DB-backed tests - 4b22ce6

## Verification
`vitest run`: 4 files, 36 tests pass. `tsc --noEmit` and `next build` exit 0. No stray `*.db` in the repo root.

## Concurrency test honesty
- "sequential interleave across two connections": deterministic A,B,A,B alternation on two handles to one file. NOT true parallelism (better-sqlite3 is synchronous).
- "separate OS processes": 3 child processes (`node --import tsx`, fixture `append-worker.fixture.ts`) each append 15 entries to the same file concurrently; asserts idx exactly 0..44 and valid verify. This is real contention (busy_timeout + immediate lock).

## Deviations from Plan
- [Plan-checker] Rollback test uses a CHECK-violating milestone status (failure after INSERT) instead of NaN payload; NaN case kept as an extra test.
- [Plan-checker] Added child-process concurrency variant and fixture file.
- [Plan-checker] Task 2 committed without tdd; tests in Task 3.
- Imports use `@/` throughout.

## Known Stubs
None.

## Self-Check: PASSED
