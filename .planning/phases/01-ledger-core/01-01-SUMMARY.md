---
phase: 01-ledger-core
plan: 01
subsystem: infra
tags: [nextjs, tailwind4, vitest, better-sqlite3, zod]
requires: []
provides:
  - Installable Next 16 / React 19 / Tailwind 4 project with passing vitest and next build
  - "@/ alias configured in vitest.config.ts and tsconfig.json"
affects: [01-02, 01-03]
tech-stack:
  added: [next 16.3.8, react 19.3.0, zod 4.6.5, better-sqlite3 13.0.3, vitest 5.0.3, tailwindcss 4.3.3, typescript 5.9.x, tsx]
  patterns: [Tailwind CSS-first, vitest resolve.alias, serverExternalPackages for sqlite]
key-files:
  created: [package.json, package-lock.json, tsconfig.json, next.config.ts, postcss.config.mjs, vitest.config.ts, .env.example, src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, src/lib/smoke.test.ts]
  modified: [.gitignore]
key-decisions:
  - "@types/node pinned ^24 and TypeScript ~5.9.3 per STACK.md, not registry latest"
duration: ~10min
completed: 2026-10-03
---

# Phase 1 Plan 1: Scaffold Summary

Hand-written Next 16 + Tailwind 4 + Vitest 5 scaffold with better-sqlite3 native binary verified loading on Node 24.

## Tasks
1. Package manifest, configs, install - e58b833
2. App shell, Tailwind entry, smoke test - 1f68b0b

## Deviations from Plan
- Minor: `next build` auto-added `.next/dev/types/**/*.ts` to tsconfig include; committed with Task 2.
- .gitignore also gained `data/`, `next-env.d.ts`, `*.tsbuildinfo`.
- npm warned esbuild postinstall script is not in allowScripts; tests and build work regardless.

## Known Stubs
- src/lib/smoke.test.ts has a TODO: plan 02 should import a real module via `@/` once src/lib/ledger/hash.ts exists (no real module existed yet; alias is only configured, not exercised).

## Verification
All `npm view` names confirmed existing. `vitest run` (1 passed), `next build`, `tsc --noEmit` all exit 0.

## Self-Check: PASSED
