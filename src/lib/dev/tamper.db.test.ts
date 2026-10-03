import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { tamperEnabled } from "@/lib/dev/gate";
import { mutatePayload, tamperEntry } from "@/lib/dev/tamper";
import { AppError } from "@/lib/http/errors";
import { verifyProject } from "@/lib/ledger/chain";
import { canonicalJson } from "@/lib/ledger/hash";
import { createProject } from "@/lib/services/projects";
import { decide } from "@/lib/services/review";

let dir: string;
let db: Database;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "signseal-tamper-"));
  db = openDb(path.join(dir, "t.db"));
});
afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const triggerCount = () =>
  (db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='trigger' AND tbl_name='ledger_entries'").get() as { c: number }).c;
const rows = (pid: string) => db.prepare("SELECT * FROM ledger_entries WHERE project_id = ? ORDER BY idx").all(pid) as Record<string, unknown>[];
const rowId = (pid: string, idx: number) =>
  (db.prepare("SELECT id FROM ledger_entries WHERE project_id = ? AND idx = ?").get(pid, idx) as { id: number }).id;

function build() {
  const p = createProject(db, { title: "Site", clientName: "Acme", milestones: [{ title: "A" }, { title: "B" }, { title: "C" }] });
  decide(db, p.reviewToken, { milestoneId: p.milestones[0].id, decision: "approved", actor: "Jane" });
  decide(db, p.reviewToken, { milestoneId: p.milestones[1].id, decision: "changes_requested", actor: "Jane", note: "x" });
  decide(db, p.reviewToken, { milestoneId: p.milestones[2].id, decision: "approved", actor: "Jane" });
  return p.id;
}

describe("tamperEntry", () => {
  it("(a) verify reports Broken at the tampered index, later entries untrusted", async () => {
    const pid = build();
    tamperEntry(db, rowId(pid, 2));
    const v = await verifyProject(db, pid);
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(2);
    expect(v.entries.map((e) => e.status)).toEqual(["ok", "ok", "broken", "untrusted"]);
  });

  it("idx 0 tamper: everything after is untrusted", async () => {
    const pid = build();
    tamperEntry(db, rowId(pid, 0));
    const v = await verifyProject(db, pid);
    expect(v.brokenAt).toBe(0);
    expect(v.entries.slice(1).every((e) => e.status === "untrusted")).toBe(true);
  });

  it("changes only the target payload_json, still canonical JSON", () => {
    const pid = build();
    const before = rows(pid);
    const res = tamperEntry(db, rowId(pid, 1));
    const after = rows(pid);
    after.forEach((r, i) => {
      for (const k of Object.keys(r)) {
        if (i === 1 && k === "payload_json") expect(r[k]).not.toBe(before[i][k]);
        else expect(r[k]).toBe(before[i][k]);
      }
    });
    const stored = after[1].payload_json as string;
    expect(stored).toBe(res.after);
    expect(canonicalJson(JSON.parse(stored))).toBe(stored);
  });

  it("(b) trigger count unchanged and (c) plain UPDATE/DELETE still throw", () => {
    const pid = build();
    expect(triggerCount()).toBe(2);
    tamperEntry(db, rowId(pid, 1));
    expect(triggerCount()).toBe(2);
    expect(() => db.prepare("UPDATE ledger_entries SET actor = 'x'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM ledger_entries").run()).toThrow(/append-only/);
  });

  it("tampering twice still leaves the entry broken", async () => {
    const pid = build();
    const id = rowId(pid, 1);
    const orig = rows(pid)[1].payload_json;
    tamperEntry(db, id);
    const second = tamperEntry(db, id);
    expect(second.after).not.toBe(orig);
    expect((await verifyProject(db, pid)).brokenAt).toBe(1);
  });

  it("unknown id throws 404 and triggers stay", () => {
    build();
    try {
      tamperEntry(db, 999999);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(404);
    }
    expect(triggerCount()).toBe(2);
  });

  it("(d) failure after DROP+UPDATE rolls back the DDL and the payload", async () => {
    const pid = build();
    const id = rowId(pid, 1);
    const before = rows(pid);
    const failing = new Proxy(db, {
      get(t, prop) {
        if (prop === "exec") {
          return (sql: string) => {
            if (/CREATE TRIGGER/.test(sql)) throw new Error("boom mid-way");
            return t.exec(sql);
          };
        }
        const v = Reflect.get(t, prop, t);
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
    expect(() => tamperEntry(failing, id)).toThrow(/boom/);
    expect(triggerCount()).toBe(2);
    expect(rows(pid)).toEqual(before);
    expect((await verifyProject(db, pid)).valid).toBe(true);
    expect(() => db.prepare("UPDATE ledger_entries SET actor = 'x'").run()).toThrow(/append-only/);
  });

  it("(d) trigger-count mismatch rolls back too", () => {
    const pid = build();
    const before = rows(pid);
    const noop = new Proxy(db, {
      get(t, prop) {
        if (prop === "exec") return (sql: string) => (/CREATE TRIGGER/.test(sql) ? t : t.exec(sql));
        const v = Reflect.get(t, prop, t);
        return typeof v === "function" ? v.bind(t) : v;
      },
    });
    expect(() => tamperEntry(noop, rowId(pid, 1))).toThrow(/trigger count/);
    expect(triggerCount()).toBe(2);
    expect(rows(pid)).toEqual(before);
  });
});

describe("mutatePayload", () => {
  it("wraps non-object payloads", () => {
    expect(JSON.parse(mutatePayload("5"))).toEqual({ tamperCount: 1 });
  });
});

describe("tamperEnabled", () => {
  it("is true only for exact 'true' outside production", () => {
    expect(tamperEnabled({ NODE_ENV: "development", ENABLE_TAMPER_DEMO: "true" })).toBe(true);
    expect(tamperEnabled({ ENABLE_TAMPER_DEMO: "true" })).toBe(true);
    for (const v of [undefined, "", "false", "1", "TRUE", " true"]) {
      expect(tamperEnabled({ NODE_ENV: "development", ENABLE_TAMPER_DEMO: v })).toBe(false);
    }
    expect(tamperEnabled({ NODE_ENV: "production", ENABLE_TAMPER_DEMO: "true" })).toBe(false);
  });
});
