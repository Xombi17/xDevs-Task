import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { getEntries } from "@/lib/ledger/chain";
import { checkReceipt, buildReceipt } from "@/lib/receipt";
import { createProject, getLedger, getVerify } from "@/lib/services/projects";
import { getPublicSummary } from "@/lib/services/public";
import { decide } from "@/lib/services/review";

let dir: string;
let db: Database;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "signseal-rcpt-"));
  db = openDb(path.join(dir, "test.db"));
});
afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const setup = () =>
  createProject(db, {
    title: "Site",
    clientName: "Acme",
    milestones: [{ title: "A" }, { title: "B" }, { title: "C" }],
  });

describe("decide receipt", () => {
  it("carries projectId, action and actor exactly as hashed", () => {
    const p = setup();
    const out = decide(db, p.reviewToken, { milestoneId: p.milestones[0].id, decision: "approved", actor: "Jane Q" });
    const e = getEntries(db, p.id)[1];
    expect(out.receipt).toMatchObject({
      projectId: p.id,
      index: e.index,
      hash: e.hash,
      timestamp: e.timestamp,
      action: "MILESTONE_APPROVED",
      actor: "Jane Q",
    });
  });

  it("receipt checks against the public ledger", async () => {
    const p = setup();
    const { receipt } = decide(db, p.reviewToken, { milestoneId: p.milestones[0].id, decision: "approved", actor: "Jane Q" });
    const ledger = await getLedger(db, p.id);
    expect(checkReceipt(buildReceipt(receipt), ledger.entries, p.id).match).toBe(true);
  });
});

describe("public data never contains the review token", () => {
  it("summary, ledger and verify payloads", async () => {
    const p = setup();
    decide(db, p.reviewToken, { milestoneId: p.milestones[0].id, decision: "approved", actor: "Jane Q" });
    const payload = JSON.stringify({
      summary: getPublicSummary(db, p.id),
      ledger: await getLedger(db, p.id),
      verify: await getVerify(db, p.id),
    });
    expect(payload).not.toContain(p.reviewToken);
    expect(Object.keys(getPublicSummary(db, p.id)).sort()).toEqual(["clientName", "id", "title"]);
  });
  it("unknown id is a 404 AppError", () => {
    expect(() => getPublicSummary(db, "nope")).toThrowError(/Not found/);
  });
});
