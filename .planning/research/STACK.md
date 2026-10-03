# Technology Stack

**Project:** SignSeal (tamper-evident approval ledger)
**Researched:** 2026-10-03
**Version source:** `npm view` against the registry on 2026-10-03, plus the Next.js 16 upgrade guide (nextjs.org/docs, v16.3.8, updated 2026-08-25). Context7 was not queried. Engines and peer deps come from registry metadata.

## Recommended Stack

### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 24 LTS (>=22.12) | Runtime | better-sqlite3 13 needs Node >=22. Vitest 5 needs ^22.12 or ^24. Hardhat 3 also needs a modern Node. Use 24 locally and in Docker. (HIGH) |
| Next.js | 16.3.8 (`^16.3`) | App Router, route handlers (REST API), pages | Current stable. Turbopack is the default for dev and build. `params` and `searchParams` are async, so always `await props.params`. `middleware` is renamed `proxy`, and you don't need either. `next lint` is removed. (HIGH) |
| React / react-dom | 19.3.0 | UI | Peer of Next 16. (HIGH) |
| TypeScript | 5.9.3 (pin `~5.9.3`) | Types | Registry `latest` is 7.0.2 (the native-compiler line). Next 16 documents TS >=5.1 and declares a typescript dependency. I did not find explicit TS 7 support in the Next, Vitest or Hardhat docs. A 2h build can't afford toolchain surprises. Move to 7 later. (MEDIUM) |
| Tailwind CSS | 4.3.3 | Styling | v4 is CSS-first. Install `tailwindcss @tailwindcss/postcss postcss`. Use `postcss.config.mjs` with `"@tailwindcss/postcss": {}` and `@import "tailwindcss";` in globals.css. There is no `tailwind.config.js`, and don't add one. (HIGH) |
| zod | 4.6.5 | Validation on every route and form | v4 is current. Use `z.object`, `.safeParse`, and `z.iso.datetime()` / `z.uuid()`. Map failures to 400 or 422 via `error.issues`. Don't use v3 idioms such as `z.string().email()` (deprecated) or `.format()`. (HIGH on version, MEDIUM on API details) |

### Database
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| better-sqlite3 | 13.0.3 | Synchronous SQLite, file DB | Synchronous API makes `db.transaction()` for "read head -> insert" trivially safe. Triggers and UNIQUE work natively. Prebuilt binaries exist for Node 22+/24. (HIGH) |
| @types/better-sqlite3 | 9.6.0 | Types | The package ships no types. (MEDIUM; confirm it covers the 13.x API) |
| Raw SQL (no ORM) | n/a | Schema, triggers, queries | Use a single `schema.sql` string executed at startup via `db.exec`. The BEFORE UPDATE/DELETE triggers must be hand-written SQL anyway, and the interview needs readable hash logic. Skip Drizzle. (HIGH) |

Settings: `db.pragma('journal_mode = WAL')`, `foreign_keys = ON`. Put the DB path in `DATABASE_PATH` (default `./data/signseal.db`).

Tamper demo: open a second raw connection, `DROP TRIGGER`, `UPDATE`, then recreate the trigger inside one transaction. Gate it on `NODE_ENV !== 'production' && ENABLE_TAMPER_DEMO === 'true'`.

### Ledger / Crypto
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `node:crypto` | built in | `createHash('sha256')`, `randomBytes(32).toString('base64url')` for review tokens | Zero dependencies. 32 bytes is 256 bits, above the 128-bit requirement. (HIGH) |
| Web Crypto (`crypto.subtle.digest`) | built in | Browser re-verify (U2) | Needs a secure context (localhost or HTTPS). Fine for the demo. (HIGH) |
| Hand-written `canonicalJson()` | n/a (about 15 lines) | Key-sorted, no-whitespace JSON | Don't add a dependency. Share one pure module (`lib/ledger/hash.ts`) with no Node imports, so the same file runs in Node, in the browser (using `crypto.subtle`) and in the standalone verify script. (HIGH) |

### Testing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | 5.0.3 | Unit and integration tests | Needs Vite ^6.4, ^7 or ^8 (Vitest 5 pulls in Vite 8.x itself). Call route handlers directly (`import { POST } from '@/app/api/...'` with `new Request(...)`) against a temp-file DB for the 7-step flow. No server or Playwright needed. (HIGH) |
| vite-tsconfig-paths | latest | Resolves the `@/*` alias in Vitest | Alternative: `resolve.alias` in `vitest.config.ts`, which has zero extra deps. Prefer the alias. (MEDIUM) |

