# SignSeal

## What This Is

SignSeal is a lightweight web app for small digital agencies. The agency creates a project with milestones and shares a private, login-free review link with the client. Every approval or change request is appended to a per-project **hash-chained ledger** (tamper-evident audit trail) that anyone can verify. Built as THE xDEVS Full-Stack Intern take-home (~2h, AI allowed, GitHub submission). Full detail: `docs/SPEC.md`.

## Core Value

The full demo flow works end to end: create project -> client link -> approve / request changes -> audit trail -> Verify says **Valid** -> tamper demo -> Verify says **Broken at entry #N**.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] R1 Create project (title, client, >=3 milestones, validation)
- [ ] R2 Dashboard with progress + status badge; project page with milestone statuses and "Copy client link"
- [ ] R3 Unguessable `/review/:token` client link, no login, name + approve / request changes (note required)
- [ ] R4 Append-only per-project hash-chained ledger: `SHA256(index|timestamp|action|actor|JSON(payload)|prevHash)`, genesis prevHash = 64 zeros
- [ ] R5 Audit page timeline + Verify integrity ("Valid" / "Broken at entry #N")
- [ ] R6 Clearly labelled dev-only tamper demo
- [ ] R7 REST API + persistent DB, server-side validation, sensible HTTP codes
- [ ] R8 Responsive UI with loading, empty, error states
- [ ] R9 README (setup, stack, hash computation, improvements)
- [ ] U1 Tamper map (green / red / amber blocks, expected vs stored hash)
- [ ] U2 Browser-side re-verify (Web Crypto)
- [ ] U3 Public verify page `/verify/:id`
- [ ] U4 Field-level diff on verification failure
- [ ] U5 Decide-once rule (409 on repeat decision)
- [ ] U6 Seed script for "Website Redesign" demo project
- [ ] U7 Client receipt (entry index + hash, JSON download)
- [ ] U8 JSON export of chain + standalone verify script
- [ ] Tests (hash/verify unit, full demo-flow integration), Docker compose, `.env.example`

### Out of Scope

- Agency authentication / multi-tenancy — brief requires none; single-tenant
- Wallets, tokens, smart-contract logic in core flow — core needs only SHA-256
- Real personal data or secrets in repo — disallowed by brief
- Sepolia anchor, live deploy, demo video — stretch bonus, only after R1–R9 + U1–U8 (later phase)

## Context

- Scoring: core flow 35, ledger/integrity 20, backend 15, UI/UX 15, code+README 10, interview 5; +20 bonus (Sepolia +8, deploy +4, export/public verify +4, extras +4).
- Interview may require explaining the hash logic — keep code readable.
- Working beats perfect: R1–R6 end to end before polish or bonus.
- Known limit to document: hash chain alone can't detect tail truncation; show head hash, optionally anchor on-chain.

## Constraints

- **Time**: ~2 hours target — scope aggressively, ship working first
- **Stack**: Next.js (App Router) + TypeScript + Tailwind, SQLite (better-sqlite3), Node crypto, Vitest, Docker — chosen for single-repo, fast deploy
- **Integrity**: Ledger append in one DB transaction with UNIQUE(project_id, idx); SQLite triggers block UPDATE/DELETE; canonical (key-sorted) JSON for hashing; stored exact ISO timestamp
- **Security**: >=128-bit random review token, zod validation on all inputs, tamper endpoint gated by `NODE_ENV !== production` + env flag, no secrets committed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js + SQLite monorepo | One repo/deploy, zero external services, fast to demo | — Pending |
| Canonical JSON for payload hashing | Deterministic hashes regardless of key order | — Pending |
| DB triggers + transaction for immutability | Enforces append-only below the app layer | — Pending |
| Server verify + browser re-verify | Shows trust model; strongest demo moment | — Pending |
| Defer Sepolia/deploy to final phase | Bonus must not risk core R1–R6 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-03 after initialization*
