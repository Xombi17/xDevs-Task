# Architecture Research

**Domain:** Hash-chained (tamper-evident) audit ledger web app, Next.js App Router + better-sqlite3
**Researched:** 2026-10-03
**Confidence:** HIGH for ledger/SQLite patterns (well-established, derived from SPEC and known SQLite/better-sqlite3 semantics); MEDIUM for Next.js specifics (version-dependent details flagged below; verify against installed version).

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     Browser (untrusted by server)                 │
│  /  /projects/new  /projects/[id]  /projects/[id]/audit           │
│  /review/[token]   /verify/[id]                                   │
│  ┌────────────────┐  ┌───────────────────────────────────────┐   │
│  │ Forms / views  │  │ Browser re-verify (Web Crypto)        │   │
│  └───────┬────────┘  │ uses SAME pure lib/ledger/canonical   │   │
│          │           └──────────────────┬────────────────────┘   │
└──────────┼──────────────────────────────┼────────────────────────┘
           │ fetch (JSON)                 │ GET /ledger (raw entries)
┌──────────▼──────────────────────────────▼────────────────────────┐
│             Next.js Route Handlers (runtime = nodejs)             │
│  zod parse -> call service -> map errors to HTTP codes            │
│  /api/projects  /api/review/[token]  /api/projects/[id]/ledger    │
│  /api/projects/[id]/verify  /api/verify/[id]  /api/dev/tamper     │
├───────────────────────────────────────────────────────────────────┤
│                      Services (domain logic)                       │
│  projects.service   review.service   verify.service  tamper.service│
│            │               │               │              │        │
│            └───────┬───────┴───────┬───────┘              │        │
│                    ▼               ▼                      │        │
│          ┌──────────────────┐ ┌──────────────────┐        │        │
│          │ ledger.append    │ │ ledger.verify    │        │        │
│          │ (ONLY writer)    │ │ (pure, read-only)│        │        │
│          └────────┬─────────┘ └────────┬─────────┘        │        │
│                   └──────┬─────────────┘                  │        │
│              ┌───────────▼──────────┐                     │        │
│              │ lib/ledger/hash.ts   │ canonicalJson,      │        │
│              │ PURE, no I/O         │ computeHash, GENESIS│        │
│              └──────────────────────┘                     │        │
├───────────────────────────────────────────────────────────┼────────┤
│                    Data layer (better-sqlite3)             │        │
│  db singleton (WAL, FK on)  ──  projects / milestones /    │        │
│  ledger_entries + TRIGGERS (BEFORE UPDATE/DELETE -> ABORT) │        │
│  tamper.service uses a separate, gated path ◄──────────────┘        │
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `lib/ledger/hash.ts` (ledger core, pure) | `canonicalJson`, `computeEntryHash`, `GENESIS_HASH`, types. Zero imports from node/db so it runs in Node, Vitest AND browser | Pure functions; sha256 injected or via `globalThis.crypto.subtle` |
| `lib/ledger/append.ts` | The ONLY code path that inserts into `ledger_entries` and mutates milestone status | One `db.transaction(fn).immediate()` : read head -> compute -> insert -> update milestone |
| `lib/ledger/verify.ts` | Walk entries from idx 0, recompute, check linkage, return structured result | Pure function over `LedgerEntry[]` (no DB) so server, browser and standalone script share it |
| `lib/db/index.ts` | Open connection once, pragmas, run migrations/schema + triggers | `globalThis` singleton (survives Next dev HMR) |
| `lib/db/schema.sql` / migrate | Tables, UNIQUE(project_id, idx), immutability triggers | Plain SQL string executed at startup (idempotent `IF NOT EXISTS`) |
| Services | Business rules (decide-once, project creation, token lookup) | Plain TS functions taking validated input, throwing typed `AppError(code)` |
| Route handlers | HTTP only: parse (zod), call service, map to status | Thin; no SQL, no hashing |
| `tamper.service` | Dev-only mutation of one stored entry | Gated by `NODE_ENV !== 'production'` AND `ENABLE_TAMPER_DEMO==='true'` |
| UI (server + client components) | Pages, tamper map, verify buttons | Server components for reads; small client components for forms/verify |
| `scripts/verify.mjs`, `scripts/seed.ts` | Standalone verifier (U8), demo seed (U6) | Re-import `hash.ts`/`verify.ts` (or inline copy for zero-dep script) |

## Recommended Project Structure

