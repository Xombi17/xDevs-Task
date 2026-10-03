# Project Research Summary

**Project:** SignSeal (tamper-evident client approval ledger)
**Domain:** Login-free client sign-off tool backed by a per-project SHA-256 hash-chained audit ledger
**Researched:** 2026-10-03
**Confidence:** MEDIUM-HIGH

## Executive Summary

The agency creates a project with milestones; the client gets an unguessable link and approves or requests changes without login. Every event is appended to a per-project hash chain `sha256(index|timestamp|action|actor|canonicalPayload|prevHash)` that anyone can verify on the server, in the browser, or offline. Competing proofing/e-sign tools ask you to trust their database; SignSeal's differentiator is independently checkable integrity. Demo ends: Valid -> tamper -> "Broken at entry #N".

Build the ledger first, UI last. One pure isomorphic module (`lib/ledger/hash.ts` + `verify.ts`) holds canonical JSON, preimage and `verifyChain`; server, browser re-verify, Vitest and export script all import it. One writer, `ledger.append`, in a `BEGIN IMMEDIATE` transaction (read head, decide-once check, insert, milestone update). Append-only enforced with SQLite triggers. Stack: Next.js 16 route handlers over services, better-sqlite3 raw SQL, zod 4, Tailwind 4, Vitest. Sepolia anchor is a last-phase stretch in an isolated `contracts/` package.

Main risks: ambiguous preimage, canonical-JSON drift, timestamp drift, concurrent appends, and a tamper gate failing under `next start`/Docker. A hash chain cannot detect tail truncation or a full re-chain: mitigate by showing head hash + count everywhere, receipts/exports, and README wording "tamper-evident, not tamper-proof".

## Cross-Cutting Decisions (resolve in requirements, before coding)

| Decision | Recommendation |
|----------|----------------|
| Tamper bypass | Drop trigger, UPDATE, recreate trigger inside ONE transaction on the app connection (a second connection does NOT bypass triggers; contradicts SPEC wording). Shared trigger DDL constant. Tamper only `payload_json`, never the hash. |
| U4 field diff | Best-effort: report which check failed (self-hash vs prevHash link), expected vs stored hash, cross-reference `milestones`. True field diff needs an exported baseline. |
| Amber meaning | "Downstream of the break, untrusted" — later entries individually recompute fine. Red = broken entry. Test both tamper styles. |
| Tamper gate vs prod demo | `NODE_ENV !== 'production' && ENABLE_TAMPER_DEMO === 'true'` (strict), enforced server-side. Document dev/compose-demo path; seed a pre-tampered second project so Broken is demonstrable in any mode. |
| Preimage `\|` ambiguity | Reject `\|` in `actor` via zod. ONE `preimage()` function. Record in README. |
| Review token | `randomBytes(32).toString('base64url')`, UNIQUE, one `generateToken()`. Never expose token from public endpoints (DTO allow-lists). |
| Toolchain | TypeScript ~5.9.3 (7.x unverified), Node 24 (min 22.12). |
| Status codes | 400 malformed JSON; 422 zod/semantic failures via one `parseBody` helper; 404 unknown project/token/entry (same body); 409 already decided; 403 tamper blocked; 429 rate limited. |
| Entry numbering | idx 0-based in storage/hash/API (`brokenAtIndex`); UI shows one consistent convention with explicit mapping. Hash `String(idx)` decimal. |

## Stack (see STACK.md)
Node 24; Next 16.3.8 (Turbopack default, async `params`, `runtime='nodejs'`, `dynamic='force-dynamic'`); React 19.3; TS 5.9; Tailwind 4.3; zod 4.6; better-sqlite3 13 (raw SQL, no ORM); `node:crypto` + Web Crypto with hand-written canonicalJson; Vitest 5 (node env, call handlers directly); Docker `node:24-slim`; bonus: viem 2.57, Hardhat 3.18 in `contracts/`.

## Features (see FEATURES.md)
**Must:** R1–R9, decide-once 409 (U5), seed via real append path (U6), unit tests + 7-step integration test.
**Should:** tamper map (U1), browser re-verify (U2), public verify (U3), receipt (U7), export + standalone verify script (U8), prominent head hash, best-effort U4, Docker compose, rate limiting.
**Defer:** Sepolia anchor, deploy, link expiry/revoke, activity feed. **Anti:** auth/multi-tenancy, email, editable milestones/ledger, legal e-signature claims, raw IP/PII in payloads, tamper endpoint in prod.

## Architecture (see ARCHITECTURE.md)
Thin route handlers (zod parse -> service -> AppError->status). `lib/ledger/` DB-free hash/verify. `append.ts` sole inserter. Verify returns `{valid, headHash, length, brokenAt?, entries:[{index,status ok|broken|untrusted,expectedHash,storedHash}]}` — fix this shape in Phase 1 (serves U1–U4). `globalThis` DB singleton, lazy schema, WAL, FK on, busy_timeout. Server components call services directly.

## Critical Pitfalls (see PITFALLS.md, 18 total)
1. Canonical JSON / timestamp drift — shared module, golden vectors, store exact ISO + canonical payload string, no schema defaults on hashed columns.
2. Concurrent append / decide-once races — single immediate transaction, no await inside; 10-parallel-decisions test (1x201, 9x409, valid chain).
3. Weak verify — check contiguous idx, genesis, project ownership, recompute, linkage, milestone state vs replay; document truncation/re-chain limits.
4. Unsafe tamper path — drop/UPDATE/recreate atomically; assert trigger count unchanged and plain UPDATE still throws afterwards.
5. Token leak / IDOR — 256-bit token, DTO allow-lists, `AND project_id = ?`, zod `.strict()`, no-referrer + noindex on review page.

## Roadmap Implications (six phases, ledger-first)
1. **Scaffold, Schema, Triggers, Ledger Core** — Next scaffold, hash.ts + golden vectors, verify.ts + VerifyResult shape, schema, triggers, DB singleton, `ledger.append`, `generateToken`.
2. **Services, REST API, Seed** — R1, R3, R7, U5, U6; parseBody/AppError, IDOR, rate limiter, DTOs, idempotent seed (+ pre-tampered project), integration + concurrency tests.
3. **Core UI** — R2, R3, R5, R8: dashboard, new project, project page + Copy link, review page, audit timeline + server Verify, loading/empty/error states, head hash.
4. **Tamper Demo, Tamper Map, Browser Re-verify** — R6, U1, U2, U4 (prototype trigger flow first).
5. **Public Verify, Export, Receipt, Docker, Tests, README** — U3, U7, U8, R9; Docker smoke test early in the phase.
6. **Sepolia Anchor (bonus)** — own research first (Hardhat 3); never block normal append.

Cut order if time runs out: Phase 6, then U4, then U7. Never cut verify, triggers or the tamper flow.

**Research flags:** Phase 4 tamper prototype; Phase 6 Sepolia/Hardhat 3; light Phase 1 checks (`serverExternalPackages`, async params, zod 4, Tailwind 4 postcss, `@types/better-sqlite3` coverage).

## Confidence
Stack HIGH (versions) / MEDIUM (API details); Features MEDIUM; Architecture HIGH (ledger/SQLite) / MEDIUM (Next); Pitfalls MEDIUM. Overall MEDIUM-HIGH.

## Gaps
Tamper mechanism vs SPEC wording; token size 24 vs 32 bytes (use 32); preimage `|` and numbering base; U4 scope; production-build demo path; Next 16 standalone tracing of `.node` binary; Sepolia stack research; whether public verify page shows ledger notes.

---
*Research completed: 2026-10-03*
