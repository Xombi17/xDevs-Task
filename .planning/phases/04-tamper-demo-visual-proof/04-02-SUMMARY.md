---
phase: 04-tamper-demo-visual-proof
plan: 02
subsystem: audit-ui
tags: [tamper-map, explain, web-crypto, vitest]
requires: [04-01]
provides:
  - "src/lib/ledger/explain.ts: explainFailure(result, contexts, milestones)"
  - "src/lib/ledger/browser-verify.ts: getWebCryptoHasher, compareVerify, runBrowserVerify"
  - "audit/tamper-map.tsx, failure-explanation.tsx, browser-reverify.tsx, events.ts (LEDGER_CHANGED_EVENT)"
affects: [04-03]
key-files:
  created: [src/lib/ledger/explain.ts, src/lib/ledger/explain.test.ts, src/lib/ledger/browser-verify.ts, src/lib/ledger/browser-verify.test.ts, "src/app/projects/[id]/audit/events.ts", "src/app/projects/[id]/audit/tamper-map.tsx", "src/app/projects/[id]/audit/failure-explanation.tsx", "src/app/projects/[id]/audit/browser-reverify.tsx"]
  modified: ["src/app/projects/[id]/audit/verify-button.tsx", "src/app/projects/[id]/audit/page.tsx"]
key-decisions:
  - "brokenAt used 0-based as returned, no arithmetic anywhere"
  - "Browser re-verify reuses verifyChain with a Web Crypto hasher (second SHA-256 implementation, not an independent verifier)"
  - "Explain context built server-side from ledger payload + milestone id/title/status only (no review token to client)"
requirements-completed: []
completed: 2026-10-03
---

# Phase 4 Plan 2: Tamper map, failure explanation, browser re-verify Summary

Verify now renders a green/red/amber tamper map (text labels OK / BROKEN / UNTRUSTED (downstream of #N), expected vs stored full hashes with an "≠" marker on the broken row, legend, mobile-stacked), a best-effort failure explanation with milestone cross-check, and a "Re-verify in browser" panel that recomputes via crypto.subtle and reports "Agrees with server" / "Differs from server" or a secure-context fallback message.

## Tasks
1. Pure explain + browser-verify modules with tests - 4bbaeb8
2. Tamper map / explanation / re-verify UI wired into VerifyButton and page - fc29ae3

## Verification
- `npx vitest run`: 11 files, 92 tests pass (15 new: self-hash, prev-link, index/project, null on valid, plural/singular untrusted, milestone disagree/match/unknown, unavailable, digest rejection, agree on intact and tampered chain, disagree on altered server result).
- `npx tsc --noEmit` clean. `npx next build` succeeds.
- Greps: no dangerouslySetInnerHTML, no `lib/dev` import in audit dir, no `node:` in explain/browser-verify, no arithmetic on brokenAt.
- Manual: seeded temp DB, `next start`; GET /api/projects/<Legacy Audit id>/verify returned valid:false, brokenAt 2; audit page returned 200. Browser click-through not performed (no browser available to executor).
- VerifyButton listens for LEDGER_CHANGED_EVENT and re-runs verify (guarded against concurrent runs) for plan 03.

## Deviations from Plan
None of substance. Test stubs use `null` (not `undefined`) for a missing crypto, since `undefined` triggers the default parameter.

## Known Stubs
None.

## Notes
Requirements AUDT-03/04/05 intentionally NOT marked complete; STATE.md/ROADMAP.md not modified.

## Self-Check: PASSED
