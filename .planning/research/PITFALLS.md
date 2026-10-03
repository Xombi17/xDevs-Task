# Pitfalls Research

**Domain:** Hash-chained audit ledger (SignSeal) on Next.js App Router + better-sqlite3
**Researched:** 2026-10-03
**Confidence:** MEDIUM. Hash-chain and SQLite semantics are well-established (HIGH). Next.js specifics (config key names, caching defaults, `params` being a Promise) come from training knowledge and were NOT re-verified against current docs in this session. Check them against the installed Next version in Phase 1 (LOW-MEDIUM on those items).

Phases refer to SPEC.md section 12: P1 Scaffold/schema/triggers/seed; P2 Ledger core; P3 API; P4 UI; P5 Tamper demo/map/browser verify/diff; P6 Public verify/export/receipt/README/Docker/tests; P7 Bonus.

## Critical Pitfalls

### Pitfall 1: Hash input is ambiguous (delimiter injection)
**What goes wrong:** `index|timestamp|action|actor|payload|prevHash` joined with `|` while `actor` is free text from the client. Actor `a|b` combined with a different payload can produce the same preimage as another entry. Collisions are rare, but a reviewer who asks "what if the name contains a pipe?" exposes it.
**Why it happens:** The spec formula reads like string concatenation, and nobody thinks of user-controlled fields as part of the preimage.
**How to avoid:** Keep the documented formula but make the preimage unambiguous. Either reject or escape `|` in `actor` (zod refine, with a clear error) or hash a canonical JSON array `[index, timestamp, action, actor, payload, prevHash]`. Record the choice in PROJECT.md Key Decisions and README. Write one `preimage()` function used by append, verify, browser verify and the export script.
**Warning signs:** `actor` is not validated beyond non-empty. No test with `|`, quotes, or unicode in the name.
**Phase to address:** P2 (decide), P3 (validate input).

### Pitfall 2: Canonical JSON is not truly canonical, or differs between server, browser and script
**What goes wrong:** `JSON.stringify` with a sorted-keys replacer only sorts top-level keys, or sorts arrays too. `undefined` values, `NaN`, `Date` objects and `-0` serialize differently. Three copies of the function (server, browser, standalone script) drift. Verify then shows "Broken" on untouched data, or the browser says Valid while the server says Broken.
**Why it happens:** Copy-pasting the helper into the client component and the export script. Payload is hashed before a DB round trip that changes its shape.
**How to avoid:** Implement one pure module, `lib/ledger/canonical.ts`, with a recursive sort, no whitespace, arrays kept in order, and a throw on `undefined`/non-finite numbers. Import it everywhere (server, client component, Vitest). Make the standalone verify script import or inline-generate from that same file. Keep payload to strings and integers only. Store the exact canonical string in `payload_json` and hash that string. Verify re-canonicalizes the parsed payload and compares it to the stored string, so stored-form drift is visible. Add golden test vectors (a fixed entry with its expected hex hash) and a key-order-shuffle test. Run the same vectors in the browser path.
**Warning signs:** More than one `function canonicalize` in the repo. Hand-built payload objects with optional fields that sometimes hold `undefined`. A browser verify result that disagrees with the server.
**Phase to address:** P2 (canonical module and vectors), P5 (browser verify reuses it), P6 (export script).

### Pitfall 3: Timestamp and index representation drift
**What goes wrong:** Hash computed with `new Date().toISOString()`, but the DB stores a different format (SQLite `datetime('now')` default gives `YYYY-MM-DD HH:MM:SS` with no `T`, `Z` or milliseconds), or the value is re-serialized on read through `new Date(x).toISOString()`. Index is hashed as `1` on write and as `"01"` or `1.0` somewhere else. Every verify fails after a restart.
**Why it happens:** A column default or ORM date mapping is used instead of the exact string. Drizzle timestamp modes silently convert to `Date`.
**How to avoid:** Generate the timestamp once in the append function, hash that string, and insert the same string into a plain TEXT column (no DB default, no Date mapping). Never reformat it on read. Hash `String(idx)` (decimal integer). Do not require monotonic timestamps. Order by `idx`, never by timestamp. Verify uses the stored strings verbatim.
**Warning signs:** A `DEFAULT CURRENT_TIMESTAMP` in schema SQL. Verify passes right after append but fails after a server restart. Any `new Date(row.timestamp)` in verify code.
**Phase to address:** P1 (schema has no defaults on hashed columns), P2.

