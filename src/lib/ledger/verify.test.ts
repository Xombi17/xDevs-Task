import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { GENESIS_HASH, canonicalJson, preimage } from "@/lib/ledger/hash";
import { verifyChain, type StoredEntry } from "@/lib/ledger/verify";

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const PID = "proj-1";

function makeEntry(index: number, prevHash: string, projectId = PID): StoredEntry {
  const f = {
    index,
    timestamp: `2026-01-01T00:00:0${index}.000Z`,
    action: index === 0 ? "PROJECT_CREATED" : "MILESTONE_APPROVED",
    actor: "Jane",
    payloadJson: canonicalJson({ n: index, note: "a|b" }),
    prevHash,
  };
  return { projectId, ...f, hash: sha(preimage(f)) };
}

function chain(n = 4): StoredEntry[] {
  const out: StoredEntry[] = [];
  for (let i = 0; i < n; i++) out.push(makeEntry(i, i === 0 ? GENESIS_HASH : out[i - 1].hash));
  return out;
}

describe("verifyChain", () => {
  it("intact chain is valid with head hash and length", async () => {
    const c = chain();
    const r = await verifyChain(PID, c, sha);
    expect(r.valid).toBe(true);
    expect(r.length).toBe(4);
    expect(r.headHash).toBe(c[3].hash);
    expect(r.brokenAt).toBeUndefined();
    expect(r.entries.every((e) => e.status === "ok")).toBe(true);
    expect(r.entries[1].expectedHash).toBe(c[1].hash);
    expect(r.entries[1].storedHash).toBe(c[1].hash);
  });

  it("empty chain is valid with genesis head", async () => {
    const r = await verifyChain(PID, [], sha);
    expect(r).toMatchObject({ valid: true, length: 0, headHash: GENESIS_HASH, entries: [] });
  });

  it("self-hash: mutated payload breaks entry and makes downstream untrusted", async () => {
    const c = chain();
    c[2] = { ...c[2], payloadJson: canonicalJson({ n: 2, note: "tampered" }) };
    const r = await verifyChain(PID, c, sha);
    expect(r.valid).toBe(false);
    expect(r.brokenAt).toBe(2);
    expect(r.entries.map((e) => e.status)).toEqual(["ok", "ok", "broken", "untrusted"]);
    expect(r.entries[2].reason).toBe("self-hash");
    expect(r.entries[2].expectedHash).not.toBe(r.entries[2].storedHash);
    expect(r.entries[3].reason).toBeUndefined();
    expect(r.entries[3].expectedHash).toBe(c[3].hash);
  });

  it("prev-link: altered prevHash with consistent self-hash is caught", async () => {
    const c = chain();
    const f = { ...c[2], prevHash: "f".repeat(64) };
    c[2] = { ...f, hash: sha(preimage(f)) };
    const r = await verifyChain(PID, c, sha);
    expect(r.brokenAt).toBe(2);
    expect(r.entries[2]).toMatchObject({ status: "broken", reason: "prev-link" });
  });

  it("prev-link: first entry must link to genesis", async () => {
    const c = chain();
    const f = { ...c[0], prevHash: "1".repeat(64) };
    c[0] = { ...f, hash: sha(preimage(f)) };
    const r = await verifyChain(PID, c, sha);
    expect(r.brokenAt).toBe(0);
    expect(r.entries[0]).toMatchObject({ status: "broken", reason: "prev-link" });
  });

  it("index gap (0,1,3) breaks at the gap entry", async () => {
    const c = chain();
    c.splice(2, 1);
    const r = await verifyChain(PID, c, sha);
    expect(r.brokenAt).toBe(2);
    expect(r.entries[2]).toMatchObject({ status: "broken", reason: "index" });
  });

  it("project mismatch breaks the entry", async () => {
    const c = chain();
    c[1] = { ...c[1], projectId: "other" };
    const r = await verifyChain(PID, c, sha);
    expect(r.brokenAt).toBe(1);
    expect(r.entries[1]).toMatchObject({ status: "broken", reason: "project" });
    expect(r.entries[2].status).toBe("untrusted");
  });

  it("supports an async hasher", async () => {
    const r = await verifyChain(PID, chain(), async (s) => sha(s));
    expect(r.valid).toBe(true);
  });
});
