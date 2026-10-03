---
phase: 05-public-verify-export-tests-ship
plan: 02
subsystem: public-verify-receipt
tags: [verify, receipt, public-page, smoke]
requires: [05-01]
provides:
  - "/verify/[id] public page (status banner, head hash, TamperMap, browser re-verify, export link, receipt check, chain with #entry-N anchors)"
  - "src/lib/receipt.ts buildReceipt/checkReceipt (pure, client-safe)"
  - "getPublicSummary (explicit column SELECT, never loads review_token)"
key-files:
  created: [src/lib/receipt.ts, src/lib/receipt.test.ts, src/lib/services/receipt.db.test.ts, src/lib/services/public.ts, "src/app/verify/[id]/page.tsx", "src/app/verify/[id]/not-found.tsx", "src/app/verify/[id]/receipt-check.tsx"]
  modified: [src/lib/services/review.ts, "src/app/review/[token]/review-panel.tsx", "src/app/projects/[id]/audit/page.tsx", scripts/smoke-ui.mjs]
key-decisions:
  - "checkReceipt takes (input, entries, projectId): project match is enforced by the caller-supplied id"
  - "Receipt fields: format signseal-receipt/v1, projectId, index, hash, actor, timestamp, action, verifyPath"
  - "Public API route /api/verify/:id left unchanged"
completed: 2026-10-03
requirements-pending: [AUDT-06, REVW-05]
---

# Phase 5 Plan 2: Public verify page and receipts Summary

Login-free /verify/[id] with Valid / "Broken at entry #N" banner and a pasted-receipt checker, plus a downloadable client-side JSON receipt on the review page, with the token provably absent from every public surface.

## Tasks
1. Receipt helpers, decide() receipt now has projectId/action/actor, token-leak tests (RED observed: both suites failed on missing modules) - b917ff6
2. Public verify page, not-found, audit-page link, ReceiptCheck component - ead0c9f
3. Receipt block (entry, full hash, actor, time, public link, Blob download with revokeObjectURL), smoke checks - see git log (third commit)

## Verification
- `npx vitest run`: 17 files, 129 tests pass
- `npx tsc --noEmit`: exit 0
- `npx next build`: exit 0, /verify/[id] dynamic
- `npm run smoke:ui`: all checks pass (valid verify, Broken at entry #2 for seeded tampered project, 404, token absent from page and API, export link, noindex)

## Deviations from Plan
- [Rule 3] receipt-check.tsx was committed with Task 2 (not Task 3) because the page imports it; Task 3 still covers the receipt UI and smoke. getPublicSummary was created in Task 1 because the DB test imports it.
- Smoke asserts no "DEMO ONLY" instead of no "tamper" text, since the reused TamperMap carries an aria-label "Tamper map" (component reused unchanged per plan).
- Plan's acceptance `grep -c createObjectURL` = 1: count is 1 for create and 1 for revoke (2 lines matching either).

## Known Stubs
None.

## Notes
- CLAUDE.md remains modified (Next agent rules block), not part of this plan, uncommitted.
- Requirements AUDT-06 / REVW-05 intentionally NOT marked complete (per orchestrator). STATE/ROADMAP not updated.

## Self-Check: PASSED