### Pitfall 4: Concurrent appends fork the chain, and check-then-write races (TOCTOU)
**What goes wrong:** Two decisions arrive together. Both read head idx=2 and both try to insert idx=3. Without a unique constraint the chain forks. With the constraint, one request gets an unhandled 500. Separately, the decide-once check (is the milestone still pending?) runs before the transaction, so two requests can both approve the same milestone.
**Why it happens:** Head read, decision check and insert are done as separate statements outside one transaction. A deferred transaction (`BEGIN`) that reads and then writes can fail with `SQLITE_BUSY` on upgrade.
**How to avoid:** A single `appendEntry(projectId, input)` function runs everything inside `db.transaction(...).immediate()` (BEGIN IMMEDIATE takes the write lock up front). The transaction does these steps in order: read head, check milestone pending (409 if decided), compute hash, insert ledger row, update milestone status. better-sqlite3 transactions are synchronous. Never `await` inside the callback, and a function returning a Promise breaks the transaction. Set `busy_timeout` (for example 5000) and `journal_mode=WAL`. Map the UNIQUE violation to a retry (once) or a 409. Test with a `Promise.all` of 10 simultaneous decisions on one milestone: expect exactly one 201, nine 409s, and a valid chain.
**Warning signs:** Milestone status updated in a different transaction from the ledger insert. A route handler that reads the head via one helper and inserts via another. No concurrency test.
**Phase to address:** P2 (append), P3 (409 mapping), P6 (concurrency test).

### Pitfall 5: Verify is too weak (misses gaps, wrong project, truncation, full re-chain)
**What goes wrong:** Verify only recomputes each hash and compares `prevHash` to the previous row, so these pass: a deleted middle entry whose neighbours were re-pointed, non-contiguous idx, a first entry whose prevHash is not 64 zeros, a missing PROJECT_CREATED genesis, and a truncated tail (the last N entries deleted). An attacker who rewrites an entry and recomputes all later hashes also passes.
**Why it happens:** Verify is written for the happy-path tamper (edit one field). Tail truncation and full re-chain cannot be caught by the chain alone.
**How to avoid:** Verify must check: idx runs contiguously 0..n-1; entry 0 has prevHash of 64 zeros and action PROJECT_CREATED; every row belongs to the project; the hash recomputes; the prevHash equals the previous stored hash; the action is in the allowed enum. Cross-check milestone statuses against the ledger replay (the DB cache must equal the ledger-derived state). Always return and display `headHash` and `count`. Put head hash and count into the client receipt (U7) and the export (U8) so an outside party holds an external reference. Document honestly in the README that truncation and full re-chain by a DB-write attacker are undetectable without an external anchor (Sepolia or a published head hash). That is a strength in the interview, not a weakness.
**Warning signs:** The verify loop starts from the first row without checking `idx === i`. No test that deletes the last entry. README claims "tamper-proof".
**Phase to address:** P2 (checks), P5 (display), P6 (README, receipt, export head).

### Pitfall 6: "Broken at entry #N" semantics and tamper-map logic are off by one or misleading
**What goes wrong:** Spec says "entry #N" but idx is 0-based, so the UI says #0 or #1 inconsistently. If an attacker edits entry k and leaves hash unchanged, entry k fails (hash mismatch) and k+1 still links to the stored hash. If they also fix k's hash, the break shows at k+1, not k. The demo story ("I edited entry 2, it says 2") may not match.
**Why it happens:** Demo author tampers only one specific way and never considers the other.
**How to avoid:** Decide that the UI shows 1-based "#N" while the API returns 0-based `brokenAtIndex` and `brokenAtEntryNumber`, or pick one and use it everywhere. The tamper demo should mutate only `payload_json` (or actor), not the hash, so the break appears at exactly the tampered entry. Define amber as "downstream, no longer trustworthy" (UI interpretation), not "also failed". Field-level diff (U4) compares recomputed vs stored for each field, and for prevHash mismatch says "link to previous broken". Unit-test both tamper styles.
**Warning signs:** Different off-by-one conventions in API, UI and tests. Tamper endpoint that rewrites the hash too.
**Phase to address:** P2 (contract), P5 (map, diff).

