import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { verifyProject } from "@/lib/ledger/chain";
import { seedDemo } from "@/lib/seed";

let dir: string;
let db: Database;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "signseal-seed-"));
  db = openDb(path.join(dir, "seed.db"));
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const n = (sql: string) => (db.prepare(sql).get() as { c: number }).c;

describe("seedDemo", () => {
  it("creates Website Redesign with 4 milestones and a valid ledger", async () => {
    const r = seedDemo(db);
    expect(r.created).toBe(true);
    expect(n("SELECT COUNT(*) c FROM projects WHERE title = 'Website Redesign'")).toBe(1);
    expect(n("SELECT COUNT(*) c FROM milestones")).toBe(4);
    expect(n("SELECT COUNT(*) c FROM ledger_entries")).toBeGreaterThanOrEqual(4);
    expect(n("SELECT COUNT(*) c FROM ledger_entries WHERE action = 'MILESTONE_APPROVED'")).toBeGreaterThanOrEqual(2);
    expect(n("SELECT COUNT(*) c FROM ledger_entries WHERE action = 'CHANGES_REQUESTED'")).toBeGreaterThanOrEqual(1);
    const v = await verifyProject(db, r.projectId);
    expect(v.valid).toBe(true);
  });

  it("is idempotent: second call writes nothing", async () => {
    const first = seedDemo(db);
    const before = n("SELECT COUNT(*) c FROM ledger_entries");
    const second = seedDemo(db);
    expect(second.created).toBe(false);
    expect(second.projectId).toBe(first.projectId);
    expect(n("SELECT COUNT(*) c FROM projects")).toBe(1);
    expect(n("SELECT COUNT(*) c FROM ledger_entries")).toBe(before);
    expect((await verifyProject(db, first.projectId)).valid).toBe(true);
  });
});
