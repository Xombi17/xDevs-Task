import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { tamperEntry } from "@/lib/dev/tamper";
import { compareVerify, getWebCryptoHasher, runBrowserVerify } from "@/lib/ledger/browser-verify";
import { getEntries, verifyProject } from "@/lib/ledger/chain";
import { createProject } from "@/lib/services/projects";
import { decide } from "@/lib/services/review";

let dir: string;
let db: Database;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "signseal-bv-"));
  db = openDb(path.join(dir, "t.db"));
});
afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

function build() {
  const p = createProject(db, { title: "Site", clientName: "Acme", milestones: [{ title: "A" }, { title: "B" }, { title: "C" }] });
  decide(db, p.reviewToken, { milestoneId: p.milestones[0].id, decision: "approved", actor: "Jane" });
  decide(db, p.reviewToken, { milestoneId: p.milestones[1].id, decision: "changes_requested", actor: "Jane", note: "x" });
  decide(db, p.reviewToken, { milestoneId: p.milestones[2].id, decision: "approved", actor: "Jane" });
  return p.id;
}
const dto = (pid: string) => getEntries(db, pid).map((e) => ({ index: e.index, timestamp: e.timestamp, action: e.action, actor: e.actor, payloadJson: e.payloadJson, prevHash: e.prevHash, hash: e.hash }));

describe("getWebCryptoHasher", () => {
  it("returns null when crypto/subtle/digest is missing", () => {
    expect(getWebCryptoHasher(null)).toBeNull();
    expect(getWebCryptoHasher({} as never)).toBeNull();
    expect(getWebCryptoHasher({ subtle: {} } as never)).toBeNull();
  });
  it("matches node sha256 for ascii and unicode", async () => {
    const h = getWebCryptoHasher(globalThis.crypto)!;
    for (const s of ["abc", "héllo ✓ 😀 日本"]) {
      expect(await h(s)).toBe(createHash("sha256").update(s, "utf8").digest("hex"));
    }
  });
});

describe("runBrowserVerify", () => {
  it("unavailable without Web Crypto", async () => {
    const pid = build();
    const server = await verifyProject(db, pid);
    const o = await runBrowserVerify(pid, dto(pid), server, {} as never);
    expect(o.kind).toBe("unavailable");
    if (o.kind === "unavailable") {
      expect(o.message).toMatch(/Web Crypto/);
      expect(o.message).toMatch(/HTTPS or localhost/);
      expect(o.message).toMatch(/server/);
    }
  });

  it("unavailable when digest rejects", async () => {
    const pid = build();
    const server = await verifyProject(db, pid);
    const bad = { subtle: { digest: () => Promise.reject(new Error("boom")) } };
    const o = await runBrowserVerify(pid, dto(pid), server, bad as never);
    expect(o.kind).toBe("unavailable");
  });

  it("agrees on an intact chain", async () => {
    const pid = build();
    const server = await verifyProject(db, pid);
    const o = await runBrowserVerify(pid, dto(pid), server, globalThis.crypto);
    expect(o.kind).toBe("done");
    if (o.kind === "done") {
      expect(o.agrees).toBe(true);
      expect(o.result.valid).toBe(true);
    }
  });

  it("agrees on a tampered chain", async () => {
    const pid = build();
    const id = (db.prepare("SELECT id FROM ledger_entries WHERE project_id = ? AND idx = 2").get(pid) as { id: number }).id;
    tamperEntry(db, id);
    const server = await verifyProject(db, pid);
    const o = await runBrowserVerify(pid, dto(pid), server, globalThis.crypto);
    expect(o.kind).toBe("done");
    if (o.kind === "done") {
      expect(o.result.brokenAt).toBe(2);
      expect(o.agrees).toBe(true);
      expect(o.differences).toEqual([]);
    }
  });

  it("disagrees when the server result is altered", async () => {
    const pid = build();
    const server = await verifyProject(db, pid);
    const o = await runBrowserVerify(pid, dto(pid), { ...server, valid: false, brokenAt: 1 }, globalThis.crypto);
    expect(o.kind).toBe("done");
    if (o.kind === "done") {
      expect(o.agrees).toBe(false);
      expect(o.differences.length).toBeGreaterThan(0);
    }
  });
});

describe("compareVerify", () => {
  it("flags a differing expected hash", async () => {
    const pid = build();
    const a = await verifyProject(db, pid);
    const b = structuredClone(a);
    b.entries[1].expectedHash = "0".repeat(64);
    const c = compareVerify(a, b);
    expect(c.agrees).toBe(false);
    expect(c.differences[0]).toMatch(/#1/);
  });
});