### Pitfall 7: SQLite trigger bypass for the tamper demo is unsafe or does not work
**What goes wrong:** Triggers block UPDATE/DELETE, so the tamper endpoint has to bypass them. Typical failures: `DROP TRIGGER`, update, `CREATE TRIGGER` run non-atomically, so a crash or error leaves the ledger permanently unprotected. Or the endpoint uses a second connection while the first holds a write lock (`SQLITE_BUSY`). Or a prepared statement cached before the DROP fails ("schema changed") or is stale. Or the tamper code path is importable from production routes.
**Why it happens:** SQLite has no "disable trigger" command and no per-session bypass. A trigger-bypass flag table is possible but easy to leave open.
**How to avoid:** Do the bypass in one transaction on the same connection: `DROP TRIGGER` for update, `UPDATE`, `CREATE TRIGGER` again, inside `db.transaction`. SQLite DDL is transactional, so an error rolls everything back, trigger drop included. Source the trigger DDL from a single constant shared by migration and tamper code, so the recreated trigger is identical. Alternative: a trigger with `WHEN (SELECT value FROM ledger_guard) != 'open'`, but this leaves a weaker invariant, so prefer drop/recreate in a transaction. Test: after tamper, a plain `UPDATE ledger_entries` via the app connection still raises. Keep the tamper module in `lib/dev/` and import it dynamically only inside the gated route. Prepare statements per call or after schema setup. Tamper only touches `payload_json` (see Pitfall 6).
**Warning signs:** Trigger count in `sqlite_master` is lower after a tamper request. Tamper route imports at module top level into shared code. Tests for triggers only check that the UPDATE throws before tamper.
**Phase to address:** P1 (triggers, shared DDL), P5 (tamper), P6 (test).

### Pitfall 8: Tamper gate fails in the real demo scenario (NODE_ENV conflict, string flags)
**What goes wrong:** Gate requires `NODE_ENV !== 'production'` and `ENABLE_TAMPER_DEMO=true`. A reviewer who runs `npm run build && npm start` or `docker compose up` gets `NODE_ENV=production`, so the tamper button 403s and demo step 6 fails (and it is core 35-point flow). Or the opposite: `ENABLE_TAMPER_DEMO=false` compared as a truthy string enables it. Or only the button is hidden, while the endpoint is open.
**Why it happens:** The safety rule and the reviewer's demo path were designed separately.
**How to avoid:** Enforce the gate server-side in the route (the UI hiding is cosmetic). Compare strictly: `process.env.ENABLE_TAMPER_DEMO === 'true'`. Resolve the conflict explicitly. Option A (recommended): README and Docker compose define a `demo` service/profile that runs `next dev` or sets a documented `DEMO_MODE`, with the tamper gate being `NODE_ENV !== 'production' && flag`, and a clear message in the 403 body explaining how to enable it. Option B: also ship the seed with a pre-tampered second project ("Website Redesign (tampered)") so the Broken state can be shown in any mode. Do both for safety. Return 403 in production, 404 when the entry does not exist, and never mention tamper in production UI.
**Warning signs:** Demo flow only tested under `next dev`. Docker image tested only for steps 1 to 5.
**Phase to address:** P3 (gate), P5 (UX and messages), P6 (Docker and README).

