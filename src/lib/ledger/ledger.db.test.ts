import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TRIGGERS_SQL, TRIGGER_NAMES } from "@/lib/db/ddl";
import { openDb } from "@/lib/db";
import { append, LedgerError } from "@/lib/ledger/append";
import { getEntries, sha256Hex, verifyProject } from "@/lib/ledger/chain";
import { GENESIS_HASH, canonicalJson, preimage } from "@/lib/ledger/hash";
import { generateToken } from "@/lib/ledger/token";

let dir: string;
let dbPath: string;
let db: Database;
const extra: Database[] = [];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "signseal-"));
  dbPath = path.join(dir, "test.db");
  db = openDb(dbPath);
  db.prepare("INSERT INTO projects (id, title, client_name, review_token, created_at) VALUES (?,?,?,?,?)").run(
    "p1", "Site", "Acme", generateToken(), "2026-01-01T00:00:00.000Z",
  );
  const ins = db.prepare("INSERT INTO milestones (id, project_id, title, position) VALUES (?,?,?,?)");
  ["m1", "m2", "m3"].forEach((id, i) => ins.run(id, "p1", `Milestone ${id}`, i));
});

afterEach(() => {
  for (const d of extra.splice(0)) d.close();
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const count = (d: Database = db) =>
  (d.prepare("SELECT COUNT(*) AS c FROM ledger_entries").get() as { c: number }).c;

const decide = (id: string, status: "approved" | "changes_requested" = "approved") => ({
  id, status, decidedBy: "Client A", decidedAt: "2026-01-02T00:00:00.000Z", note: null,
});

describe("chain build", () => {
  it("builds a genesis-rooted chain with exactly-hashed stored strings", async () => {
    const a = append(db, { projectId: "p1", action: "PROJECT_CREATED", actor: "agency", payload: { title: "Site" }, now: () => "2026-01-01T00:00:00.000Z" });
    append(db, { projectId: "p1", action: "MILESTONE_APPROVED", actor: "Client A", payload: { milestoneId: "m1" }, now: () => "2026-01-02T00:00:00.000Z", milestone: decide("m1") });
    append(db, { projectId: "p1", action: "CHANGES_REQUESTED", actor: "Client A", payload: { milestoneId: "m2", note: "x" }, now: () => "2026-01-03T00:00:00.000Z", milestone: decide("m2", "changes_requested") });

    const entries = getEntries(db, "p1");
    expect(entries.map((e) => e.index)).toEqual([0, 1, 2]);
    expect(entries[0].prevHash).toBe(GENESIS_HASH);
    expect(entries[0].prevHash).toBe("0".repeat(64));
    expect(entries[1].prevHash).toBe(entries[0].hash);
    expect(entries[2].prevHash).toBe(entries[1].hash);
    expect(a.hash).toBe(entries[0].hash);
    for (const e of entries) expect(e.hash).toBe(sha256Hex(preimage(e)));

    const raw = db.prepare("SELECT payload_json FROM ledger_entries WHERE idx = 1").get() as { payload_json: string };
    expect(raw.payload_json).toBe(canonicalJson({ milestoneId: "m1" }));

    const v = await verifyProject(db, "p1");
    expect(v.valid).toBe(true);
    expect(v.length).toBe(3);
    expect(v.headHash).toBe(entries[2].hash);
  });

  it("shuffled payload key order yields the same hash", () => {
    const now = () => "2026-01-01T00:00:00.000Z";
    const a = append(db, { projectId: "p1", action: "PROJECT_CREATED", actor: "x", payload: { a: 1, b: { c: 2, d: 3 } }, now });
    db.close();
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "signseal-"));
    db = openDb(path.join(dir, "other.db"));
    db.prepare("INSERT INTO projects (id, title, client_name, review_token, created_at) VALUES ('p1','t','c','tok','x')").run();
    const b = append(db, { projectId: "p1", action: "PROJECT_CREATED", actor: "x", payload: { b: { d: 3, c: 2 }, a: 1 }, now });
    expect(b.hash).toBe(a.hash);
    expect(b.payloadJson).toBe(a.payloadJson);
  });
});

describe("actor guard", () => {
  it("rejects a pipe actor with INVALID_ACTOR and writes nothing", () => {
    expect(() => append(db, { projectId: "p1", action: "PROJECT_CREATED", actor: "a|b", payload: {} })).toThrowError(
      expect.objectContaining({ code: "INVALID_ACTOR" }),
    );
    expect(count()).toBe(0);
  });

  it("accepts unicode actor and payload and verifies valid", async () => {
    append(db, { projectId: "p1", action: "PROJECT_CREATED", actor: "Zoë 山田 🚀", payload: { note: "café ✓  " } });
    const v = await verifyProject(db, "p1");
    expect(v.valid).toBe(true);
    expect(getEntries(db, "p1")[0].actor).toBe("Zoë 山田 🚀");
  });

  it("throws PROJECT_NOT_FOUND for unknown project", () => {
    expect(() => append(db, { projectId: "nope", action: "PROJECT_CREATED", actor: "x", payload: {} })).toThrowError(
      expect.objectContaining({ code: "PROJECT_NOT_FOUND" }),
    );
  });
});

describe("append-only triggers", () => {
  it("trigger blocks raw UPDATE and DELETE and leaves data unchanged", () => {
    append(db, { projectId: "p1", action: "PROJECT_CREATED", actor: "x", payload: { k: 1 } });
    const before = getEntries(db, "p1");
    expect(() => db.prepare("UPDATE ledger_entries SET payload_json='x'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM ledger_entries").run()).toThrow(/append-only/);
    expect(getEntries(db, "p1")).toEqual(before);
  });
});

