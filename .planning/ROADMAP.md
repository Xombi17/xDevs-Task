# Roadmap: SignSeal

## Overview

Ledger-first, vertical slices. Phase 1 builds the pure hash/verify core and the single append writer with DB triggers. Phase 2 exposes it through services, REST and a seed so the whole demo flow works headlessly. Phase 3 adds the core UI so a human can run the flow. Phase 4 delivers the tamper demo and the visual proof (tamper map, browser re-verify). Phase 5 adds public verify, receipt, export, tests, Docker and README. Sepolia anchoring (BONUS-01) and other bonus items stay in v2 and are intentionally unmapped.

## Phases

- [ ] **Phase 1: Ledger Core** - Scaffold, schema, triggers, pure hash/verify module, single transactional append
- [ ] **Phase 2: Services, REST API & Seed** - Projects, review token, decisions, validation, rate limit, idempotent seed
- [ ] **Phase 3: Core UI** - Dashboard, new project, project page, client review page, audit timeline with server Verify
- [ ] **Phase 4: Tamper Demo & Visual Proof** - Gated tamper, tamper map, browser re-verify, failure explanation, pre-tampered seed
- [ ] **Phase 5: Public Verify, Export, Tests & Ship** - Public verify page, receipt, export + script, full tests, Docker, README

## Phase Details

### Phase 1: Ledger Core
**Goal**: A correct, append-only, verifiable hash-chained ledger exists and is proven by unit tests, independent of any UI.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: LEDG-01, LEDG-02, LEDG-03, LEDG-04, LEDG-05, LEDG-06
**Success Criteria** (what must be TRUE):
  1. Appending events for a project yields a chain whose first entry has prevHash of 64 zeros and whose hashes match golden test vectors, regardless of payload key order.
  2. An actor name containing `|` is rejected, and the stored timestamp and payload string are exactly what was hashed.
  3. Any attempt to UPDATE or DELETE a ledger row via SQL fails because of database triggers.
  4. Verify on an intact chain returns `valid: true` with head hash and length; on a hand-corrupted chain it returns the broken index with per-entry evidence.
**Plans**: TBD

### Phase 2: Services, REST API & Seed
**Goal**: The full demo flow works through the REST API: create project, get a client link, decide milestones once, and read a verifiable ledger.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: PROJ-01, PROJ-02, REVW-01, REVW-03, REVW-04, API-01, API-02, API-03, SEED-01
**Success Criteria** (what must be TRUE):
  1. POSTing a project with a title, client and 3+ milestones succeeds and writes a PROJECT_CREATED entry; invalid input returns 422 with field errors.
  2. A project has an unguessable review token and the client can approve or request changes via that token with no login; unknown tokens and foreign milestones return the same 404.
  3. A second decision on the same milestone returns 409 and writes no entry; excess rapid decisions return 429.
  4. Public responses never contain the review token.
  5. Running the seed script (twice) produces one "Website Redesign" demo project built through the real append path.
**Plans**: TBD

### Phase 3: Core UI
**Goal**: A person can run the whole happy path in the browser: create a project, share the link, client decides, agency sees the audit trail and verifies it.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PROJ-03, PROJ-04, REVW-02, AUDT-01, AUDT-02, UI-01
**Success Criteria** (what must be TRUE):
  1. Dashboard lists projects with client name, progress like "2 / 4 approved" and a status badge; a newly created project appears immediately.
  2. Project page shows each milestone as Pending, Approved or Changes Requested and a "Copy client link" button.
  3. On the client review page the client enters a name, approves a milestone or requests changes (note required), and sees the new status.
  4. Audit page shows a timeline with action, actor, time, short hash, previous hash, head hash and entry count; "Verify integrity" shows "Valid".
  5. All pages are responsive and show loading, empty and error states.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Tamper Demo & Visual Proof
**Goal**: The demo climax works: tamper with an entry and see "Broken at entry #N" on the server and in the browser, with a clear visual explanation.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: TAMP-01, TAMP-02, TAMP-03, AUDT-03, AUDT-04, AUDT-05
**Success Criteria** (what must be TRUE):
  1. A clearly labelled DEMO ONLY button alters one entry's payload, after which Verify shows "Broken at entry #N" and triggers still block normal UPDATE/DELETE.
  2. When tamper is disabled (production or flag not "true"), the endpoint returns 403 explaining how to enable it.
  3. Tamper map shows ok entries green, the broken entry red and downstream entries amber, with expected vs stored hash.
  4. "Re-verify in browser" recomputes the chain with Web Crypto and agrees with the server (or shows a fallback message).
  5. A failure explanation states which check failed (self-hash vs prevHash link) and cross-references milestone state; the seed includes a pre-tampered project that shows Broken in any run mode.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Public Verify, Export, Tests & Ship
**Goal**: The project is submission-ready: third parties can verify without login, evidence is downloadable, and it runs from tests, Docker and the README.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: AUDT-06, REVW-05, EXPT-01, TEST-01, DOCS-01, DOCS-02
**Success Criteria** (what must be TRUE):
  1. Anyone can open `/verify/:projectId` without login to verify a chain, and the page never reveals the review token.
  2. After deciding, the client sees a receipt (entry index + hash) and can download it as JSON.
  3. The chain can be exported as JSON with head hash and checked with a zero-dependency standalone script.
  4. The test suite passes, covering golden vectors, key-order shuffle, `|`/unicode, both tamper styles, the 7-step demo flow and 10 parallel decisions.
  5. `docker compose up` runs the demo using `.env.example`, and the README covers setup, stack, hash formula, limits, tamper-demo instructions and future improvements.
**Plans**: TBD
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Ledger Core | 1/3 | In Progress|  |
| 2. Services, REST API & Seed | 0/0 | Not started | - |
| 3. Core UI | 0/0 | Not started | - |
| 4. Tamper Demo & Visual Proof | 0/0 | Not started | - |
| 5. Public Verify, Export, Tests & Ship | 0/0 | Not started | - |

## Deferred (v2, unmapped)

BONUS-01 Sepolia anchor, BONUS-02 live deploy, BONUS-03 demo video, BONUS-04 link expiry/activity feed. Cut order if time runs short: bonus, then AUDT-05, then REVW-05. Never cut verify, triggers or the tamper flow.