### Pitfall 9: Review token is weaker than required or leaks
**What goes wrong:** UUIDv4 has only 122 random bits (below the stated 128-bit requirement). nanoid default (21 chars, 64-symbol alphabet) is about 126 bits. `Math.random`, sequential ids, or a token derived from the project id are guessable. The token also leaks through public endpoints (`/api/verify/:id`, ledger, export, receipt) if payloads or project rows are serialized wholesale, through the Referer header to third-party assets, and through logs.
**Why it happens:** `crypto.randomUUID()` feels random; "return the project row" is the easy API shape.
**How to avoid:** `crypto.randomBytes(32).toString('base64url')` (256 bits) in one `generateToken()` function. UNIQUE index on the token column. Public routes (`/api/verify/:id`, `/verify/[id]`, export) use explicit DTO mappers (allow-lists) that cannot include `review_token`. Only the agency endpoint `/api/projects/:id` returns it. Never put the token in ledger payloads (the ledger is public). Set `Referrer-Policy: no-referrer` and `robots: noindex` on the review page; no external fonts or analytics on that page. Return 404 (not 403) for an unknown token with the same body regardless of format. Tests assert the public JSON contains no token string.
**Warning signs:** `randomUUID` or `nanoid()` import in token code. `SELECT *` mapped straight to responses. Token visible in an exported JSON.
**Phase to address:** P1 (column and generator), P3 (DTOs), P6 (export and receipt check).

### Pitfall 10: Token-scoped decision endpoint trusts client input (IDOR, forged fields)
**What goes wrong:** `POST /api/review/:token/decision` accepts `milestoneId` and acts on it without checking it belongs to the token's project, so a client could write entries into another project's chain (if they know a milestone id). The body may also carry a status or hash that gets trusted. Actor is empty or megabyte-long. Note is not required for CHANGES_REQUESTED.
**Why it happens:** Milestone ids are sequential and looked up globally.
**How to avoid:** Resolve project from the token first, then `WHERE id = ? AND project_id = ?` for the milestone (404 otherwise). Zod `.strict()` schema that rejects extra keys; decision is an enum; actor trimmed, 1-80 chars; note required (trimmed, max 1000) when decision is CHANGES_REQUESTED, using `superRefine`; never accept status/hash/timestamp from the client. Use random ids (UUID/nanoid) for milestones and projects, so sequential guessing is not feasible. Status codes: 400 malformed JSON, 422 semantic validation failure (pick one rule and apply it consistently across all endpoints, document it), 404 unknown, 409 already decided. Rate limit keyed by token, not only IP (X-Forwarded-For is spoofable and in-memory counters reset on dev HMR); label it as best-effort.
**Warning signs:** `getMilestone(id)` without a project filter. Zod object without `.strict()`.
**Phase to address:** P3.

### Pitfall 11: Seed and other writers bypass the append function
**What goes wrong:** The seed script, tests, or the project-create endpoint insert ledger rows (or PROJECT_CREATED) with raw SQL or a different hashing implementation. The seeded chain verifies as Broken from the start, or a project row exists without a genesis entry (project creation and genesis written in separate transactions, so a crash leaves a project with an empty chain).
**Why it happens:** Seed is written in a hurry with hand-rolled SQL. Project create and the ledger append are treated as two operations.
**How to avoid:** Exactly one writer: `appendEntry`. Project creation (project row, milestones, PROJECT_CREATED entry) runs in one IMMEDIATE transaction that calls the shared internal append (so the append function takes an optional existing transaction/db handle). Seed calls the same service function the API uses and is idempotent (skip if the "Website Redesign" project exists, or reset by deleting the DB file, never by DELETE on the ledger table because triggers block it). A grep/lint check or test ensures `INSERT INTO ledger_entries` appears only in the ledger module.
**Warning signs:** `INSERT INTO ledger_entries` in more than one file. Seed output shows Valid only sometimes.
**Phase to address:** P1 (seed plan), P2 (single writer), P3.

### Pitfall 12: Duplicated sources of truth (milestone status vs ledger)
**What goes wrong:** `milestones.status` can be set by code paths other than the ledger transaction, so the dashboard shows "2/4 approved" while the ledger has 1. A tamper changes ledger and the dashboard silently stays "approved", which is a legitimate consequence but should be visible.
**Why it happens:** Status is a cache, but it was written as a primary field.
**How to avoid:** Status is only mutated inside `appendEntry`. Verify includes a "derived state matches" check (replay entries, compare with milestones table), and reports it separately from chain validity. No PATCH/PUT milestone-status endpoint exists.
**Warning signs:** Any `UPDATE milestones SET status` outside the ledger module.
**Phase to address:** P2, P3.

