---
phase: 05-public-verify-export-tests-ship
plan: 01
subsystem: export-verifier
tags: [export, standalone-verifier, parity-tests, tamper, vitest]
requires: [01-02, 01-03]
provides:
  - "GET /api/verify/:id/export (public JSON attachment, format signseal-ledger-export/v1)"
  - "scripts/verify-chain.mjs (node:crypto/fs/url only; exports verifyExport, canonicalJson, preimage)"
  - "toExportDto (dto.ts), getExport (projects.ts)"
key-files:
  created:
    - src/app/api/verify/[id]/export/route.ts
    - src/app/api/export.api.test.ts
    - scripts/verify-chain.mjs
    - scripts/verify-chain.test.ts
    - src/lib/ledger/tamper-styles.test.ts
    - src/lib/ledger/restart.db.test.ts
  modified: [src/lib/services/dto.ts, src/lib/services/projects.ts, vitest.config.ts]
key-decisions:
  - "Export lives at /api/verify/:id/export (public namespace); document in README (plan 03)"
  - "CLI exit codes: 0 valid, 1 broken/declared mismatch/head mismatch, 2 usage or bad input"
  - "Export reports the stored head even when the chain is broken; the script judges it"
duration: ~10min
completed: 2026-10-03
requirements-pending: [EXPT-01, TEST-01]
---

# Phase 5 Plan 1: Export and standalone verifier Summary

Public chain export plus a zero-dependency verifier script, proven byte-identical to the app's hashing by parity tests, with both tamper styles, tail-truncation pinning and restart persistence covered.

## Tasks
1. Export service + public route - c7d5a5d (RED observed: suite failed on the missing route import before the route existed; first GREEN run also needed a test-data fix because the create schema requires at least 3 milestones)
2. scripts/verify-chain.mjs - 0cde987
3. Parity / tamper-styles / restart tests + vitest include widened - 2ed7f35

## Verification
- `npx vitest run`: 15 files, 119 tests pass (scripts test collected via widened include)
- `npx tsc --noEmit`: exit 0
- `npx next build`: exit 0, route `/api/verify/[id]/export` listed as dynamic
- Script: no args and missing file exit 2; seeded demo export exit 0; seedTampered export exit 1 at #2 (asserted in tests via spawnSync)

## TEST-01 gap review (what already existed vs added)
Already present, not duplicated: golden/shuffle/unicode-pipe canonicalJson (hash.test.ts), 7-step flow and 10-parallel style (api.integration.test.ts, ledger.db.test.ts incl. child-process concurrency), single self-hash tamper (ledger.db.test.ts), prev-link altered (verify.test.ts).
Added: script-vs-app parity (11 vectors, shuffle, non-finite, preimage), tamper style A vs style B (N vs N+1) at verifyChain level, head-entry rewrite is undetectable without a pin (documented), truncation with and without `--head`, declared headHash/length mismatch, exit-2 inputs, file-DB restart with identical head.

## Deviations from Plan
None of substance. Minor: vitest.config.ts was edited as the plan directed. Script's `--head` with no value exits 2.

## Known Stubs
None.

## Notes
- CLAUDE.md shows as modified in the working tree; this is the Next dev agent-rules block rewrite, not part of this plan, left uncommitted.
- Requirements EXPT-01 / TEST-01 intentionally NOT marked complete (per orchestrator).

## Self-Check: PASSED
Files exist; commits c7d5a5d, 0cde987, 2ed7f35 present.
