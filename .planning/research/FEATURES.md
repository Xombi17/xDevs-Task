# Feature Research

**Domain:** Client approval / sign-off with tamper-evident audit trail (small agency, login-free client review)
**Researched:** 2026-10-03
**Confidence:** MEDIUM. Based on PROJECT.md and docs/SPEC.md plus domain knowledge of proofing/approval tools (Filestage, GoVisually, Ziflow, Notion/Basecamp approvals), e-signature tools (DocuSign, Dropbox Sign, PandaDoc audit certificates), and audit-ledger patterns (Certificate Transparency, Merkle logs, QLDB-style journals, OpenTimestamps). No live web verification was done in this pass, so competitor details are LOW-to-MEDIUM confidence. Scoring and requirement priorities come straight from the spec (HIGH confidence).

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these makes the product feel broken or fails the rubric.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create project with title, client, >=3 milestones (R1) | Basic unit of work for an approval tool | LOW | zod validation shared by form and API; inline errors; writes PROJECT_CREATED in the same transaction |
| Dashboard with progress and status badge (R2) | Agency needs "where do things stand" at a glance | LOW | Progress ("2 / 4 approved") derived from milestones, never hand-edited |
| Project page with per-milestone status and Copy client link (R2) | Standard in every proofing tool | LOW | Statuses: Pending / Approved / Changes Requested |
| Private, unguessable, login-free review link (R3) | Clients refuse accounts; the link is the credential | LOW | >=128-bit token via `crypto.randomBytes(16+)`, base64url, UNIQUE column. Return 404 (not 403) for bad tokens |
| Client names themselves, then approves or requests changes with required note (R3) | Every approval tool captures who and why | LOW | Note required only for change requests. Name is self-asserted; state this limit |
| Append-only hash-chained ledger, one chain per project (R4) | The product's core promise | MEDIUM | Canonical JSON, genesis prevHash of 64 zeros, transaction plus UNIQUE(project_id, idx), SQLite triggers blocking UPDATE/DELETE |
| Audit timeline (action, actor, time, short hash, prev hash) (R5) | E-sign tools all ship an audit certificate or history | LOW | Read-only; copyable full hashes |
| Verify integrity returning Valid or Broken at entry #N (R5) | Without verification, a hash chain is just a log | MEDIUM | Walk from idx 0, recompute hash, check prevHash linkage, report first mismatch |
| Dev-only tamper demo, clearly labelled (R6) | Only way to show the break path in a demo | MEDIUM | Gate on NODE_ENV !== production AND ENABLE_TAMPER_DEMO. Needs a separate raw connection or trigger bypass. 403 in prod |
| REST API with persistent DB, server validation, correct codes (R7) | Backend scoring bucket | MEDIUM | 201/400/404/409/422; never trust client-supplied status or hash |
| Responsive UI with loading, empty and error states (R8) | Reviewers click through on phones and desktops | MEDIUM | Client review page is the most likely one opened on mobile |
| README with setup, stack, hash formula, improvements (R9) | Interview and code-quality scoring | LOW | Include the tail-truncation limitation |
| Decided milestones can't be re-decided (U5, 409) | Real sign-off semantics: an approval that can be silently flipped is worthless | LOW | Promoted from differentiator to table stakes. The check must be inside the ledger-append transaction to avoid a double-submit race |
| Seed script for "Website Redesign" (U6) | Reviewers want the flow in seconds | LOW | Must go through the real ledger append path so seeded hashes are valid |
| Unit tests for hash, canonicalisation, verify and tamper; one integration test of the demo flow | Signals correctness of the ledger | MEDIUM | Highest value-per-minute tests are "mutate any field then verify returns that index" |

### Differentiators (Competitive Advantage)

