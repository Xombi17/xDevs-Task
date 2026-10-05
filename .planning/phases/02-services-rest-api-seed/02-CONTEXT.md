# Phase 2: Services, REST API & Seed - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning
**Mode:** Pre-decided from docs/SPEC.md + research (discuss skipped; all choices locked below)

<domain>
## Phase Boundary

The full demo flow works through the REST API.

</domain>

<decisions>
## Implementation Decisions

### Scope
Services over `append`; route handlers (`runtime='nodejs'`, `dynamic='force-dynamic'`, async params); `parseBody` + AppError mapping (400 malformed JSON, 422 zod, 404, 409, 403, 429); IDOR check `AND project_id=?`; DTO allow-lists (no token in public responses); in-memory rate limiter on decision endpoint; idempotent seed script (Website Redesign) via real append path; integration test of 7-step flow + 10-parallel-decisions test.

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
