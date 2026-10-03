# SignSeal

SignSeal is a small web app for digital agencies that need clients to approve project milestones. The agency creates a project with milestones and shares a private, login-free review link. The client approves a milestone or requests changes (with a note). Every decision is appended to a per-project hash-chained ledger, a tamper-evident audit trail that anyone can verify, so "the client approved this on that date" is something you can show rather than just claim.

Built as the xDEVS Full-Stack Intern take-home. The full brief is in `SPEC.md`.

## Features

### Core

- Projects with milestones (3 to many), dashboard with approval progress
- Tokenized client review link (no login; 256-bit random token)
- Approve or request changes with a note, per milestone; a milestone is decided once (second attempt is 409)
- Append-only, hash-chained ledger (one DB transaction per append, UNIQUE(project_id, idx), SQLite triggers block UPDATE/DELETE)
- Server-side verify returning Valid or "Broken at entry #N"
- Audit timeline per project

### Unique additions

- Tamper map: after verify, each entry is shown as ok / broken / untrusted, with expected vs stored hash
- Browser re-verify using Web Crypto, with no server involvement in the hashing
- Failure explanation for why the chain broke (index, prev-link or self-hash)
- Gated tamper demo button, plus a pre-tampered seed project "Legacy Audit (tampered)" that is Broken at entry #2 in every mode
- Public read-only page `/verify/:id`
- Client receipt after each decision (JSON download) and a "Check a receipt" box on the public page
- JSON export of a ledger (`/api/verify/:id/export`) plus `scripts/verify-chain.mjs`, a zero-dependency verifier an auditor can run offline

## Stack

Node 24, Next.js 16 (App Router, route handlers as the REST API), React 19, TypeScript, Tailwind CSS 4, zod 4, better-sqlite3 13 with raw SQL (no ORM), Vitest 5, Docker.

## Setup

```bash
npm install
npm run seed        # creates ./data/signseal.db with "Website Redesign" and "Legacy Audit (tampered)"
npm run dev         # http://localhost:3000
```

Other scripts (all in `package.json`):

| Command | What it does |
|---|---|
| `npm run dev:demo` | `next dev` with `ENABLE_TAMPER_DEMO=true` (DEMO ONLY; refuses to run with `NODE_ENV=production`) |
| `npm test` | Vitest unit and integration tests (route handlers called directly against a temp DB) |
| `npm run build` / `npm start` | Production build / start |
| `npm run smoke:ui` | Builds, seeds, starts a production server on port 3199 and fetches every page, asserting content |
| `npm run smoke:flow` | HTTP smoke of the 7-step flow against a running server (`BASE_URL`, default `http://127.0.0.1:3000`; `EXPECT_TAMPER=enabled` for the demo profile) |
| `npm run build:seed` | Bundles `scripts/seed.ts` into `seed.mjs` (used by the Docker image) |

Environment variables (see `.env.example`):

| Variable | Default | Meaning |
|---|---|---|
| `DB_PATH` | `./data/signseal.db` | SQLite file (the directory is created on first open) |
| `ENABLE_TAMPER_DEMO` | `false` | Must equal exactly `true` to enable the tamper endpoint; ignored when `NODE_ENV=production` |
| `RATE_LIMIT_MAX` | `20` | Decisions allowed per review token per window |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate-limit window |

The database lives at `DB_PATH` (`./data/signseal.db` locally, `/app/data/signseal.db` in Docker).

### Docker

```bash
docker compose up --build                       # app on http://localhost:3000 (production mode, tamper endpoint returns 403)
docker compose --profile demo up --build demo   # DEMO ONLY: dev server with tamper enabled on http://localhost:3001
docker compose down                             # add -v to also delete the data volumes
```

The default service builds from `node:24-slim`, runs the Next standalone output as the non-root `node` user, seeds on first start (idempotent) and keeps SQLite in the `signseal-data` volume. The demo profile uses a separate `signseal-demo-data` volume.

**Docker status in this environment:** the Docker image build and `docker compose up` were NOT run while preparing this submission, because the Docker daemon socket was not accessible to the build user (permission denied). Only `docker compose config` (static validation, lists the `demo` profile) was run. The same build output was instead verified outside Docker: `next build` produces `.next/standalone` containing the better-sqlite3 native binary, the seed bundle ran against it, and `npm run smoke:flow` passed against `node .next/standalone/server.js` (production mode, tamper endpoint returned 403), data persisted across a server restart, and the demo path passed against `npm run dev:demo`. Treat the Dockerfile and compose file as untested until you run them.

## Hash design

Each ledger entry stores `index`, `timestamp`, `action`, `actor`, `payload` (canonical JSON string), `prevHash` and `hash`.

```
hash = SHA-256( index|timestamp|action|actor|canonicalJSON(payload)|prevHash )
```

(UTF-8, lowercase hex output.)

- The first entry has `prevHash` = 64 zeros (`"0".repeat(64)`).
- Canonical JSON: object keys sorted recursively, no whitespace, arrays keep their order, `undefined` values dropped, `null` kept, non-finite numbers rejected.
- `|` is the field delimiter, so an actor containing `|` is rejected (HTTP 422 `INVALID_ACTOR`).
- `index` is 0-based everywhere (storage, API, UI): the `PROJECT_CREATED` entry is entry #0.
- The stored timestamp and the stored payload string are exactly what is hashed, so nothing is re-serialised at verify time.
- The same pure module (`src/lib/ledger/hash.ts`) is used by the server and the browser; `scripts/verify-chain.mjs` is an intentionally separate hand-written copy.

