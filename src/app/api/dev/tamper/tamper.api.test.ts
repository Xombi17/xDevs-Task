import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/lib/db";
import { POST as tamperPOST } from "@/app/api/dev/tamper/[entryId]/route";
import * as routeModule from "@/app/api/dev/tamper/[entryId]/route";
import { POST as createPOST } from "@/app/api/projects/route";
import { GET as verifyGET } from "@/app/api/projects/[id]/verify/route";
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
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "signseal-tamperapi-"));
  process.env.DB_PATH = path.join(dir, "api.db");
  closeDb();
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.unstubAllEnvs();
  closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

const url = (p: string) => `http://localhost${p}`;
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const tamper = (id: string) => tamperPOST(new Request(url(`/api/dev/tamper/${id}`), { method: "POST" }), ctx({ entryId: id }));
const verify = async (id: string) => (await verifyGET(new Request(url("/")), ctx({ id }))).json();
const snapshot = () => JSON.stringify(getDb().prepare("SELECT * FROM ledger_entries ORDER BY id").all());
const triggers = () =>
  (getDb().prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='trigger' AND tbl_name='ledger_entries'").get() as { c: number }).c;

async function setup() {
  const res = await createPOST(
    new Request(url("/api/projects"), {
      method: "POST",
      body: JSON.stringify({ title: "P", clientName: "Acme", milestones: [{ title: "A" }, { title: "B" }, { title: "C" }] }),
    }),
  );
  const body = await res.json();
  expect(res.status, JSON.stringify(body)).toBe(201);
  const mid = (getDb().prepare("SELECT id FROM milestones WHERE project_id = ? ORDER BY position").get(body.id) as { id: string }).id;
  const d = await decisionPOST(
    new Request(url("/x"), { method: "POST", body: JSON.stringify({ milestoneId: mid, decision: "approved", actor: "Jane" }) }),
    ctx({ token: body.reviewToken as string }),
  );
  expect(d.status).toBe(200);
  const rowId = (idx: number) =>
    (getDb().prepare("SELECT id FROM ledger_entries WHERE project_id = ? AND idx = ?").get(body.id, idx) as { id: number }).id;
  return { pid: body.id as string, rowId };
}

describe("gate (disabled)", () => {
  const cases: [string, string | undefined, string?][] = [
    ["unset", undefined],
    ["false", "false"],
    ["empty", ""],
    ["1", "1"],
    ["TRUE", "TRUE"],
    ["true in production", "true", "production"],
  ];
  for (const [name, flag, nodeEnv] of cases) {
    it(`returns 403 and changes nothing: ${name}`, async () => {
      const { pid, rowId } = await setup();
      if (flag !== undefined) vi.stubEnv("ENABLE_TAMPER_DEMO", flag);
      else vi.stubEnv("ENABLE_TAMPER_DEMO", undefined as unknown as string);
      if (nodeEnv) vi.stubEnv("NODE_ENV", nodeEnv);
      const snap = snapshot();
      const res = await tamper(String(rowId(1)));
      expect(res.status).toBe(403);
      const b = await res.json();
      expect(b.error.code).toBe("TAMPER_DISABLED");
      expect(b.error.message).toContain("ENABLE_TAMPER_DEMO");
      expect(snapshot()).toBe(snap);
      vi.unstubAllEnvs();
      expect((await verify(pid)).valid).toBe(true);
    });
  }

  it("403 takes precedence over 404", async () => {
    await setup();
    expect((await tamper("99999")).status).toBe(403);
  });
});

describe("gate (enabled)", () => {
  beforeEach(() => {
    vi.stubEnv("ENABLE_TAMPER_DEMO", "true");
  });

  it("tampers, verify breaks at the returned index, triggers intact", async () => {
    const { pid, rowId } = await setup();
    const res = await tamper(String(rowId(1)));
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.tampered).toEqual({ entryId: rowId(1), projectId: pid, index: 1 });
    const v = await verify(pid);
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(b.tampered.index);
    expect(triggers()).toBe(2);
    expect(() => getDb().prepare("UPDATE ledger_entries SET actor = 'x'").run()).toThrow(/append-only/);
    expect(() => getDb().prepare("DELETE FROM ledger_entries").run()).toThrow(/append-only/);
  });

  for (const bad of ["abc", "0", "-1", "1.5", "99999"]) {
    it(`404 for id ${bad}`, async () => {
      await setup();
      const snap = snapshot();
      const res = await tamper(bad);
      expect(res.status).toBe(404);
      expect(snapshot()).toBe(snap);
      expect(triggers()).toBe(2);
    });
  }

  it("exports only POST", () => {
    for (const m of ["GET", "PUT", "DELETE", "PATCH"]) expect(m in routeModule).toBe(false);
  });
});
