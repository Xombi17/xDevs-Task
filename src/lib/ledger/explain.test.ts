import { describe, expect, it } from "vitest";
import { explainFailure } from "@/lib/ledger/explain";
import type { VerifyResult } from "@/lib/ledger/verify";

function result(reason: "self-hash" | "prev-link" | "index" | "project" | undefined, n = 2, total = 5): VerifyResult {
  const entries = Array.from({ length: total }, (_, i) => ({
    index: i,
    status: (i < n ? "ok" : i === n ? "broken" : "untrusted") as "ok" | "broken" | "untrusted",
    expectedHash: "a".repeat(64),
    storedHash: "b".repeat(64),
    ...(i === n && reason ? { reason } : {}),
  }));
  return { valid: false, headHash: "c".repeat(64), length: total, brokenAt: n, entries };
}

describe("explainFailure", () => {
  it("returns null for a valid result", () => {
    expect(explainFailure({ valid: true, headHash: "x", length: 0, entries: [] }, [], [])).toBeNull();
  });

  it("self-hash", () => {
    const e = explainFailure(result("self-hash"), [], [])!;
    expect(e.check).toBe("self-hash");
    expect(e.headline).toBe("Entry #2 failed the self-hash check");
    expect(e.detail).toMatch(/recomputed/);
    expect(e.detail).toMatch(/#2/);
    expect(e.untrustedNote).toBe("2 later entries are untrusted.");
    expect(e.caveat).toMatch(/Best-effort/);
  });

  it("falls back to self-hash when reason is missing", () => {
    expect(explainFailure(result(undefined), [], [])!.check).toBe("self-hash");
  });

  it("prev-link", () => {
    const e = explainFailure(result("prev-link"), [], [])!;
    expect(e.check).toBe("prev-link");
    expect(e.detail).toMatch(/entry #1's stored hash/);
  });

  it("index and project", () => {
    expect(explainFailure(result("index"), [], [])!.detail).toMatch(/index/);
    expect(explainFailure(result("project"), [], [])!.detail).toMatch(/different project/);
  });

  it("singular untrusted and omitted when 0", () => {
    expect(explainFailure(result("self-hash", 3, 5), [], [])!.untrustedNote).toBe("1 later entry is untrusted.");
    expect(explainFailure(result("self-hash", 4, 5), [], [])!.untrustedNote).toBeUndefined();
  });

  it("milestone disagreement, match and unknown", () => {
    const ctx = [{ index: 2, action: "MILESTONE_APPROVED", milestoneId: "m1", decision: "approved" }];
    const dis = explainFailure(result("self-hash"), ctx, [{ id: "m1", title: "Design", status: "changes_requested" }])!;
    expect(dis.milestoneNote).toMatch(/now says approved for "Design"/);
    expect(dis.milestoneNote).toMatch(/changes_requested/);
    expect(dis.milestoneNote).toMatch(/disagree/);
    const same = explainFailure(result("self-hash"), ctx, [{ id: "m1", title: "Design", status: "approved" }])!;
    expect(same.milestoneNote).toMatch(/still matches/);
    expect(same.milestoneNote).toMatch(/only the hash/);
    expect(explainFailure(result("self-hash"), ctx, [{ id: "zz", title: "X", status: "pending" }])!.milestoneNote).toBeUndefined();
    expect(explainFailure(result("self-hash"), [{ index: 2, action: "PROJECT_CREATED" }], [])!.milestoneNote).toBeUndefined();
  });
});