```
src/
├── app/
│   ├── page.tsx                         # dashboard
│   ├── projects/new/page.tsx
│   ├── projects/[id]/page.tsx
│   ├── projects/[id]/audit/page.tsx     # timeline + Verify + tamper map
│   ├── review/[token]/page.tsx
│   ├── verify/[id]/page.tsx             # public
│   └── api/
│       ├── projects/route.ts            # GET list, POST create
│       ├── projects/[id]/route.ts
│       ├── projects/[id]/ledger/route.ts
│       ├── projects/[id]/verify/route.ts
│       ├── review/[token]/route.ts
│       ├── review/[token]/decision/route.ts
│       ├── verify/[id]/route.ts
│       └── dev/tamper/[entryId]/route.ts
├── lib/
│   ├── ledger/        # hash.ts, verify.ts, append.ts, types.ts  (hash+verify are isomorphic)
│   ├── db/            # index.ts (singleton), schema.sql, queries
│   ├── services/      # projects, review, tamper
│   ├── validation/    # zod schemas (shared with client forms)
│   ├── errors.ts      # AppError + toHttpResponse()
│   └── token.ts       # randomBytes(24).toString('base64url')
├── components/        # TamperMap, Timeline, VerifyPanel, StatusBadge, states (Loading/Empty/Error)
scripts/               # seed.ts, verify-chain.mjs
tests/                 # unit (hash, verify, triggers), integration (7-step flow)
data/                  # signseal.db (gitignored)
```

### Structure Rationale

- **`lib/ledger/` isolated and DB-free for hash+verify:** the same bytes of code prove integrity on server, in browser (U2), in Vitest, and in the export script (U8). One implementation = no hash drift between environments.
- **Routes thin, services fat:** integration test can call services directly; routes stay trivially reviewable for the interview.
- **`append.ts` as sole writer:** makes "no edit/delete via app" auditable by grep.

## Architectural Patterns

### Pattern 1: Pure hash core with injected SHA-256

**What:** `computeEntryHash` is async and uses `crypto.subtle.digest('SHA-256')`, which exists in browsers and in Node 18+ (`globalThis.crypto`). One implementation for both sides.
**When to use:** whenever the browser must reproduce server hashes (U2).
**Trade-offs:** async everywhere (including inside the better-sqlite3 transaction, which is synchronous). Resolution: use a sync variant for the server write path (`node:crypto` createHash) behind the same `canonicalJson`/`preimage` function, and test that sync and async outputs are identical. Only the preimage string construction must be shared; the digest call is a one-liner.

```typescript
// lib/ledger/hash.ts  (no node/db imports)
export const GENESIS_HASH = "0".repeat(64);

export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).sort()
    .filter(k => o[k] !== undefined)
    .map(k => JSON.stringify(k) + ":" + canonicalJson(o[k])).join(",") + "}";
}

// Single source of truth for what gets hashed.
export function preimage(e: {index:number; timestamp:string; action:string;
  actor:string; payload:unknown; prevHash:string}): string {
  return [e.index, e.timestamp, e.action, e.actor, canonicalJson(e.payload), e.prevHash].join("|");
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
```

Note: `|` as separator is ambiguous if `actor` contains `|` (field-boundary collision, e.g. actor `a|b`). Mitigate by rejecting `|` in actor via zod (or escaping); the spec fixes the format, so validate rather than change it. Document in README.

### Pattern 2: Serialized append in one IMMEDIATE transaction

**What:** read head, compute hash, insert, update milestone, all inside `db.transaction(...).immediate()` (better-sqlite3 transaction functions expose `.immediate()` -> `BEGIN IMMEDIATE`, taking the write lock up front so two appenders cannot both read the same head).
**When to use:** every ledger write.
**Trade-offs:** default `BEGIN` (deferred) can still work thanks to UNIQUE(project_id, idx) (loser gets SQLITE_CONSTRAINT and must retry), but `.immediate()` avoids the retry path. Keep UNIQUE anyway as the backstop. better-sqlite3 is synchronous and single-process, so within one Node process requests are naturally serialized; the constraint matters for multi-process (Docker replicas, `next dev` workers).

```typescript
const appendTx = db.transaction((projectId: string, a: NewEvent) => {
  const head = db.prepare(
    "SELECT idx, hash FROM ledger_entries WHERE project_id=? ORDER BY idx DESC LIMIT 1").get(projectId);
  const index = head ? head.idx + 1 : 0;
  const prevHash = head ? head.hash : GENESIS_HASH;
  const timestamp = new Date().toISOString();           // store EXACTLY this string
  const payload_json = canonicalJson(a.payload);        // store the canonical string
  const hash = sha256HexSync(preimageFromParts(index, timestamp, a.action, a.actor, payload_json, prevHash));
  db.prepare("INSERT INTO ledger_entries(...) VALUES (...)").run(...);
  if (a.milestoneUpdate) { /* decide-once: UPDATE ... WHERE id=? AND status='PENDING'; if changes===0 throw AppError(409) */ }
});
appendTx.immediate(projectId, event);
```