Align with the Core Value: the demo flow ends in Valid, then Broken at entry #N.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Tamper map (U1): green / red / amber blocks, expected vs stored hash | Best demo moment; makes the abstract concept visible | MEDIUM | Needs the verify response to return per-entry results, not just the first break. Amber means downstream of the break |
| Browser re-verify with Web Crypto (U2) | "Don't trust the server" shows the trust model | MEDIUM | Must reimplement canonical JSON in the browser. Share one pure TS module to avoid drift. Web Crypto needs a secure context (localhost is fine) |
| Public verify page `/verify/:id` (U3) | Third parties can check without login. Bonus +4 | LOW | Read-only. Expose only fields needed for hashing, no review token |
| Field-level diff on failure (U4) | Explains why it broke (e.g. actor changed) | MEDIUM | Hashes are one-way, so the diff compares stored fields to a recomputed hash only when payload fields can be inferred. Realistic scope: show expected vs stored hash and which linkage failed (self-hash vs prevHash). Full field diff is only possible against an exported or baseline copy |
| Client receipt, JSON download (U7) | Client holds independent proof (index plus hash) | LOW | Reuse the decision response. Include the head hash at the time of decision |
| JSON export of chain plus standalone verify script (U8) | Offline verifiability. Bonus +4 | MEDIUM | Script must be zero-dependency Node using the same canonical algorithm. Test it against exported seed data |
| Show chain head hash prominently | Mitigates undetectable tail truncation; the client can pin the head | LOW | Cheap, and ties directly to the documented known limit |
| Sepolia anchor of head hash (stretch, +8) | External timestamp defeats truncation and full-chain rewrite | HIGH | Only after R1-R9 and U1-U8. Adds an ANCHORED ledger event |
| Rate limiting on the decision endpoint | Cheap abuse protection (already in the non-functional section) | LOW | In-memory is acceptable and should be documented as single-process only |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Agency login, multi-tenancy, roles | Feels like "real SaaS" | Brief requires none; burns the 2h budget; adds a security surface to get right | Single-tenant. Document as a future improvement |
| Editing or deleting ledger entries, or an "undo approval" | Users make mistakes | Contradicts append-only. Triggers and the API forbid it | Append a compensating event (e.g. a new CHANGES_REQUESTED or a revoke event) in a future version |
| Blockchain, wallets or tokens in the core flow | Buzzword appeal | SHA-256 chaining is sufficient; chain tooling risks the core flow | Optional Sepolia anchor, last phase only |
| Real email or notification delivery | Clients expect an email with the link | SMTP setup, secrets and deliverability eat time | Copy-link button; list email as future work |
| File or design uploads and annotated proofing | Core feature of Filestage and Ziflow | Large scope, storage, previews | Milestone text and description only |
| Legally binding e-signatures (drawn signature, ID verification, eIDAS) | "Sign-off" sounds legal | Needs identity proofing and legal review. The name is self-asserted | Label it "approval record", never "legal signature" |
| Real-time updates (websockets, live feed) | Looks polished | Complexity without value for a demo | Refresh on action. Activity feed is a stretch item |
| Editable milestones after creation | Obvious CRUD completeness | Mutating milestones after approvals muddies what was approved | Capture title and description in the ledger payload at creation. Skip edit in v1 |
| Link expiry, revoke, IP/UA evidence hashing | Security-minded extras | Each needs UI plus ledger semantics | Stretch only, after U1-U8 |
| Exposing the tamper endpoint outside dev | Convenient for a live deploy | An attacker could corrupt data | Keep the double gate, and have the deployed demo seed a pre-tampered copy instead |
| Storing raw IP or PII in the ledger payload | "Stronger evidence" | Immutable data cannot be erased, which is a privacy conflict (GDPR style) | Hash it or leave it out. Keep PII out of payloads |

## Feature Dependencies

```
Schema + immutability triggers
    └──requires──> Canonical JSON + hash function (shared pure TS module)
                       └──requires──> Ledger append (transaction, UNIQUE idx)
                                          ├──requires──> Create project (PROJECT_CREATED)
                                          │                  └──requires──> Seed script (U6)
                                          └──requires──> Review link + decision (R3)
                                                             ├──requires──> Decide-once 409 (U5)
                                                             └──enhances──> Client receipt (U7)
Verify (server) ──requires──> Ledger append + hash module
    ├──requires──> Audit page (R5)
    ├──requires──> Tamper demo (R6)  [needed to show the Broken path]
    │       └──enhances──> Tamper map (U1) and field diff (U4)
    ├──enhances──> Public verify page (U3)
    └──enhances──> JSON export + standalone script (U8)
Browser re-verify (U2) ──requires──> Shared hash module + ledger API
Sepolia anchor ──requires──> Verify + head hash + all core features  (last)
Tamper demo ──conflicts──> Production deploy (unless gated and a pre-tampered copy is used)
Edit/delete ledger ──conflicts──> Triggers / append-only
```

### Dependency Notes

