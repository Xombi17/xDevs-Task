---
phase: 04-tamper-demo-visual-proof
plan: 03
subsystem: audit-ui
tags: [tamper-demo, dialog, dev-launcher, smoke]
requires: [04-01, 04-02]
provides:
  - "audit/demo-banner.tsx, audit/tamper-button.tsx (native dialog confirm, POST, LEDGER_CHANGED_EVENT, router.refresh)"
  - "scripts/dev-demo.mjs and npm run dev:demo"
affects: []
key-files:
  created: ["src/app/projects/[id]/audit/demo-banner.tsx", "src/app/projects/[id]/audit/tamper-button.tsx", scripts/dev-demo.mjs, .claude/launch.json]
  modified: ["src/app/projects/[id]/audit/page.tsx", package.json, .env.example, scripts/smoke-ui.mjs]
key-decisions:
  - "Row ids are queried only when tamperEnabled() and passed only to TamperButton; public ledger DTO unchanged"
  - "Page imports only lib/dev/gate, never lib/dev/tamper"
requirements-completed: [TAMP-01, TAMP-02, TAMP-03, AUDT-03, AUDT-04, AUDT-05]
completed: 2026-10-03
---

# Phase 4 Plan 3: Tamper UI, dev:demo, smoke Summary

DEMO ONLY banner plus per-entry "Tamper (DEMO ONLY)" button with a confirm dialog (Cancel autofocused), rendered only when the server gate is open; confirming POSTs, fires LEDGER_CHANGED_EVENT so Verify re-runs, and refreshes the timeline.

## Tasks
1. Banner and tamper button - 3f81c1f
2. Page wiring behind tamperEnabled() - 2db5aaa
3. dev:demo launcher, .env.example docs, production smoke assertions - 3ce9f5e
4. .claude/launch.json committed - bf6f9e7

## Verification
- `npx vitest run` 92 pass; `npx tsc --noEmit` clean; `npx next build` ok; `npm run smoke:ui` all pass (403 + ENABLE_TAMPER_DEMO text, Legacy Audit Broken at 2, no tamper UI in production HTML, Website Redesign valid).
- `NODE_ENV=production node scripts/dev-demo.mjs` exits 1.
- next dev, flag true: audit HTML (scripts stripped) contains "DEMO ONLY" and 4 "Tamper (DEMO ONLY)" buttons (one per entry); POST /api/dev/tamper/1 returned 200 and verify then returned valid:false. Flag false: neither string present.
- Not performed: browser click-through of the dialog (no browser available); dialog logic type-checked only.

## Deviations from Plan
- Plan cited `/api/verify/:id`; the real route is `/api/projects/:id/verify`, used in smoke checks.

## Known Stubs
None.

## Self-Check: PASSED
