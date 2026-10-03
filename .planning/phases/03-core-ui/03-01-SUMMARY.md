---
phase: 03-core-ui
plan: 01
subsystem: ui
tags: [tailwind4, next16, design-tokens, dashboard]
requires: [02-01]
provides:
  - "globals.css @theme tokens (accent, ok/warn/bad, fonts), .btn/.btn-primary/.btn-secondary/.skeleton"
  - "App shell layout with skip link, SignSeal header, New project button"
  - "src/components/ui: StatusBadge, CopyButton, CopyLinkButton, HashText, Card, EmptyState"
  - "src/lib/format.ts: shortHash, formatDateTime (UTC), plural"
  - "Dashboard /, loading.tsx, error.tsx, not-found.tsx"
affects: [03-02, 03-03]
key-files:
  created: [src/lib/format.ts, src/components/ui/*.tsx, src/app/loading.tsx, src/app/error.tsx, src/app/not-found.tsx]
  modified: [src/app/globals.css, src/app/layout.tsx, src/app/page.tsx]
key-decisions:
  - "Shared .btn classes in @layer components so links and buttons look identical"
  - "CopyLinkButton reads window.location.origin only in click handler"
completed: 2026-10-03
---

# Phase 3 Plan 1: Design system, shell, dashboard Summary

Indigo/slate "ledger paper" design system (dot-grid canvas, seal glyph, semantic emerald/amber/rose badges with text labels), app shell, shared primitives, and a dynamic dashboard reading `listProjects(getDb())` with progress bars, empty state and global loading/error/not-found.

## Tasks
1. Tokens, shell, format helpers - ecbd0e5
2. UI primitives - 6a32e6f
3. Dashboard + global states - 3ee33bc

## Verification
`npx vitest run` 7 files / 51 tests pass; `npx tsc --noEmit` clean; `npx next build` succeeds with `/` dynamic; no dangerouslySetInnerHTML in src.

## Deviations from Plan
Minor additions only: `.btn` utility classes, `variant` prop on CopyButton, viewport export, progress bar turns amber when changes requested, created-at line on cards. No rule-triggering deviations.

## Known Stubs
None.

## Self-Check: PASSED
