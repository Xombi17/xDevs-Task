import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetRateLimit } from "@/lib/http/rate-limit";
import { GET as detailGET } from "@/app/api/projects/[id]/route";
import { POST as createPOST } from "@/app/api/projects/route";
import { POST as decisionPOST } from "@/app/api/review/[token]/decision/route";
import { GET as exportGET } from "@/app/api/verify/[id]/export/route";
import { GET as ledgerGET } from "@/app/api/projects/[id]/ledger/route";
import { GENESIS_HASH } from "@/lib/ledger/hash";

const DB_KEY = Symbol.for("signseal.db");
type G = typeof globalThis & { [DB_KEY]?: { close(): void } };
let dir: string;

function closeDb() {
  const g = globalThis as G;
  g[DB_KEY]?.close();
  delete g[DB_KEY];
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "signseal-export-"));
  process.env.DB_PATH = path.join(dir, "export.db");
  closeDb();
  resetRateLimit();
});

afterEach(() => {
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

const url = (p: string) => `http://localhost${p}`;
const get = (p: string) => new Request(url(p));
const post = (p: string, body: unknown) => new Request(url(p), { method: "POST", body: JSON.stringify(body) });
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

async function setup() {
  const res = await createPOST(
    post("/api/projects", { title: "Export Me", clientName: "Acme", milestones: [{ title: "A" }, { title: "B" }, { title: "C" }] }),
  );
  const body = await res.json();
  const detail = await (await detailGET(get(`/api/projects/${body.id}`), ctx({ id: body.id }))).json();
  return { id: body.id as string, token: body.reviewToken as string, mids: detail.milestones.map((m: { id: string }) => m.id) as string[] };
}

describe("GET /api/verify/:id/export", () => {
  it("returns the contract JSON as an attachment with exact stored payload strings", async () => {
    const { id, token, mids } = await setup();
    const d = await decisionPOST(
      post(`/api/review/${token}/decision`, { milestoneId: mids[0], decision: "approved", actor: "Jane" }),
      ctx({ token }),
    );
    expect(d.status).toBe(200);

    const res = await exportGET(get(`/api/verify/${id}/export`), ctx({ id }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(res.headers.get("Content-Disposition")).toBe(`attachment; filename="signseal-export-${id}.json"`);
    const text = await res.text();
    expect(text).not.toContain(token);
    expect(text).not.toContain("reviewToken");
    const doc = JSON.parse(text);
    expect(Object.keys(doc).sort()).toEqual(["entries", "exportedAt", "format", "headHash", "length", "projectId", "title"]);
    expect(doc.format).toBe("signseal-ledger-export/v1");
    expect(doc.projectId).toBe(id);
    expect(doc.title).toBe("Export Me");
    expect(doc.length).toBe(doc.entries.length);
    expect(doc.length).toBe(2);
    expect(doc.headHash).toBe(doc.entries[1].hash);
    expect(Number.isNaN(Date.parse(doc.exportedAt))).toBe(false);
    expect(Object.keys(doc.entries[0]).sort()).toEqual(
      ["action", "actor", "hash", "index", "payloadJson", "prevHash", "timestamp"],
    );
    expect(doc.entries[0].prevHash).toBe(GENESIS_HASH);

    const ledger = await (await ledgerGET(get(`/api/projects/${id}/ledger`), ctx({ id }))).json();
    expect(doc.entries.map((e: { payloadJson: string }) => e.payloadJson)).toEqual(
      ledger.entries.map((e: { payloadJson: string }) => e.payloadJson),
    );
  });

  it("returns 404 for an unknown id", async () => {
    const res = await exportGET(get("/api/verify/nope/export"), ctx({ id: "nope" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty("error");
  });
});
