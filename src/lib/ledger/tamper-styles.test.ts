import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GENESIS_HASH, canonicalJson, preimage } from "@/lib/ledger/hash";
import { verifyChain, type StoredEntry } from "@/lib/ledger/verify";

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const PID = "p";

function build(n = 5): StoredEntry[] {
  const out: StoredEntry[] = [];
  for (let i = 0; i < n; i++) {
    const f = {
      index: i,
      timestamp: `2026-01-01T00:00:0${i}.000Z`,
      action: i === 0 ? "PROJECT_CREATED" : "MILESTONE_APPROVED",
      actor: "Jane",
      payloadJson: canonicalJson({ n: i }),
      prevHash: i === 0 ? GENESIS_HASH : out[i - 1].hash,
    };
    out.push({ projectId: PID, ...f, hash: sha(preimage(f)) });
  }
  return out;
}

describe("two tamper styles", () => {
  const N = 2;

  it("style A: payload edited -> break AT N (self-hash), later entries untrusted", async () => {
    const c = build();
    c[N] = { ...c[N], payloadJson: canonicalJson({ n: 999 }) };
    const r = await verifyChain(PID, c, sha);
    expect(r.valid).toBe(false);
    expect(r.brokenAt).toBe(N);
    expect(r.entries[N].reason).toBe("self-hash");
    expect(r.entries.slice(N + 1).every((e) => e.status === "untrusted")).toBe(true);
  });

  it("style B: payload edited AND own hash rewritten -> entry N passes, break at N+1 (prev-link)", async () => {
    const c = build();
    const edited = { ...c[N], payloadJson: canonicalJson({ n: 999 }) };
    c[N] = { ...edited, hash: sha(preimage(edited)) };
    const r = await verifyChain(PID, c, sha);
    expect(r.entries[N].status).toBe("ok");
    expect(r.valid).toBe(false);
    expect(r.brokenAt).toBe(N + 1);
    expect(r.entries[N + 1].reason).toBe("prev-link");
  });

  it("style B on the head entry is undetectable by the chain alone (documented truncation/rewrite limit)", async () => {
    const c = build();
    const last = c.length - 1;
    const edited = { ...c[last], payloadJson: canonicalJson({ n: 999 }) };
    c[last] = { ...edited, hash: sha(preimage(edited)) };
    const r = await verifyChain(PID, c, sha);
    expect(r.valid).toBe(true);
    expect(r.headHash).not.toBe(build()[last].hash); // only a pinned head catches it
  });
});
