import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimit } from "@/lib/http/rate-limit";
import { GET as listGET, POST as createPOST } from "@/app/api/projects/route";
import { GET as detailGET } from "@/app/api/projects/[id]/route";
import { GET as ledgerGET } from "@/app/api/projects/[id]/ledger/route";
import { GET as verifyGET } from "@/app/api/projects/[id]/verify/route";
import { GET as publicVerifyGET } from "@/app/api/verify/[id]/route";
import { GET as reviewGET } from "@/app/api/review/[token]/route";
import { POST as decisionPOST } from "@/app/api/review/[token]/decision/route";

const DB_KEY = Symbol.for("signseal.db");
type G = typeof globalThis & { [DB_KEY]?: { close(): void } };

let dir: string;

function closeDb() {
  const g = globalThis as G;
  g[DB_KEY]?.close();
  delete g[DB_KEY];
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "signseal-api-"));
  process.env.DB_PATH = path.join(dir, "api.db");
  delete process.env.RATE_LIMIT_MAX;
  closeDb();
  resetRateLimit();
});

afterEach(() => {
  closeDb();
  delete process.env.RATE_LIMIT_MAX;
  fs.rmSync(dir, { recursive: true, force: true });
});

const url = (p: string) => `http://localhost${p}`;
const post = (p: string, body: unknown) =>
  new Request(url(p), { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const get = (p: string) => new Request(url(p));
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

const milestonesInput = [
  { title: "Wireframes" },
  { title: "Design", description: "High fidelity" },
  { title: "Launch", dueDate: "2026-12-01" },
];

async function createProject(title = "Website Redesign") {
  const res = await createPOST(post("/api/projects", { title, clientName: "Acme", milestones: milestonesInput }));
  expect(res.status).toBe(201);
  const body = await res.json();
  const detail = await (await detailGET(get(`/api/projects/${body.id}`), ctx({ id: body.id }))).json();
  return {
    id: body.id as string,
    token: body.reviewToken as string,
    mids: detail.milestones.map((m: { id: string }) => m.id) as string[],
  };
}

const decide = (token: string, body: unknown) =>
  decisionPOST(post(`/api/review/${token}/decision`, body), ctx({ token }));

describe("7-step flow through route handlers", () => {
  it("runs create -> list -> review -> decide -> ledger -> verify -> errors", async () => {
    // 1 create
    const { id, token, mids } = await createProject();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(mids).toHaveLength(3);

    // 2 list (no token)
    const listRes = await listGET(get("/api/projects"));
    const listText = await listRes.text();
    expect(listRes.status).toBe(200);
    expect(listText).toContain(id);
    expect(listText).not.toContain(token);

    // 3 review (no token in body)
    const reviewRes = await reviewGET(get(`/api/review/${token}`), ctx({ token }));
    const reviewText = await reviewRes.text();
    expect(reviewRes.status).toBe(200);
    expect(reviewText).not.toContain(token);
    expect(reviewRes.headers.get("Referrer-Policy")).toBe("no-referrer");

    // 4 approve
    const ok1 = await decide(token, { milestoneId: mids[0], decision: "approved", actor: "Jane Client" });
    expect(ok1.status).toBe(200);
    expect((await ok1.json()).receipt.index).toBe(1);

    // 5 changes requested: note required
    const noNote = await decide(token, { milestoneId: mids[1], decision: "changes_requested", actor: "Jane Client" });
    expect(noNote.status).toBe(422);
    expect(JSON.stringify(await noNote.json())).toContain("note");
    const ok2 = await decide(token, {
      milestoneId: mids[1],
      decision: "changes_requested",
      actor: "Jane Client",
      note: "Logo larger",
    });
    expect(ok2.status).toBe(200);
    expect((await ok2.json()).receipt.index).toBe(2);

    // 6 ledger + verify
    const ledgerRes = await ledgerGET(get(`/api/projects/${id}/ledger`), ctx({ id }));
    const ledgerText = await ledgerRes.text();
    expect(ledgerText).not.toContain(token);
    const ledger = JSON.parse(ledgerText);
    expect(ledger.entries.map((e: { index: number }) => e.index)).toEqual([0, 1, 2]);
    expect(ledger.entries.map((e: { action: string }) => e.action)).toEqual([
      "PROJECT_CREATED",
      "MILESTONE_APPROVED",
      "CHANGES_REQUESTED",
    ]);
    expect(ledger.entries[1].prevHash).toBe(ledger.entries[0].hash);
    expect(ledger.entries[2].prevHash).toBe(ledger.entries[1].hash);

    const v = await (await verifyGET(get(`/api/projects/${id}/verify`), ctx({ id }))).json();
    const pubRes = await publicVerifyGET(get(`/api/verify/${id}`), ctx({ id }));
    const pubText = await pubRes.text();
    expect(pubText).not.toContain(token);
    const pub = JSON.parse(pubText);
    expect(v.valid).toBe(true);
    expect(v.length).toBe(3);
    expect(pub.valid).toBe(true);
    expect(pub.length).toBe(3);
    expect(pub.headHash).toBe(v.headHash);
    expect(pub.title).toBe("Website Redesign");

    // 7 errors
    const dup = await decide(token, { milestoneId: mids[0], decision: "approved", actor: "Jane Client" });
    expect(dup.status).toBe(409);
    const after = await (await ledgerGET(get(`/api/projects/${id}/ledger`), ctx({ id }))).json();
    expect(after.entries).toHaveLength(3);

    const bad = await decisionPOST(post(`/api/review/${token}/decision`, "{not json"), ctx({ token }));
    expect(bad.status).toBe(400);

    const unknownGet = await reviewGET(get("/api/review/nope"), ctx({ token: "nope" }));
    expect(unknownGet.status).toBe(404);
    const unknownBody = await unknownGet.json();
    const unknownPost = await decide("nope", { milestoneId: mids[2], decision: "approved", actor: "X" });
    expect(unknownPost.status).toBe(404);
    expect(await unknownPost.json()).toEqual(unknownBody);

    const other = await createProject("Other");
    const foreign = await decide(token, { milestoneId: other.mids[0], decision: "approved", actor: "X" });
    expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual(unknownBody);

    const strict = await decide(token, { milestoneId: mids[2], decision: "approved", actor: "X", extra: 1 });
    expect(strict.status).toBe(422);
    const pipe = await decide(token, { milestoneId: mids[2], decision: "approved", actor: "a|b" });
    expect(pipe.status).toBe(422);
    const notUuid = await decide(token, { milestoneId: "123", decision: "approved", actor: "X" });
    expect(notUuid.status).toBe(422);

    const badCreate = await createPOST(post("/api/projects", { title: "x" }));
    expect(badCreate.status).toBe(422);
    const badCreateJson = await createPOST(post("/api/projects", "oops"));
    expect(badCreateJson.status).toBe(400);
    const missing = await detailGET(get("/api/projects/none"), ctx({ id: "none" }));
    expect(missing.status).toBe(404);
  });
});

describe("rate limiting", () => {
  it("returns 429 with Retry-After and writes nothing for blocked requests", async () => {
    process.env.RATE_LIMIT_MAX = "5";
    const { id, token, mids } = await createProject();
    const statuses: number[] = [];
    let retryAfter: string | null = null;
    for (let i = 0; i < 8; i++) {
      const res = await decide(token, { milestoneId: mids[0], decision: "approved", actor: "Jane" });
      statuses.push(res.status);
      if (res.status === 429) retryAfter = res.headers.get("Retry-After");
    }
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
    expect(statuses.slice(5)).toEqual([429, 429, 429]);
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
    const ledger = await (await ledgerGET(get(`/api/projects/${id}/ledger`), ctx({ id }))).json();
    expect(ledger.entries).toHaveLength(2);
  });
});

describe("parallel decisions", () => {
  it("10 parallel decisions on one milestone: exactly one 200, nine 409", async () => {
    process.env.RATE_LIMIT_MAX = "50";
    const { id, token, mids } = await createProject();
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        decide(token, { milestoneId: mids[0], decision: "approved", actor: `Client ${i}` }),
      ),
    );
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    const ledger = await (await ledgerGET(get(`/api/projects/${id}/ledger`), ctx({ id }))).json();
    expect(ledger.entries).toHaveLength(2);
    const v = await (await verifyGET(get(`/api/projects/${id}/verify`), ctx({ id }))).json();
    expect(v.valid).toBe(true);
  });
});