## Next.js + better-sqlite3 Pitfalls

### Pitfall 13: better-sqlite3 gets bundled or runs in the wrong runtime
**What goes wrong:** Webpack/Turbopack tries to bundle the native `.node` addon, giving "Module not found" or "Could not locate the bindings file". Routes accidentally run on the Edge runtime (middleware always does) where `fs`/native modules do not exist.
**Why it happens:** Native modules need to stay external; Next config key names changed between versions.
**How to avoid:** Add better-sqlite3 to Next's external server packages (`serverExternalPackages: ['better-sqlite3']` in Next 15+; `experimental.serverComponentsExternalPackages` in Next 14. Verify against the installed version). Add `export const runtime = 'nodejs'` to DB-touching route handlers. Do not touch the DB in `middleware.ts`. Never import the DB module from a `'use client'` file (use a `server-only` import in the DB module to fail the build early).
**Warning signs:** Build error mentioning `bindings`; `fs` not found in client bundle.
**Phase to address:** P1.

### Pitfall 14: Multiple DB connections, HMR leaks, and build-time DB access
**What goes wrong:** In `next dev`, hot reload re-evaluates the module and opens a new connection each time (leaked handles, "database is locked"). `next build` collects page data in parallel workers, and top-level `new Database(...)` plus migrations running at import time create files, race on the schema, or fail on a read-only filesystem. Relative DB paths resolve against `process.cwd()`, which differs between dev, standalone Docker, and Vitest, so each shows a different (empty) DB.
**Why it happens:** Module-scope singletons look fine until HMR and build workers.
**How to avoid:** Lazy `getDb()` cached on `globalThis` (`globalThis.__db ??= open()`). Run schema creation idempotently (`CREATE TABLE IF NOT EXISTS`, triggers `CREATE TRIGGER IF NOT EXISTS`) inside `getDb()` or via an explicit `npm run db:init`, not at import time. Absolute path from `DATABASE_PATH` env (default `./data/signseal.db` resolved via `path.resolve`), directory created on demand. Set pragmas on open: `journal_mode=WAL`, `foreign_keys=ON` (off by default per connection!), `busy_timeout`. Tests use a temp-file or `:memory:` DB injected via the same factory.
**Warning signs:** Foreign keys not enforced. "database is locked" in dev. Different data in `next dev` and `next start`. `.db-wal` and `.db-shm` files committed (gitignore `data/`).
**Phase to address:** P1.

### Pitfall 15: Route handler and server component caching/params surprises
**What goes wrong:** GET route handlers or server components serve stale data (Next 14 cached GET handlers by default; Next 15 changed defaults, so behaviour depends on version), so the dashboard does not update after approval and Verify shows an old result. In Next 15+, `params` is a Promise (`const { id } = await params`); the old synchronous destructuring breaks or warns. Server components that `fetch('/api/...')` their own API need absolute URLs and fail at build time.
**Why it happens:** Training-era tutorials target Next 13/14.
**How to avoid:** Mark dynamic pages and handlers `export const dynamic = 'force-dynamic'` (or `fetch(..., {cache:'no-store'})`) for anything reading the DB. Server components call the service layer (`lib/`) directly instead of HTTP fetch to their own API. The API routes are thin wrappers over the same services, which keeps zod and error mapping in one place. Check the installed Next major version and its params typing in P1. After a mutation in client code, `router.refresh()` or re-fetch with SWR/state.
**Warning signs:** Needing a restart to see new data. TypeScript errors about `params` type. Build fails on a page calling `fetch('http://localhost:3000/...')`.
**Phase to address:** P1 (versions), P3, P4.

