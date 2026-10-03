---
phase: 03-core-ui
plan: 02
subsystem: ui
tags: [next16, forms, zod, audit-timeline, verify]
requires: [03-01]
provides:
  - "/projects/new client form (zod inline errors, 3..20 milestones)"
  - "/projects/[id] detail with milestone badges, Copy client link, audit link"
  - "/projects/[id]/audit timeline, head hash, count, Verify integrity"
  - "data-slot=tamper-controls placeholder for Phase 4"
affects: [03-03, 04]
key-files:
  created:
    - src/app/projects/new/page.tsx
    - src/app/projects/new/new-project-form.tsx
    - src/app/projects/[id]/page.tsx
    - src/app/projects/[id]/loading.tsx
    - src/app/projects/[id]/not-found.tsx
    - src/app/projects/[id]/audit/page.tsx
    - src/app/projects/[id]/audit/verify-button.tsx
    - src/app/projects/[id]/audit/loading.tsx
key-decisions:
  - "Single numbering convention: 0-based ledger index shown as #N everywhere; brokenAt rendered unchanged"
  - "Tamper slot section uses empty:hidden so it takes no space until Phase 4 fills it"
  - "Verify result shows per-entry chips linking to #entry-N anchors on the timeline"
completed: 2026-10-03
---

# Phase 3 Plan 2: Agency pages Summary

Create-project form, project detail with copyable client link, and an audit page with oldest-first hash timeline and a Verify integrity control that reports "Valid" or "Broken at entry #N" using the API's 0-based brokenAt.

## Tasks
1. New project form - 56e66b2
2. Project detail page - 5f9bf6b
3. Audit page + Verify integrity - 07cdb3f

## Verification
- `npx vitest run`: 7 files / 51 tests pass
- `npx tsc --noEmit`: clean
- `npx next build`: succeeds; `/projects/new` (static), `/projects/[id]` and `/projects/[id]/audit` (dynamic) listed
- Smoke test on `next start`: POST /api/projects then GET /projects/new, /projects/:id, /projects/:id/audit return 200

## Deviations from Plan
None requiring a rule. Small additions: progress bar on detail page, entry chips link to timeline anchors, per-milestone Remove has aria-label.

## Notes
- Unknown project id renders the not-found UI but responds HTTP 200 (Next streams after loading.tsx has flushed). Cosmetic; API still returns 404.
- Threat mitigations: React text nodes only (no dangerouslySetInnerHTML); reviewToken only passed to CopyLinkButton path, not rendered as text; server re-validates the form (422 mapped to inline errors).
- Requirements PROJ-04, AUDT-01, AUDT-02, UI-01 intentionally NOT marked complete (per orchestrator).

## Known Stubs
None (tamper slot is an intentional, documented empty placeholder for Phase 4).

## Self-Check: PASSED
