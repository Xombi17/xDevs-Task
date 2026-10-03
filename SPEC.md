# SignSeal — Product & Technical Spec

Tamper-proof client sign-offs for a small digital agency. Source brief: THE xDEVS Full-Stack Intern take-home (~2h, AI allowed, GitHub repo required).

## 1. Problem
Agencies lose time and money to "I never approved that." Milestone approvals happen over chat/calls with no proof of who approved what, or when.

## 2. Product
The agency creates a project with milestones and shares a private review link. The client (no login) approves a milestone or requests changes. Every event is appended to a per-project **hash-chained ledger** anyone can verify.

## 3. Users
- **Agency user** — creates projects, copies client link, views audit trail, verifies integrity. (No auth required by brief; single-tenant.)
- **Client** — opens `/review/:token`, enters name, decides per milestone.
- **Public verifier / reviewer** — checks a chain without logging in.

## 4. Stack (decided)
- Next.js (App Router) + TypeScript + Tailwind
- SQLite via better-sqlite3 (persistent file DB), Drizzle optional
- Node `crypto` for SHA-256 server-side; Web Crypto in browser for re-verify
- Vitest for tests; Docker compose for run; Hardhat/Foundry + viem for Sepolia bonus

## 5. Core requirements (must-have, 100 pts)
| ID | Requirement | Done when |
|----|-------------|-----------|
| R1 | Create project | Title, client name, >=3 milestones (title, description, due date); inline validation errors; appears on dashboard |
| R2 | Dashboard & project page | Lists projects w/ client, progress ("2 / 4 approved"), status badge; project page shows milestone status (Pending/Approved/Changes Requested) + "Copy client link" |
| R3 | Client review link | Unguessable `/review/:token` (>=128-bit random), no login; client enters name, approves or requests changes (note required) |
| R4 | Tamper-evident ledger | Every event appended to hash-chained ledger, one chain per project; no edit/delete via app |
| R5 | Audit page & verify | Timeline (action, actor, time, short hash, prev hash); **Verify integrity** recomputes on server -> "Valid" or "Broken at entry #N" |
| R6 | Tamper demo | Dev-only endpoint + button mutating one stored entry; clearly labelled DEMO |
| R7 | Backend & data | REST API, persistent DB, server-side validation, correct HTTP codes (201/400/404/409/422) |
| R8 | UI quality | Responsive; loading, empty, error states; consistent design |
| R9 | README | Setup, stack, hash computation, future improvements |

### Ledger entry
`index, timestamp (ISO), action (PROJECT_CREATED | MILESTONE_APPROVED | CHANGES_REQUESTED), actor, payload (JSON), prevHash, hash`

`hash = SHA256( index | timestamp | action | actor | canonicalJSON(payload) | prevHash )`

- Genesis `prevHash = "0" * 64`.
- `canonicalJSON` = recursively key-sorted, no whitespace, so hashing is deterministic.
- Verify walks from entry 0, recomputes each hash and checks `prevHash` linkage; first mismatch = break index.
- Append is one DB transaction (read head -> insert), unique `(project_id, index)`.
- SQLite triggers `BEFORE UPDATE/DELETE` on ledger raise errors. Tamper demo disables via a separate raw connection / drop-recreate trigger path, only when `NODE_ENV !== production` and `ENABLE_TAMPER_DEMO=true`.

## 6. Differentiators (chosen unique additions)
| # | Feature | Why |
|---|---------|-----|
| U1 | **Tamper map** — after verify, green blocks; first broken red; downstream amber; expected vs stored hash shown | Best demo moment |
| U2 | **Browser re-verify** — Web Crypto recompute client-side ("don't trust the server") | Shows trust model understanding |
| U3 | **Public verify page** `/verify/:projectId` (no login) | +4 bonus |
| U4 | **Field-level diff on failure** — which field differs from recomputed | Explainability |
| U5 | **Decide-once rule** — a decided milestone returns 409 on repeat | Correct sign-off semantics |
| U6 | Seed script — "Website Redesign" demo project | Fast reviewer flow |
| U7 | Client receipt (entry index + hash, JSON download) | Client-side proof |
| U8 | JSON export of chain + standalone verify script | +4 bonus (export) |

