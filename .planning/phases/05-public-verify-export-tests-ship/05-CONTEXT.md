# Phase 5: Public Verify, Export, Tests & Ship - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning
**Mode:** Pre-decided from docs/SPEC.md + research (discuss skipped; all choices locked below)

<domain>
## Phase Boundary

Submission-ready.

</domain>

<decisions>
## Implementation Decisions

### Scope
`/verify/[id]` public (no token leak), receipt page + JSON download after deciding, JSON export with head hash, zero-dependency `scripts/verify-chain.mjs`, full test pass, Dockerfile (node:24-slim, standalone, volume) + compose with demo profile, `.env.example`, README (setup, stack, hash formula, canonical rule, limits: tamper-evident not tamper-proof, truncation; tamper-demo instructions; improvements). Smoke-test Docker through demo steps 1-6.

## Locked decisions (from docs/SPEC.md and .planning/research/SUMMARY.md — do not re-litigate)
- Stack: Node 24, Next 16, React 19, TS ~5.9, Tailwind 4, zod 4, better-sqlite3 (raw SQL, no ORM), Vitest 5.
- Hash: SHA-256 over `index|timestamp|action|actor|canonicalJSON(payload)|prevHash`; genesis prevHash 64 zeros; reject `|` in actor; store exact ISO timestamp and canonical payload string; idx 0-based in storage/API.
- Single writer `append` in `.immediate()` transaction; decide-once 409 inside it; UNIQUE(project_id, idx); triggers block UPDATE/DELETE.
- Tamper = drop trigger, UPDATE payload_json, recreate trigger in ONE transaction (not a separate connection).
- Review token = randomBytes(32) base64url; never exposed on public endpoints.
- Status codes: 400 malformed JSON, 422 validation, 404, 409, 403, 429.
- VerifyResult: `{valid, headHash, length, brokenAt?, entries:[{index,status ok|broken|untrusted,expectedHash,storedHash}]}`; amber = downstream/untrusted.
- Time budget small: working end to end beats polish. Commit atomically. Keep hash logic readable (interview).

### Claude's Discretion
File layout, naming, minor UI styling, test organisation.

</decisions>

<canonical_refs>
- docs/SPEC.md
- .planning/PROJECT.md, REQUIREMENTS.md, ROADMAP.md
- .planning/research/SUMMARY.md, ARCHITECTURE.md, PITFALLS.md, STACK.md
</canonical_refs>

<deferred>
## Deferred Ideas
Sepolia anchor, deploy, demo video, link expiry/revoke (v2).
</deferred>
