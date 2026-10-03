# Requirements: SignSeal

**Defined:** 2026-10-03
**Core Value:** Full demo flow works end to end: create -> client link -> approve / request changes -> audit trail -> Valid -> tamper -> Broken at entry #N.

## v1 Requirements

### Ledger Core
- [x] **LEDG-01**: Every event is appended to a per-project chain with hash = SHA-256(index|timestamp|action|actor|canonicalJSON(payload)|prevHash); first entry uses prevHash of 64 zeros
- [x] **LEDG-02**: Canonical JSON (recursively key-sorted, no whitespace) and a single `preimage()` live in one pure shared module used by server, browser, tests and export script
- [x] **LEDG-03**: Actor names containing `|` are rejected; exact ISO timestamp and canonical payload string are stored and hashed as stored
- [x] **LEDG-04**: One writer (`append`) performs head read, hash, insert and milestone update in a single immediate transaction; UNIQUE(project_id, idx) is a backstop
- [x] **LEDG-05**: Database triggers reject UPDATE and DELETE on ledger entries; the app exposes no edit/delete path
- [x] **LEDG-06**: Verify returns per-entry evidence `{valid, headHash, length, brokenAt?, entries:[{index,status,expectedHash,storedHash}]}` checking contiguous idx, genesis, project ownership, recompute and linkage

### Projects & Dashboard
- [x] **PROJ-01**: Agency can create a project with title, client name and 3+ milestones (title, description, due date) with inline validation errors
- [x] **PROJ-02**: Creating a project writes a PROJECT_CREATED ledger entry atomically with the project and milestones
- [x] **PROJ-03**: Dashboard lists projects with client name, progress (e.g. "2 / 4 approved") and status badge; new project appears immediately
- [x] **PROJ-04**: Project page shows each milestone as Pending, Approved or Changes Requested, with a "Copy client link" button

### Client Review
- [x] **REVW-01**: Each project has a unique unguessable review token (randomBytes(32) base64url); `/review/:token` works without login
- [x] **REVW-02**: Client enters their name, then approves a milestone or requests changes (note required for changes)
- [x] **REVW-03**: A milestone can be decided only once; a repeat decision returns 409 and writes no entry
- [x] **REVW-04**: Decision can only target milestones of the token's own project; unknown tokens return the same 404 body
- [x] **REVW-05**: Client sees a receipt (entry index + hash) after deciding, downloadable as JSON

### Audit & Verify
- [x] **AUDT-01**: Audit page shows a timeline (action, actor, time, short hash, previous hash) plus head hash and entry count
- [x] **AUDT-02**: "Verify integrity" recomputes the chain on the server and shows "Valid" or "Broken at entry #N" (single documented numbering convention)
- [x] **AUDT-03**: Tamper map shows ok entries green, the broken entry red, downstream entries amber (untrusted) with expected vs stored hash
- [x] **AUDT-04**: Browser re-verify recomputes the chain with Web Crypto (with fallback message when unavailable)
- [x] **AUDT-05**: On failure, explanation states which check failed (self-hash vs prevHash link) and cross-references milestone state (best-effort, not a true field diff)
- [x] **AUDT-06**: Public `/verify/:projectId` page verifies a chain without login and never exposes the review token

### Tamper Demo
- [x] **TAMP-01**: Tamper endpoint/button alters one entry's payload via drop-trigger/UPDATE/recreate in one transaction, clearly labelled DEMO ONLY
- [x] **TAMP-02**: Tamper is gated server-side by NODE_ENV !== production and ENABLE_TAMPER_DEMO === "true"; blocked returns 403 explaining how to enable; triggers remain intact afterwards
- [x] **TAMP-03**: Seed includes a pre-tampered project so "Broken" is demonstrable in any run mode

