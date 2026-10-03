# Phase 4: Tamper Demo & Visual Proof - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning
**Mode:** Pre-decided from SPEC.md + research (discuss skipped; all choices locked below)

<domain>
## Phase Boundary

Tamper with an entry and see Broken at entry #N on server and browser.

</domain>

<decisions>
## Implementation Decisions

### Scope
Prototype trigger drop/UPDATE/recreate in one transaction FIRST. Gated endpoint (`NODE_ENV!=='production' && ENABLE_TAMPER_DEMO==='true'`, strict), DEMO ONLY banner + confirm, 403 body explains enabling; tamper only payload_json; assert triggers intact afterwards. Tamper map green/red/amber with expected vs stored hash; browser re-verify via crypto.subtle with feature detection; best-effort failure explanation (U4); seed adds pre-tampered project.

## Locked decisions (from SPEC.md and .planning/research/SUMMARY.md — do not re-litigate)
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
- SPEC.md
- .planning/PROJECT.md, REQUIREMENTS.md, ROADMAP.md
- .planning/research/SUMMARY.md, ARCHITECTURE.md, PITFALLS.md, STACK.md
</canonical_refs>

<deferred>
## Deferred Ideas
Sepolia anchor, deploy, demo video, link expiry/revoke (v2).
</deferred>
