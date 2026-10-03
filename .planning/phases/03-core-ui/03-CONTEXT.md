# Phase 3: Core UI - Context

**Gathered:** 2026-10-03
**Status:** Ready for planning
**Mode:** Pre-decided from SPEC.md + research (discuss skipped; all choices locked below)

<domain>
## Phase Boundary

A person can run the whole happy path in the browser.

</domain>

<decisions>
## Implementation Decisions

### Scope
Next App Router pages: dashboard `/`, `/projects/new`, `/projects/[id]` (Copy client link), `/projects/[id]/audit` (timeline + head hash + count + Verify integrity), `/review/[token]` (mobile-first, no-referrer, noindex). Server components call services directly; small client components for forms/verify. Loading/empty/error states. Tailwind 4 plain, no component library. Use design skills (tailwind-design-system, vercel-react-best-practices) for quality.

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