### Pitfall 16: Hydration and browser re-verify pitfalls
**What goes wrong:** `crypto.subtle` is undefined on non-secure origins (plain HTTP on a LAN IP or a deployed http URL; localhost is fine), so browser verify throws in a reviewer's environment. `TextEncoder` encoding mismatch for non-ASCII names. Rendering local times with `toLocaleString` causes server/client hydration mismatches. Hex conversion drops leading zeros (`toString(16)` without padStart).
**Why it happens:** Dev always happens on localhost.
**How to avoid:** Feature-detect `crypto.subtle` and show a clear fallback message. UTF-8 via TextEncoder on both sides (Node `createHash('sha256').update(str, 'utf8')`). Hex with `padStart(2,'0')`. Show timestamps as the raw ISO string (or format in a client-only effect), and always display the raw ISO string in the audit detail since that is what is hashed. Browser verify fetches the raw ledger JSON from the API and runs the shared pure module, so test vectors cover both.
**Warning signs:** Verify works locally but "crypto.subtle undefined" on deploy. Console hydration warnings.
**Phase to address:** P5.

### Pitfall 17: Docker and native module packaging
**What goes wrong:** Image builds on one platform and the native binary does not match (Alpine/musl vs glibc, Node version mismatch, ARM vs x64), giving "invalid ELF header". Standalone output does not trace the `.node` file. Container runs as non-root and cannot write the SQLite file/WAL on the volume. `NODE_ENV=production` breaks the tamper demo (Pitfall 8). DB is lost on restart because there is no volume.
**Why it happens:** Docker was left for last and tested late.
**How to avoid:** Use a `node:*-slim` (glibc) base for build and run, `npm ci` in the same image that runs it, a named volume mounted at the `DATABASE_PATH` directory with correct ownership, and a healthcheck. Test `docker compose up` through steps 1 to 6 in P6, not at the end of the project. Keep standalone output optional; running `next start` with full node_modules is safer for a 2-hour task.
**Warning signs:** Docker never run before the last half hour.
**Phase to address:** P6.