describe("decide-once", () => {
  it("second decision throws ALREADY_DECIDED with no ledger row and milestone unchanged", () => {
    append(db, { projectId: "p1", action: "MILESTONE_APPROVED", actor: "Client A", payload: { m: "m1" }, milestone: decide("m1") });
    const second = { projectId: "p1", action: "CHANGES_REQUESTED" as const, actor: "Client B", payload: { m: "m1" }, milestone: { ...decide("m1", "changes_requested"), decidedBy: "Client B", note: "later" } };
    expect(() => append(db, second)).toThrowError(expect.objectContaining({ code: "ALREADY_DECIDED" }));
    expect(count()).toBe(1);
    expect(db.prepare("SELECT status, decided_by, note FROM milestones WHERE id='m1'").get()).toEqual({
      status: "approved", decided_by: "Client A", note: null,
    });
  });

  it("milestone from another project throws MILESTONE_NOT_FOUND", () => {
    db.prepare("INSERT INTO projects (id, title, client_name, review_token, created_at) VALUES ('p2','t','c','tok2','x')").run();
    db.prepare("INSERT INTO milestones (id, project_id, title, position) VALUES ('mx','p2','t',0)").run();
    expect(() =>
      append(db, { projectId: "p1", action: "MILESTONE_APPROVED", actor: "x", payload: {}, milestone: decide("mx") }),
    ).toThrowError(expect.objectContaining({ code: "MILESTONE_NOT_FOUND" }));
    expect(count()).toBe(0);
  });
});

describe("atomic rollback", () => {
  it("a failure AFTER the INSERT (milestone CHECK violation) leaves no partial ledger row", () => {
    append(db, { projectId: "p1", action: "PROJECT_CREATED", actor: "x", payload: {} });
    const bad = { ...decide("m1"), status: "bogus" } as unknown as ReturnType<typeof decide>;
    // INSERT into ledger_entries succeeds first, then UPDATE milestones trips CHECK(status IN ...)
    expect(() =>
      append(db, { projectId: "p1", action: "MILESTONE_APPROVED", actor: "x", payload: {}, milestone: bad }),
    ).toThrow(/CHECK constraint/);
    expect(count()).toBe(1);
    expect(db.prepare("SELECT status FROM milestones WHERE id='m1'").get()).toEqual({ status: "pending" });
    // chain still appendable at the next index
    expect(append(db, { projectId: "p1", action: "MILESTONE_APPROVED", actor: "x", payload: {} }).index).toBe(1);
  });

  it("canonicalJson failure (NaN) writes nothing", () => {
    expect(() => append(db, { projectId: "p1", action: "PROJECT_CREATED", actor: "x", payload: { n: NaN } })).toThrow();
    expect(count()).toBe(0);
  });
});

describe("concurrency", () => {
  it("sequential interleave across two connections to one file yields a gap-free chain", async () => {
    // NOTE: better-sqlite3 is synchronous, so this is a deterministic interleave
    // (A,B,A,B,...) across two handles, not true parallelism. The stale-head
    // hazard is covered because each handle reads the head inside its own tx.
    const db2 = openDb(dbPath);
    extra.push(db2);
    for (let i = 0; i < 10; i++) {
      append(i % 2 === 0 ? db : db2, { projectId: "p1", action: "MILESTONE_APPROVED", actor: `c${i % 2}`, payload: { i } });
    }
    expect(getEntries(db, "p1").map((e) => e.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect((await verifyProject(db2, "p1")).valid).toBe(true);
  });

  it("separate OS processes appending concurrently produce a gap-free valid chain", async () => {
    const worker = path.resolve(__dirname, "append-worker.fixture.ts");
    const run = (tag: string) =>
      new Promise<void>((resolve, reject) => {
        const p = spawn(process.execPath, ["--import", "tsx", worker, dbPath, "p1", "15", tag], {
          cwd: path.resolve(__dirname, "../../.."),
          stdio: ["ignore", "ignore", "pipe"],
        });
        let err = "";
        p.stderr.on("data", (d) => (err += d));
        p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`worker ${tag} exit ${code}: ${err}`))));
      });
    await Promise.all([run("a"), run("b"), run("c")]);
    const entries = getEntries(db, "p1");
    expect(entries.map((e) => e.index)).toEqual(Array.from({ length: 45 }, (_, i) => i));
    expect((await verifyProject(db, "p1")).valid).toBe(true);
  }, 60_000);
});

describe("tamper", () => {
  it("drop trigger + UPDATE + recreate in one tx is detected at the tampered entry", async () => {
    for (let i = 0; i < 4; i++) append(db, { projectId: "p1", action: "MILESTONE_APPROVED", actor: "x", payload: { i } });
    db.transaction(() => {
      for (const n of TRIGGER_NAMES) db.exec(`DROP TRIGGER ${n}`);
      db.prepare("UPDATE ledger_entries SET payload_json = ? WHERE project_id='p1' AND idx = 1").run('{"i":999}');
      db.exec(TRIGGERS_SQL);
    })();
    const v = await verifyProject(db, "p1");
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(1);
    expect(v.entries.map((e) => e.status)).toEqual(["ok", "broken", "untrusted", "untrusted"]);
    expect(v.entries[1].reason).toBe("self-hash");
    expect(v.entries[1].expectedHash).not.toBe(v.entries[1].storedHash);
    expect(() => db.prepare("UPDATE ledger_entries SET payload_json='y'").run()).toThrow(/append-only/);
  });
});

describe("generateToken", () => {
  it("is 43 url-safe chars and unique", () => {
    const t = generateToken();
    expect(t).toHaveLength(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generateToken()).not.toBe(t);
  });
});

// keep LedgerError import exercised
it("LedgerError carries a code", () => {
  expect(new LedgerError("ALREADY_DECIDED").code).toBe("ALREADY_DECIDED");
});
