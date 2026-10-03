---
phase: 05-public-verify-export-tests-ship
plan: 03
subsystem: docker-readme
tags: [docker, compose, readme, smoke]
requires: [05-01, 05-02]
provides:
  - "Next standalone output with better-sqlite3 prebuilds; seed.mjs bundle (npm run build:seed)"
  - "Multi-stage node:24-slim Dockerfile (deps/build/dev/runner), non-root runner, /app/data volume, seeding entrypoint"
  - "docker-compose.yml: default app service and demo profile (port 3001, separate volume)"
  - "scripts/smoke-flow.mjs (npm run smoke:flow)"
  - "README.md"
key-files:
  created: [Dockerfile, .dockerignore, docker-entrypoint.sh, docker-compose.yml, scripts/smoke-flow.mjs, README.md]
  modified: [next.config.ts, package.json, .env.example, .gitignore]
key-decisions:
  - "better-sqlite3 13 ships prebuilds/*.node (no build/Release), so outputFileTracingIncludes targets prebuilds and lib"
  - "seed bundled with transitive esbuild 0.28.2 (via tsx); no new dependency installed"
  - "smoke-flow demo mode checks tamper on a nonexistent id (not 403) so it is non-destructive"
completed: 2026-10-03
requirements-completed: [DOCS-01, DOCS-02]
---

# Phase 5 Plan 3: Docker, compose and README Summary

Standalone Next build carrying the better-sqlite3 native binary, a non-root multi-stage node:24-slim image definition with first-start seeding and a volume, a compose file with a gated demo profile, an HTTP smoke-flow script and an accurate README.

## Docker honesty statement

**Docker did NOT actually run.** `docker info`/`docker build` failed with "permission denied while trying to connect to the docker API at unix:///var/run/docker.sock". Only `docker compose config -q` and `docker compose config --profiles` (lists `demo`) ran, which are static. The image build, `docker compose up`, volume persistence in compose and the demo profile were NOT executed. No containers, images or volumes were created, so nothing needed cleanup. README states this.

Fallback verification actually performed:
- `npm run build` produced `.next/standalone` containing `better-sqlite3/prebuilds/linux-x64.node` (and other platforms).
- `seed.mjs` ran, then `node .next/standalone/server.js` (NODE_ENV=production) served `/` 200; `npm run smoke:flow` passed all 15 checks, including tamper 403.
- Restarted the standalone server on the same DB file: 3 projects still present, Website Redesign and the new project Valid, Legacy Audit Broken (persistence).
- `npm run dev:demo` on port 3211 with `EXPECT_TAMPER=enabled npm run smoke:flow`: all checks passed (tamper not 403).

## Tasks
1. Standalone config, seed bundle, Dockerfile, entrypoint, dockerignore - 5cef3d4
2. docker-compose.yml, .env.example, smoke-flow script - 04c14a7
3. README.md - e9a6acc

## Deviations from Plan

**1. [Rule 1 - Bug] Tracing include paths** - plan assumed `build/Release/*.node`; better-sqlite3 13 uses `prebuilds/`. Config adjusted. Commit 5cef3d4.
**2. [Rule 3] Docker unusable** - fell back as the plan allows (see above).
**3. [Rule 2] .gitignore** - added generated `seed.mjs`.
**4. Dev stage ownership** - dev image chowns /app so `next dev` (user node) can create `.next`. Untested because the image was never built.

## Known Stubs
None.

## Verification
`npx vitest run` 129/129 passed, `npx tsc --noEmit` clean, `npx next build` ok, `npm run smoke:ui` all PASS.

## Self-Check: PASSED
Files exist (Dockerfile, docker-compose.yml, docker-entrypoint.sh, .dockerignore, scripts/smoke-flow.mjs, README.md); commits 5cef3d4, 04c14a7, e9a6acc exist.