### Pitfall 18: Zod version and error-shape inconsistencies
**What goes wrong:** Zod 4 differs from 3 in API details (error customization, `error.issues`/`flatten` helpers, string format helpers). Copy-pasted snippets fail to compile or return raw zod error objects, giving inconsistent 400/422 bodies and UI that cannot display inline field errors.
**How to avoid:** Pin the version, check the installed docs via Context7 in P1, and write one `parseBody(schema, req)` helper that returns `{error:'validation', fields:{path:message}}` consumed by the form for inline errors. Validate dates (due date valid, a real calendar date) and enforce `milestones.length >= 3` server-side, with the same schema shared with the client form.
**Phase to address:** P3, P4.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Duplicate canonical/hash code in browser and script | Faster to write | Drift and false "Broken" results | Never; share one module |
| Raw SQL INSERT in seed | Quick seed | Seed chain invalid, interview embarrassment | Never |
| Skipping triggers, relying on "no edit endpoint" | Saves time | Core "append-only below the app" claim false | Never (cheap, 10 lines) |
| In-memory rate limiter | No dependency | Resets on restart and HMR; not multi-instance | Acceptable; document as best-effort |
| `SELECT *` into API responses | Less mapping | Token and internal-field leaks | Never on public endpoints |
| Hashing `JSON.stringify(payload)` with a sort replacer | One line | Nested-key and array bugs | Only if the payload is provably flat, and still prefer the recursive version |
| Building UI before the ledger core | Visible progress | Late discovery of hash bugs, the 20-point area | Never; follow spec order |
| Skipping Docker until the end | More time on features | Native module / env surprises at submission | Never; smoke-test early in P6 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| better-sqlite3 | `await` inside `db.transaction`; deferred BEGIN then write | Synchronous callback, `.immediate()` |
| better-sqlite3 | `foreign_keys` assumed on | `db.pragma('foreign_keys = ON')` per connection |
| Next.js route handlers | Missing `runtime='nodejs'`; stale cached GET | Declare runtime; `force-dynamic` |
| Web Crypto | Assuming available everywhere; `TextEncoder` omitted | Secure-context check; UTF-8 encode; padStart hex |
| Vitest | Importing the app DB singleton; real file DB shared across tests | DB factory with temp/`:memory:` DB per test; tests call services/handlers directly |
| Sepolia anchor (P7) | Putting private key in repo; anchoring a non-final head | `.env.example` only; anchor head hash, record tx hash in an `ANCHORED` entry; note that this entry changes head |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Verify loads all entries and recomputes on every page view | Slow audit page | Fine at this scale; verify on button click only | Beyond about 10k entries per project (not a concern here) |
| N+1 queries on dashboard progress | Slow list | One aggregate query with `GROUP BY` | Hundreds of projects |
| Missing index on `review_token` and `(project_id, idx)` | Slow lookups | UNIQUE indexes already required | Not relevant at demo scale |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Tamper endpoint gated only in UI | Anyone can corrupt ledger | Server-side strict env check, 403 in production |
| Public verify exposes token or notes with PII | Link takeover, privacy leak | DTO allow-lists, review what notes are public (document that notes are in the ledger and so are visible to anyone with the verify link) |
| Token in URL logged/referred | Link leak | `no-referrer`, noindex, no third-party assets |
| Unbounded actor/note/payload size | DB bloat, UI break | Zod max lengths, request body size limit |
| Rendering note/actor with `dangerouslySetInnerHTML` | Stored XSS in audit page | Plain React text rendering only |
| Real names or emails in seed or repo | Brief disallows | Fictional data only |
| Claiming "tamper-proof" | Overclaim, fails interview | Say "tamper-evident"; document truncation and re-chain limits |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Client can double-click and send two decisions | Confusing 409 | Disable button while pending; friendly "already decided" state from 409 |
| Client has no proof after deciding | No trust value | Show receipt (entry index, hash) immediately (U7) |
| Raw 64-char hashes everywhere | Unreadable | Short hash (8 chars) with full hash on expand/copy |
| Verify result with no explanation | Looks fake | Show checks performed, entries count, head hash, and for Broken the expected vs stored hash |
| Tamper control looks like a normal feature | Mistaken for real | Red "DEMO ONLY" banner and confirmation |
| Missing loading, empty and error states | Loses R8 points | Skeleton, empty-state CTA, error boundary for each page |
| Invalid or unknown token page | Dead end | Neutral "link invalid or expired" page, no stack trace |

## "Looks Done But Isn't" Checklist