- **Everything requires the shared canonical-JSON and hash module.** Server verify, browser re-verify, export script and tests must use identical logic. Build and unit test it first, in a pure module with no Node-only imports so the browser can reuse it.
- **Decision requires the ledger append and milestone update in one transaction.** This is what makes U5 race-safe and keeps status consistent.
- **Tamper map (U1) requires verify to return per-entry status.** Design the verify result shape up front (`{valid, brokenAt, entries:[{idx, status, expected, stored}]}`), so U1, U2, U3 and U4 don't force an API rewrite.
- **Tamper demo requires a trigger bypass path.** Decide in the schema phase how it writes (separate raw connection or drop-and-recreate trigger).
- **Seed script requires real ledger append** so the demo chain is genuinely valid.
- **Receipt, export and public verify** are cheap once verify and ledger reads exist. Group them in one late phase.

## MVP Definition

### Launch With (v1)

- [ ] Hash module, canonical JSON, schema, triggers (R4 foundation)
- [ ] Create project, dashboard, project page, copy link (R1, R2)
- [ ] Review page, approve / request changes, decide-once (R3, U5)
- [ ] Audit timeline plus server Verify (R5)
- [ ] Tamper demo button and Broken at entry #N (R6)
- [ ] REST codes, zod validation, loading/empty/error states (R7, R8)
- [ ] Seed script, unit and integration tests, README (U6, R9)

### Add After Validation (v1.x)

- [ ] Tamper map (U1): biggest visual payoff once verify returns per-entry data
- [ ] Browser re-verify (U2): after the hash module is shared
- [ ] Public verify page (U3), JSON export plus standalone script (U8), client receipt (U7): the bonus-scoring group
- [ ] Field-level diff (U4): scope to hash and linkage explanation unless a baseline copy exists
- [ ] Docker compose, `.env.example`, rate limiting

### Future Consideration (v2+)

- [ ] Sepolia anchor, live deploy, demo video: bonus, only after everything above
- [ ] Link expiry/revoke, evidence hashing, activity feed
- [ ] Agency auth, multi-tenancy, email notifications, file proofing

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Hash module + ledger append + triggers | HIGH | MEDIUM | P1 |
| Create project / dashboard / project page | HIGH | LOW | P1 |
| Review link + decision + decide-once | HIGH | LOW | P1 |
| Audit timeline + Verify | HIGH | MEDIUM | P1 |
| Tamper demo | HIGH | MEDIUM | P1 |
| Tests + README + seed | HIGH | MEDIUM | P1 |
| Tamper map (U1) | HIGH | MEDIUM | P2 |
| Browser re-verify (U2) | HIGH | MEDIUM | P2 |
| Public verify (U3) | MEDIUM | LOW | P2 |
| Export + standalone script (U8) | MEDIUM | MEDIUM | P2 |
| Client receipt (U7) | MEDIUM | LOW | P2 |
| Field-level diff (U4) | MEDIUM | MEDIUM | P2 |
| Head hash display | MEDIUM | LOW | P2 |
| Docker, rate limiting | LOW | LOW | P2 |
| Sepolia anchor | MEDIUM | HIGH | P3 |
| Deploy, demo video | LOW | MEDIUM | P3 |
| Link expiry, activity feed, evidence hash | LOW | MEDIUM | P3 |

**Priority key:** P1 must have for launch; P2 should have; P3 nice to have.

## Competitor Feature Analysis

| Feature | Proofing tools (Filestage, Ziflow) | E-sign tools (DocuSign, Dropbox Sign) | Our Approach |
|---------|------------------------------------|---------------------------------------|--------------|
| Client access | Guest link, sometimes email-gated | Emailed unique link | Unguessable token link with name entry |
| Approval states | Approved / changes requested | Signed / declined | Same, scoped per milestone |
| Audit history | Activity log, mutable by vendor | Audit certificate (PDF), vendor-trusted | Hash-chained, independently verifiable by anyone |
| Tamper evidence | None visible to user | Certificate seal, verified via vendor | Server verify, browser re-verify and offline script |
| External anchoring | No | No | Optional Sepolia anchor (stretch) |

The differentiator is user-verifiable integrity. Competitors ask you to trust their database or PDF seal. These comparisons are from domain knowledge and not re-verified (LOW-MEDIUM).

## Sources

- `/home/varad/Documents/xDevs Task/.planning/PROJECT.md` (HIGH)
- `/home/varad/Documents/xDevs Task/SPEC.md` (HIGH: requirements, scoring, risks)
- Domain knowledge of Filestage, Ziflow, DocuSign and Dropbox Sign audit trails; Certificate Transparency and Merkle-log patterns; OpenTimestamps-style anchoring (MEDIUM-LOW, not live-verified)

---
*Feature research for: client approval and tamper-evident audit trail (SignSeal)*
*Researched: 2026-10-03*