Set `environment: 'node'`. There is no jsdom and no `@vitejs/plugin-react` because we aren't unit-testing components. Cutting those saves time.

### Infrastructure
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker | `node:24-slim` (Debian) | Image | Use glibc/slim, not alpine, so the better-sqlite3 prebuilt binary installs without a compiler. (MEDIUM) |
| Next `output: 'standalone'` | n/a | Small runtime image | Mount a volume at `/app/data` for the SQLite file. Verify the `.node` binary is traced into `.next/standalone`. If it isn't, add `serverExternalPackages: ['better-sqlite3']` and `outputFileTracingIncludes`. (MEDIUM, test the image build early) |
| docker compose | v2 | One-command run | One service, a named volume for `/app/data`, env from `.env`. |
| ESLint | 10.x with `eslint-config-next` 16.3.8 (flat config) | Lint | Optional. `next build` no longer lints. Skip if short on time. |

### Sepolia anchor (bonus, last phase only)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| viem | 2.57.2 | App-side client (`createWalletClient`, `createPublicClient`, `sepolia` from `viem/chains`, `privateKeyToAccount` from `viem/accounts`) | Lightweight and typed. Used server-side in an `/api/projects/:id/anchor` route. (HIGH) |
| Hardhat | 3.18.1 | Compile and deploy `Anchor.sol` | Hardhat 3 is ESM-only. Requires Node >=22. (MEDIUM) |
| @nomicfoundation/hardhat-toolbox-viem | 5.0.7 | Bundles the viem, ignition and verify plugins | The peer deps are viem ^2.47.6 and hardhat ^3.8, which match the versions above. (MEDIUM) |
| Solidity | 0.8.x (Hardhat's bundled solc) | `anchor(string projectId, bytes32 hash)` that emits an event | Keep it to about 10 lines with an event and no storage, which is cheapest. (HIGH) |

Isolate Hardhat in a `contracts/` sub-folder with its own `package.json` and `tsconfig`. Its ESM-only, plugin-heavy config then can't break the Next build. The app needs only the deployed address plus a minimal ABI. Hardhat 3 config uses the new `defineConfig` / `configVariable` API, and the 2.x `hardhat-toolbox` docs are stale. Read the Hardhat 3 docs before writing it.

Env: `SEPOLIA_RPC_URL`, `ANCHOR_PRIVATE_KEY` (a throwaway key, never committed), `ANCHOR_CONTRACT_ADDRESS`. Use a public RPC or Alchemy/Infura free tier. The faucet is the usual blocker, so get testnet ETH early.

### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node | 24.x (not the registry `latest`, 26) | Node types | Match the runtime major. |
| @types/react, @types/react-dom | 19.x | React types | Required by Next 16. |
| `tsx` | latest | Run `seed.ts` and the standalone `verify-chain.ts` | Use `npx tsx scripts/seed.ts`. The alternative is plain `.mjs` scripts, which is even simpler for the standalone verify. |
| `clsx` | latest | Conditional class names | Optional. Template literals also work. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| DB layer | better-sqlite3 + raw SQL | Drizzle ORM (0.45.3) | Triggers and a transaction-based hash chain are raw SQL anyway. An ORM adds setup, migrations and time, and hides the core logic from interviewers. |
| DB driver | better-sqlite3 | `node:sqlite` (built in) | Brief mandates better-sqlite3. `node:sqlite` is the fallback if native install breaks. |
| Validation | zod 4 | valibot, yup | Mandated by the spec, and the team knows it. |
| Test runner | Vitest | Jest | Spec says Vitest. It handles TS and ESM with no config. |
| Components | Plain Tailwind | shadcn/ui, MUI | The UI is about 6 pages, and a component library eats the 2h. Hand-roll a small `Badge`, `Button`, `Card` and `Spinner`. |
| Data fetching | Server Components (read DB directly) plus `fetch` to the REST API from client components | React Query, SWR | Extra dependency for no gain. The pages that need loading states can use `loading.tsx` and client `useState`. |
| Mutations | REST route handlers (required by R7) | Server Actions | The spec grades the REST API, so use route handlers and call them with `fetch`. |
| Chain lib | viem | ethers v6 | The spec names viem, and it has a smaller bundle. |
| Contract tooling | Hardhat 3 | Foundry | Foundry needs a Rust toolchain install. Hardhat is npm-only. Hardhat 2 is legacy. |
| TypeScript | 5.9.3 | 7.0.2 | See the table above. |
| Auth for tamper endpoint | env flag plus `NODE_ENV` check | any auth library | Out of scope. |
| Rate limiting | in-memory Map in a helper (about 20 lines) | `rate-limiter-flexible`, Upstash | Spec says "basic in-memory". |

## What NOT to Use
- **Pages Router / `getServerSideProps`**: the App Router is mandated.
- **Edge runtime for any route using better-sqlite3 or `node:crypto`**: native modules only run on the Node runtime. Next 16's `proxy` is Node-only, but no proxy is needed. Add `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'` to API routes and pages that read the DB. Otherwise Next may statically prerender at build time and bake in empty data or fail with no DB. (HIGH on the principle, MEDIUM on exact defaults)
- **`JSON.stringify` directly for hashing**: key order isn't canonical.
- **`Date` objects in hashes**: hash the exact ISO string stored in the DB.
- **Tailwind 3 setup** (`tailwind.config.js`, `@tailwind base`): v4 replaces it.
- **Prisma**: heavy, and there's a generate step.
- **Hardhat 2 / `hardhat-toolbox` (non-viem)** tutorials.
- **Cloud DBs, Redis, queues**: contradict the zero-service premise.
- **Alpine base image** unless you've confirmed the better-sqlite3 binary works there.

## Installation

```bash
# Scaffold (answer: TypeScript, Tailwind, App Router, src/ dir optional, alias @/*, no ESLint if short on time)
npx create-next-app@16 signseal --ts --tailwind --app --use-npm --turbopack --import-alias "@/*"
cd signseal

# Core runtime
npm install better-sqlite3@13.0.3 zod@4.6.5

# Dev
npm install -D vitest@5.0.3 @types/better-sqlite3 @types/node@24 tsx typescript@~5.9.3

# Verify Tailwind is v4 after scaffold (create-next-app 16 should install tailwindcss ^4 + @tailwindcss/postcss)
npx tailwindcss --help >/dev/null 2>&1; npm ls tailwindcss @tailwindcss/postcss

# --- Bonus phase only, in contracts/ (separate package) ---
mkdir contracts && cd contracts && npm init -y
npm install -D hardhat@3.18.1 @nomicfoundation/hardhat-toolbox-viem@5.0.7 viem@2.57.2
# and in the Next app root:
npm install viem@2.57.2
```

Scripts: `"dev": "next dev"`, `"build": "next build"`, `"start": "next start"`, `"test": "vitest run"`, `"seed": "tsx scripts/seed.ts"`. Don't pass `--turbopack` explicitly (it's the default). If a `webpack` config is present, `next build` fails.

`.env.example`: `DATABASE_PATH`, `NODE_ENV`, `ENABLE_TAMPER_DEMO`, `NEXT_PUBLIC_APP_URL` (for the copy-link base), and `SEPOLIA_RPC_URL`, `ANCHOR_PRIVATE_KEY`, `ANCHOR_CONTRACT_ADDRESS` (all empty).

## Confidence Summary

| Item | Confidence | Basis |
|------|------------|-------|
| Package versions | HIGH | Registry `npm view`, 2026-10-03 |
| Next 16 behavior (async params, Turbopack default, proxy rename, next lint removed) | HIGH | Official upgrade guide |
| Tailwind v4 setup, zod 4 API, Hardhat 3 config details | MEDIUM | Training knowledge, plus registry only for versions. Check the docs at implementation time. |
| TS 5.9 over 7 | MEDIUM | Conservative judgement, not a verified incompatibility |
| Docker standalone with a native module | MEDIUM | Standard pattern, but build and run the image early |
| better-sqlite3 13 type coverage via @types 9.6 | LOW-MEDIUM | Not verified |

## Sources
- https://nextjs.org/docs/app/guides/upgrading/version-16 (fetched 2026-10-03, page version 16.3.8)
- npm registry metadata (`npm view`) for next, react, typescript, tailwindcss, better-sqlite3, zod, vitest, viem, hardhat, @nomicfoundation/hardhat-toolbox-viem, drizzle-orm, eslint, eslint-config-next: versions, engines and peerDependencies as of 2026-10-03