### Backend & Quality
- [x] **API-01**: REST API with persistent SQLite DB, zod strict validation on every endpoint and one status-code convention (400 malformed, 422 validation, 404, 409, 403, 429)
- [x] **API-02**: Decision endpoint rate limited (in-memory)
- [x] **API-03**: Public DTOs use allow-lists (no token leakage); review page sets no-referrer and noindex
- [x] **UI-01**: Responsive layout with loading, empty and error states throughout; clean consistent design
- [x] **SEED-01**: Idempotent seed script builds the "Website Redesign" demo through the real append path
- [x] **TEST-01**: Unit tests (golden hash vectors, key-order shuffle, `|`/unicode, verify, both tamper styles) and integration test of the 7-step demo flow plus 10-parallel-decisions concurrency test
- [x] **EXPT-01**: JSON export of the chain (with head hash) and a zero-dependency standalone verify script
- [x] **DOCS-01**: README with setup, stack, hash formula and canonical rule, limits (tamper-evident not tamper-proof; truncation), tamper-demo instructions, future improvements
- [x] **DOCS-02**: `.env.example` and Docker compose (node:24-slim, DB volume) that runs the demo

## v2 Requirements (bonus / deferred)

- **BONUS-01**: Sepolia anchor: `anchor(string projectId, bytes32 hash)` contract, "Anchor to blockchain" button (viem), `ANCHORED` ledger event, Etherscan link
- **BONUS-02**: Live deployment of frontend and backend
- **BONUS-03**: Demo video and screenshots
- **BONUS-04**: Link expiry / revoke, activity feed, evidence hash of IP/UA

## Out of Scope

| Feature | Reason |
|---------|--------|
| Agency auth / multi-tenancy | Brief requires none; single-tenant |
| Editable milestones / undo approval | Would undermine the sign-off record |
| Email delivery, file proofing | Not in brief |
| "Legally binding e-signature" claims | Misleading; tamper-evident only |
| Wallet/crypto in core flow | Core needs only SHA-256 |
| Raw IP/PII in ledger payloads | Immutable data must not hold personal data |
| Tamper endpoint in production | Security risk; gated off |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LEDG-01 | Phase 1 | Complete |
| LEDG-02 | Phase 1 | Complete |
| LEDG-03 | Phase 1 | Complete |
| LEDG-04 | Phase 1 | Complete |
| LEDG-05 | Phase 1 | Complete |
| LEDG-06 | Phase 1 | Complete |
| PROJ-01 | Phase 2 | Complete |
| PROJ-02 | Phase 2 | Complete |
| REVW-01 | Phase 2 | Complete |
| REVW-03 | Phase 2 | Complete |
| REVW-04 | Phase 2 | Complete |
| API-01 | Phase 2 | Complete |
| API-02 | Phase 2 | Complete |
| API-03 | Phase 2 | Complete |
| SEED-01 | Phase 2 | Complete |
| PROJ-03 | Phase 3 | Complete |
| PROJ-04 | Phase 3 | Complete |
| REVW-02 | Phase 3 | Complete |
| AUDT-01 | Phase 3 | Complete |
| AUDT-02 | Phase 3 | Complete |
| UI-01 | Phase 3 | Complete |
| TAMP-01 | Phase 4 | Complete |
| TAMP-02 | Phase 4 | Complete |
| TAMP-03 | Phase 4 | Complete |
| AUDT-03 | Phase 4 | Complete |
| AUDT-04 | Phase 4 | Complete |
| AUDT-05 | Phase 4 | Complete |
| AUDT-06 | Phase 5 | Complete |
| REVW-05 | Phase 5 | Complete |
| EXPT-01 | Phase 5 | Complete |
| TEST-01 | Phase 5 | Complete |
| DOCS-01 | Phase 5 | Complete |
| DOCS-02 | Phase 5 | Complete |

**Coverage:** v1 requirements: 33 total; mapped: 33; unmapped: 0
(The earlier count of 29 was a miscount; the list contains 33 IDs.)

---
*Requirements defined: 2026-10-03*