Key choices: the decide-once check and milestone update live in the same transaction as the ledger insert, so a rejected decision writes no ledger entry and a ledger entry never exists without its state change.

### Pattern 3: Immutability at the database layer (triggers)

**What:** triggers abort any UPDATE/DELETE on `ledger_entries`.

```sql
CREATE TRIGGER IF NOT EXISTS ledger_no_update
BEFORE UPDATE ON ledger_entries
BEGIN SELECT RAISE(ABORT, 'ledger_entries is append-only'); END;

CREATE TRIGGER IF NOT EXISTS ledger_no_delete
BEFORE DELETE ON ledger_entries
BEGIN SELECT RAISE(ABORT, 'ledger_entries is append-only'); END;
```

**Tamper demo path:** SQLite DDL is transactional, so tamper does inside one transaction: `DROP TRIGGER ledger_no_update; UPDATE ledger_entries SET payload_json=? WHERE id=?; CREATE TRIGGER ledger_no_update ...;`. Re-creating from the same SQL constant used at startup guarantees the trigger is restored even on partial failure (transaction rolls back). Alternative (spec's "separate raw connection") does not bypass triggers by itself, since triggers are stored in the DB file; a second connection still sees them. So drop/recreate is the real mechanism. Be honest in README: triggers stop the app, not someone with file access; that is exactly why the hash chain exists.

**Trade-offs:** `ALTER`/`DROP TABLE` still possible, and `PRAGMA recursive_triggers` is irrelevant here. Also guard `INSERT OR REPLACE`/`UPSERT`: REPLACE deletes the old row, and delete triggers only fire for REPLACE when recursive triggers are enabled, so never use REPLACE on this table (UNIQUE collision simply errors, which is desired).

### Pattern 4: Verify returns evidence, not a boolean

**What:** `verifyChain(entries)` returns `{valid, headHash, length, brokenAt?, entries: [{index, status: 'ok'|'broken'|'untrusted', expectedHash, storedHash, expectedPrevHash, storedPrevHash, fieldDiff?}]}`. Checks per entry: idx equals position (detects deleted/reordered middle rows), prevHash equals previous stored hash (genesis for 0), recomputed hash equals stored hash. Stop-the-world at first failure for `brokenAt`, but still compute per-entry statuses so the UI (tamper map, U1) can colour blocks.
**Trade-offs:** field diff (U4): hashes are one-way, so the diff cannot identify which field was altered from the hash alone. Practical implementation: report which of {prevHash linkage, hash recompute} failed, and compare stored columns against redundancy, e.g. payload also embedded where derivable (milestone status in `milestones` table vs the ledger event; `actor`/`decided_by`). Expect U4 to be "best-effort cross-reference", not exact. Flag this in the roadmap.

Amber semantic: tampering with entry N's content makes N's recomputed hash differ from its stored hash. Entry N+1's `prevHash` still equals N's stored hash, and N+1's own hash still recomputes correctly, so downstream entries individually pass. Amber should therefore mean "downstream of a break, cannot be trusted/attested", not "also mismatched". If the attacker instead rewrote N's hash too, the break surfaces at N+1's linkage. Surface both cases in tests.

### Pattern 5: Server verify + browser re-verify of the same raw data

**What:** Server verify is convenience; browser verify fetches `GET /api/projects/:id/ledger` (raw rows) and runs the shared `verifyChain` locally with Web Crypto. Shows the trust model: do not trust the server's "Valid" verdict.
**Caveat to state in README:** if the server serves tampered rows, both verifications run on the same data; browser verify proves the *math*, not that the server shows the real DB or the complete chain (truncation). The strongest independent check is a head hash the client holds (U7 receipt: index + hash) or an on-chain anchor. Make the receipt check part of public verify: "your receipt hash at index k matches the chain" catches rewriting.

## Data Flow

### Request Flow (client decision, the critical path)

```
Client submits {milestoneId, decision, actor, note}
    ↓
POST /api/review/[token]/decision
    ↓ zod parse (400/422), rate limit (429)
review.service.decide(token, input)
    ↓ lookup project by token (404)
ledger.append (BEGIN IMMEDIATE)
    ├─ milestone belongs to project? else 404/422
    ├─ UPDATE milestones SET status.. WHERE id=? AND status='PENDING'  (0 rows -> 409)
    ├─ read head -> compute hash -> INSERT ledger_entries
    └─ COMMIT
    ↓
201 {entry index, hash}  -> receipt (U7)
```

### Verify Flow

```
Audit page "Verify" ─► GET /api/projects/:id/verify
        server: SELECT * FROM ledger_entries ORDER BY idx -> verifyChain -> JSON
Audit page "Re-verify in browser" ─► GET /api/projects/:id/ledger -> verifyChain (Web Crypto) locally
Public /verify/[id] ─► GET /api/verify/:id (read-only, same engine, no token/secret exposed)
```

### Key Data Flows

1. **Create project:** one transaction inserts project (with random token), milestones, and `PROJECT_CREATED` ledger entry (idx 0, genesis prev). Atomic: no project without a genesis entry. Route this through `ledger.append`, not a separate insert.
2. **Derived state:** milestone `status` is a cache updated only inside the append transaction. Optionally the verify service also replays the ledger to recompute milestone statuses and flags mismatches ("state drift"), closing the hole that someone edits `milestones` directly (the chain doesn't cover that table).
3. **Export (U8):** `GET /api/projects/:id/ledger?download=1` returns `{projectId, exportedAt, headHash, entries[]}`; standalone `scripts/verify-chain.mjs` reads it, using the same canonical algorithm (copy inlined so it has no dependencies).
4. **Tamper:** POST `/api/dev/tamper/:entryId` -> 403 unless both gates pass (also 404 in prod is acceptable; spec says 403) -> drop trigger, mutate, recreate trigger in one transaction. Read gates at request time, not at import time.

## Server vs Client Verification

| Aspect | Server verify | Browser verify |
|--------|---------------|----------------|
| Source of truth | DB rows directly | Rows as served by `/ledger` API |
| Crypto | node:crypto (or same subtle API) | Web Crypto `crypto.subtle` (requires secure context: https or localhost) |
| Code | `lib/ledger/verify.ts` | Same file, bundled client-side |
| Proves | Chain is internally consistent in the DB | Math is right independent of server's verdict; not that server is honest |
| Residual gap | Tail truncation, whole-chain rewrite | Same; closed only by external head hash (receipt, export held elsewhere, on-chain anchor) |

Always show `headHash` + `length` prominently on audit and verify pages.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Demo / 0-1k users | Single Node process, SQLite WAL, in-memory rate limiter. Exactly right. |
| 1k-100k | Verify is O(n) per project: cache last verified `(length, headHash)`, verify incrementally from checkpoint; move to Postgres with `SELECT ... FOR UPDATE` on a per-project head row; shared rate limiter (Redis). |
| 100k+ | Periodic Merkle/anchor checkpoints; per-project sharding. Irrelevant to this task. |

### Scaling Priorities

1. **First bottleneck:** SQLite single writer plus in-memory rate limit not shared across instances. Fine for a take-home; document.
2. **Second bottleneck:** full-chain verification on every page view; chains are tiny (tens of entries), so ignore.

## Anti-Patterns

### Anti-Pattern 1: Hashing `JSON.stringify(payload)` of a re-parsed object

**What people do:** store payload as JSON text, parse it, hash a fresh `JSON.stringify` (key order and number formatting can differ), or hash `new Date()` re-formatted on read.
**Why it's wrong:** verification breaks on harmless re-serialisation; false "Broken" in the demo.
**Do this instead:** store the exact canonical `payload_json` string and exact ISO `timestamp` string used in the preimage; verify re-canonicalises `JSON.parse(payload_json)` and also should compare against the stored string.

### Anti-Pattern 2: Computing the next index/prevHash outside the transaction

**What people do:** read head in one query, insert later.
**Why it's wrong:** concurrent requests fork the chain (two entries with the same prevHash).
**Do this instead:** read+insert inside `.immediate()` transaction, with UNIQUE(project_id, idx) as backstop; map SQLITE_CONSTRAINT_UNIQUE to 409/retry.

### Anti-Pattern 3: Verify logic only in the server route (or duplicated in the client)

**What people do:** write verify in an API handler, then rewrite it for the browser.
**Why it's wrong:** two implementations drift; interview question "how do you know they agree?" has no answer.
**Do this instead:** one pure `verifyChain`, imported by route, component, tests, script.

### Anti-Pattern 4: Trusting client-supplied status/hash/actor identity

**What people do:** accept `status` or `hash` in request bodies.
**Why it's wrong:** breaks integrity model.
**Do this instead:** server derives status, index, timestamp, hash, prevHash; client supplies only `milestoneId`, `decision`, `actor`, `note`. Note `actor` is self-asserted (name typed by client); say so in README, and consider recording token-id in payload.

### Anti-Pattern 5: DB opened per request / at module scope without guard

**What people do:** `new Database()` in each handler, or at module top-level, which Next dev HMR re-executes, leaking handles and re-running migrations.
**Do this instead:** `globalThis.__db ??= open()`; run schema idempotently; list `better-sqlite3` in `serverExternalPackages` in `next.config` (native module; verify key name for the installed Next version) and set `export const runtime = 'nodejs'` on route handlers.

### Anti-Pattern 6: Leaking the review token or tamper endpoint

**What people do:** return `review_token` from public endpoints (`/api/verify/:id`, `/ledger`), check env gate only in the UI.
**Do this instead:** token only in `GET /api/projects/:id` (agency view); ledger/public-verify responses omit it; gate tamper server-side; do not put the token in ledger payloads.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Sepolia anchor (stretch, last phase) | Separate `lib/anchor/` module called after append; stores `tx_hash`, then appends `ANCHORED` ledger event containing the anchored head hash | Anchoring appends an entry, which changes head; anchor the hash *before* the ANCHORED entry and say so. Must never block or fail core append (async, best-effort). |
| Docker | Volume-mount `data/` for the SQLite file; build needs native better-sqlite3 (use a node image matching build arch, avoid alpine/musl prebuild mismatches or install build tools) | Run schema init on start |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Route <-> Service | Direct function call, typed errors | Routes never touch `db` |
| Service <-> `ledger.append` | Direct call; append is the only writer to `ledger_entries` | Enforce via code review/grep test |
| `verify` <-> DB | None; takes `LedgerEntry[]` | Keeps it isomorphic and unit-testable |
| UI <-> API | fetch JSON; server components may call services directly | Don't call own HTTP API from server components (use services) |
| Server <-> Browser crypto | Shared `lib/ledger/*` pure modules | Keep free of `node:` imports |

## HTTP Error Mapping (for consistent R7)

| Condition | Code |
|-----------|------|
| Malformed JSON / zod syntactic failure | 400 |
| Semantically invalid (e.g. <3 milestones, missing note for changes) | 422 (pick one convention for zod failures and apply uniformly; document it) |
| Unknown project/token/entry | 404 (token lookup: same 404 for invalid tokens, no oracle) |
| Milestone already decided | 409 |
| Tamper in production / flag off | 403 |
| Rate limited | 429 |

## Suggested Build Order (dependencies)

1. **Ledger core (pure):** `hash.ts`, `verify.ts`, types, unit tests (canonicalisation, known vector, tamper detection). No dependencies; highest interview value; de-risks R4 first.
2. **Schema + DB singleton + triggers + trigger tests:** UNIQUE and trigger abort tested via raw SQL.
3. **`ledger.append` + services (create project, decide):** needs 1+2. Test concurrency/decide-once (409) here.
4. **API routes + zod + error mapping:** needs 3. Integration test of the 7-step flow at service/route level.
5. **UI core:** dashboard, new project, project page, review page, audit timeline + server Verify.
6. **Tamper endpoint + tamper map + browser re-verify + diff:** needs 1,2,5 (reuses verify result shape; design the per-entry result shape in step 1 so this is just rendering).
7. **Public verify, export + standalone script, receipt, seed, README, Docker.**
8. **Bonus:** Sepolia anchor, deploy.

Design now to avoid rework: define the `VerifyResult` per-entry shape (expected/stored hashes, status ok/broken/untrusted) in step 1, because U1, U2, U3, U4 all consume it.

## Sources

- docs/SPEC.md and .planning/PROJECT.md (project requirements; HIGH confidence for intent)
- better-sqlite3 documentation: transactions (`.immediate()`, `.deferred()`, `.exclusive()`), synchronous API (https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) (from prior knowledge; not re-fetched this session, verify)
- SQLite docs: CREATE TRIGGER / RAISE(ABORT), transactional DDL, REPLACE conflict resolution and delete triggers (https://www.sqlite.org/lang_createtrigger.html, https://www.sqlite.org/lang_conflict.html) (from prior knowledge, verify)
- MDN SubtleCrypto.digest; Node `globalThis.crypto` (Node 18+) (prior knowledge, MEDIUM)
- Next.js docs on `serverExternalPackages`, route handler `runtime`, dynamic params (verify against installed Next version; params became async Promises in recent majors)

---
*Architecture research for: hash-chained ledger web app (SignSeal)*
*Researched: 2026-10-03*