Actions: `PROJECT_CREATED`, `MILESTONE_APPROVED`, `CHANGES_REQUESTED`.

## API

Errors share the shape `{ "error": { "code", "message", "details?" } }`. Status codes used: 400 (malformed JSON), 422 (validation, including missing note or invalid actor), 404, 409 (milestone already decided), 403 (tamper disabled), 429 (rate limited, with `Retry-After`).

| Method and path | Visibility | Purpose |
|---|---|---|
| `POST /api/projects` | Agency (no auth in this demo) | Create project with 3 or more milestones; returns `id` and `reviewToken`; writes `PROJECT_CREATED`. 201, 400, 422 |
| `GET /api/projects` | Agency | List projects with progress. Never includes review tokens |
| `GET /api/projects/:id` | Agency | Project detail, milestones and the client review token. 200, 404 |
| `GET /api/projects/:id/ledger` | Agency | All ledger entries (no token). 200, 404 |
| `GET /api/projects/:id/verify` | Agency | Server verification result `{ valid, brokenAt?, ... }`. 200, 404 |
| `GET /api/review/:token` | Bearer link | Client-safe project view (token not echoed; `Referrer-Policy: no-referrer`). 200, 404 |
| `POST /api/review/:token/decision` | Bearer link | Body `{ milestoneId, decision: "approved" or "changes_requested", actor, note? }`; note required for changes. Returns a receipt. 200, 400, 404, 409, 422, 429 |
| `GET /api/verify/:id` | Public | Read-only verification, ledger and head hash by project id (never exposes the review token). 200, 404 |
| `GET /api/verify/:id/export` | Public | Downloadable JSON export for `scripts/verify-chain.mjs` (`Cache-Control: no-store`). 200, 404 |
| `POST /api/dev/tamper/:entryId` | Demo only | Mutates one stored entry (`entryId` is the `ledger_entries` row id). 403 unless `NODE_ENV!=production` and `ENABLE_TAMPER_DEMO=true`; 404 for unknown id |

UI pages: `/` (dashboard), `/projects/new`, `/projects/:id`, `/projects/:id/audit`, `/review/:token`, `/verify/:id`.

## Demo walkthrough (the 7 steps)

Start with `npm run seed && npm run dev:demo` (open http://localhost:3000).

1. Click "New project", create "Website Redesign" with 3 milestones. The dashboard shows 0 / 3 approved. (`npm run seed` already created a similar one.)
2. On the project page use "Copy client link" and open it in a private window. Enter a name, approve milestone 1, then request changes on milestone 2 with a note.
3. Back on the agency project page: progress now shows 1 / 3 with updated badges and no manual edit.
4. Click "View audit trail": entries #0, #1, #2, each showing its previous hash.
5. Click "Verify audit trail": **Valid**. "Re-verify in browser" does the same with Web Crypto.
6. Click "Tamper (DEMO ONLY)" and confirm, then verify again: **Broken at entry #N**, and the tamper map shows the broken block and the untrusted ones after it.
7. Bonus step 7 (anchoring on Sepolia) is not implemented. See "What I would improve".

Also try `/verify/:id` (public page, no login) and the receipt JSON download after a decision.

## Tamper demo

- Locally: `npm run dev:demo`, or copy `.env.example` to `.env.local` and set `ENABLE_TAMPER_DEMO=true`, then restart `npm run dev`.
- Docker: `docker compose --profile demo up --build demo` and open http://localhost:3001.
- In production (`npm start`, the default compose service) the endpoint always returns 403 `TAMPER_DISABLED`. Use the seeded "Legacy Audit (tampered)" project instead: it shows Broken at entry #2.

## Verifying an export independently

```bash
curl -o export.json http://localhost:3000/api/verify/<project-id>/export
node scripts/verify-chain.mjs export.json
node scripts/verify-chain.mjs export.json --head <headHashYouRecordedEarlier>
```

Exit code 0 means valid, 1 means broken or mismatched, 2 means usage or unreadable input. `--head` pins the expected head hash so truncation is detected.

## Security model and limits

- The ledger is tamper-evident, not tamper-proof. Altering or deleting an entry in place is detected. SQLite triggers also block UPDATE/DELETE through the app, but anyone with write access to the database file can rewrite the whole chain consistently (re-chain every hash), and that is undetectable by the chain alone.
- Tail truncation (dropping the newest entries) leaves a shorter chain that is still internally valid. Without an external anchor it is not detectable. Mitigations: publish or record the head hash (`--head`), keep the client receipts, and keep earlier exports to compare against.
- Actor names are self-asserted by whoever holds the link. The review link is a bearer token: anyone with it can decide. There is no link expiry or revocation.
- Agency endpoints have no authentication in this take-home (single-tenant demo assumption).
- Rate limiting is in-memory and per process; it resets on restart and does not span instances.
- The tamper endpoint is gated by `NODE_ENV !== production` AND `ENABLE_TAMPER_DEMO === "true"`, evaluated on every request.

## AI usage

Built with Claude Code using GSD (get-shit-done) spec-driven planning: roadmap, phase plans and per-task commits live in `.planning/`. The hash and canonical-JSON logic and the verifier were reviewed by hand, and are covered by unit and integration tests, plus the smoke scripts above.

## What I would improve

- Anchor the head hash externally (for example on the Sepolia testnet, or a published/signed checkpoint) to close the truncation and re-chain gaps. This is not implemented.
- Real authentication for the agency side and multi-tenant isolation
- Review-link expiry and revocation, multiple reviewers per milestone
- Email notifications
- Postgres and a shared rate limiter for multi-instance deployments
- Run and CI-test the Docker image (it was not exercised here, see above)