Stretch (only if time): link expiry/revoke, evidence hash of IP/UA, activity feed, Sepolia anchor (`anchor(string projectId, bytes32 hash)`, store tx hash + Etherscan link, `ANCHORED` ledger event), live deploy, demo video.

## 7. API
| Method & path | Purpose | Codes |
|---|---|---|
| POST `/api/projects` | Create project + milestones, writes PROJECT_CREATED | 201, 400/422 |
| GET `/api/projects` | List w/ progress | 200 |
| GET `/api/projects/:id` | Details, milestones, client token | 200, 404 |
| GET `/api/review/:token` | Client-safe project view | 200, 404 |
| POST `/api/review/:token/decision` | `{milestoneId, decision, actor, note?}` writes ledger entry | 201, 400, 404, 409 |
| GET `/api/projects/:id/ledger` | All entries | 200, 404 |
| GET `/api/projects/:id/verify` | `{valid, brokenAt?, details}` | 200, 404 |
| GET `/api/verify/:id` | Public read-only verify | 200, 404 |
| POST `/api/dev/tamper/:entryId` | Demo only | 200, 403 (prod), 404 |

## 8. Data model
- `projects(id, title, client_name, review_token_unique, created_at)`
- `milestones(id, project_id, title, description, due_date, status, decided_by, decided_at, note)`
- `ledger_entries(id, project_id, idx, timestamp, action, actor, payload_json, prev_hash, hash, UNIQUE(project_id, idx))`

Milestone status is derived/updated only via ledger-writing transaction.

## 9. Pages
`/` dashboard · `/projects/new` · `/projects/[id]` · `/projects/[id]/audit` · `/review/[token]` · `/verify/[id]`

## 10. Non-functional
- Validation with zod on every endpoint; never trust client-supplied status/hash.
- No secrets in repo; `.env.example` provided.
- Rate limit decision endpoint (basic in-memory).
- Tests: unit (hash, canonicalisation, verify, tamper detection); integration (full 7-step demo flow).
- Accessibility: labelled forms, focus states, contrast; mobile-first.

## 11. Acceptance — reviewer demo flow
1. Create "Website Redesign" w/ 3 milestones -> dashboard shows 0 / 3.
2. Open client link in private window; name; approve M1; request changes on M2 with note.
3. Agency view shows 1 / 3 with updated badges, no manual edit.
4. Audit shows 3 linked entries, each with previous hash.
5. Verify -> **Valid**.
6. Run tamper demo -> verify -> **Broken at entry #N**.
7. (Bonus) Anchor on Sepolia, open Etherscan.

## 12. Phases (for GSD roadmap)
1. Scaffold, schema, immutability triggers, seed
2. Ledger core: canonical JSON, append, verify, unit tests (R4)
3. API: projects, review, decision, ledger, verify, tamper (R1, R3, R7)
4. UI: dashboard, project, review, audit + verify (R2, R3, R5, R8)
5. Tamper demo + tamper map + browser re-verify + diff (R6, U1, U2, U4)
6. Public verify, export, receipt, README, Docker, tests (R9, U3, U7, U8)
7. Bonus: Sepolia anchor, deploy, demo video

## 13. Scoring priorities
Core flow 35 · Ledger correctness 20 · Backend 15 · UI 15 · Code/README 10 · Interview 5. Working R1–R6 beats polish.

## 14. Risks
- Timestamp/format drift breaking hashes -> store exact ISO string used in hash.
- Key-order JSON drift -> canonical JSON only.
- Concurrent appends forking chain -> transaction + unique constraint.
- Tail truncation undetectable by chain alone -> document; show head hash; anchor optionally.