- [ ] **Ledger:** Verify catches a deleted last entry? It cannot, so confirm the README says so and head hash/count are shown.
- [ ] **Verify:** Detects gap in idx, wrong genesis prevHash, and project mismatch. Check with unit tests.
- [ ] **Triggers:** An `UPDATE`/`DELETE` through the app connection throws, both before and after a tamper call.
- [ ] **Concurrency:** 10 parallel decisions on one milestone produce one 201 and nine 409s, with a valid chain.
- [ ] **Restart:** Restart server, then Verify is still Valid (catches timestamp/format drift).
- [ ] **Seed:** Fresh DB, run seed, Verify is Valid. Run seed twice and nothing is duplicated.
- [ ] **Token:** Public JSON (`/api/verify/:id`, export, receipt) contains no review token; token is at least 128 bits from `randomBytes`.
- [ ] **IDOR:** Decision with another project's milestoneId returns 404.
- [ ] **Browser vs server:** Same chain gives identical hashes in Node and Web Crypto (shared vectors).
- [ ] **Prod mode:** `next build && next start` and `docker compose up` both run through demo steps 1 to 6 (or the documented dev/demo path works).
- [ ] **Status codes:** 201 create, 400/422 validation (consistent), 404 unknown, 409 repeat decision, 403 tamper in prod.
- [ ] **Empty states:** Dashboard with no projects, audit with only the genesis entry.
- [ ] **README:** Hash formula, canonical JSON rule, limits (truncation, re-chain), how to enable tamper demo, setup, improvements.
- [ ] **Secrets:** `.env.example` present, `.env` and `data/*.db*` gitignored.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hash format drift discovered late | MEDIUM | Fix the single canonical/preimage module, delete the DB file, re-run seed (no migration needed since demo data) |
| Triggers lost after failed tamper | LOW | Run idempotent `CREATE TRIGGER IF NOT EXISTS` in `getDb()` on every open |
| Forked/duplicate chain | MEDIUM | UNIQUE constraint prevents it; for a demo DB, reset DB file and reseed |
| Token leaked via public endpoint | MEDIUM | Switch to DTO mappers, rotate tokens (regenerate for the seed project) |
| Docker native binding mismatch | LOW | Switch to a slim glibc base image and `npm ci` inside the image |
| Out of time | LOW | Cut P7 and U4/U7 first; never cut verify, triggers, or the tamper flow |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Ambiguous preimage | P2 | Unit test with `|`, quote and unicode in actor |
| 2 Canonical JSON drift | P2, P5, P6 | Golden vectors pass on Node, browser path, export script |
| 3 Timestamp/index drift | P1, P2 | Restart-then-verify test; no schema defaults on hashed columns |
| 4 Concurrency / TOCTOU | P2, P3, P6 | Parallel decision test |
| 5 Weak verify / truncation | P2, P5, P6 | Gap, genesis, delete-last tests; head hash shown; README limit |
| 6 Off-by-one / break semantics | P2, P5 | Both tamper styles unit-tested; consistent numbering |
| 7 Trigger bypass safety | P1, P5, P6 | Trigger count unchanged and UPDATE still throws after tamper |
| 8 Tamper gate vs prod demo | P3, P5, P6 | Gate tests per env combination; Docker demo walk-through |
| 9 Token strength/leak | P1, P3, P6 | Public responses contain no token; generator uses randomBytes |
| 10 IDOR / client-trusted input | P3 | Cross-project milestone returns 404; strict schema rejects extras |
| 11 Seed/other writers bypass | P1, P2, P3 | Grep for single INSERT site; fresh seed verifies Valid |
| 12 Status vs ledger divergence | P2, P3 | Derived-state check in verify |
| 13 Native module bundling | P1 | `next build` and `next start` run with DB route |
| 14 Connection/HMR/build DB | P1 | No import-time DB open; works in dev, build, Vitest |
| 15 Caching / params | P1, P3, P4 | New decision visible immediately on dashboard |
| 16 Web Crypto / hydration | P5 | Secure-context fallback; no hydration warnings |
| 17 Docker packaging | P6 | `docker compose up` demo steps 1 to 6 |
| 18 Zod version / error shape | P3, P4 | Shared helper; inline field errors render |

## Phase Research Flags

- P1: Verify installed Next and Zod versions' docs (config key for external packages, `params` typing, caching defaults) via Context7 before coding.
- P5: Tamper drop/recreate trigger approach should be prototyped first, since it's the riskiest unknown for the core demo.
- P7 (Sepolia): needs its own research (viem, Hardhat/Foundry, faucet, gas); not covered here.

## Sources

- SPEC.md sections 5, 12, 14 and PROJECT.md constraints (project-specific requirements, provided)
- SQLite documentation (transactions, BEGIN IMMEDIATE, transactional DDL, triggers, WAL), from training knowledge (MEDIUM)
- better-sqlite3 README on `db.transaction`, `.immediate()`, synchronous API, pragmas (training knowledge, MEDIUM)
- RFC 4122 (UUIDv4 has 122 random bits) (HIGH); nanoid default 21 chars x 6 bits = 126 bits (HIGH, arithmetic)
- MDN Web Crypto: `crypto.subtle` is available only in secure contexts (HIGH)
- Next.js docs: external server packages, route segment config, async `params`, caching changes between 14 and 15 (training knowledge, LOW-MEDIUM, NOT re-verified this session)
- General hash-chain/certificate-transparency literature: chain alone cannot detect truncation or full re-chaining without an external head anchor (HIGH)

---
*Pitfalls research for: hash-chained audit ledger on Next.js + better-sqlite3 (SignSeal)*
*Researched: 2026-10-03*
