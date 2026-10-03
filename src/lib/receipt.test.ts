import { describe, expect, it } from "vitest";
import { buildReceipt, checkReceipt } from "@/lib/receipt";

const H = "a".repeat(64);
const entry = { index: 3, hash: H, actor: "Jane Client", timestamp: "2026-10-03T10:00:00.000Z" };
const base = { projectId: "p1", index: 3, hash: H, actor: "Jane Client", timestamp: entry.timestamp, action: "MILESTONE_APPROVED" };

describe("buildReceipt", () => {
  it("builds the v1 object with a verify path", () => {
    expect(buildReceipt(base)).toEqual({ format: "signseal-receipt/v1", ...base, verifyPath: "/verify/p1" });
  });
});

describe("checkReceipt", () => {
  const r = buildReceipt(base);
  it("matches an equal entry", () => {
    expect(checkReceipt(r, [entry], "p1")).toEqual({ match: true, index: 3 });
  });
  it("rejects a wrong hash", () => {
    expect(checkReceipt({ ...r, hash: "b".repeat(64) }, [entry], "p1").match).toBe(false);
  });
  it("rejects wrong actor and timestamp", () => {
    expect(checkReceipt({ ...r, actor: "Eve" }, [entry], "p1").match).toBe(false);
    expect(checkReceipt({ ...r, timestamp: "2026-10-03T10:00:01.000Z" }, [entry], "p1").match).toBe(false);
  });
  it("rejects unknown index and wrong project", () => {
    expect(checkReceipt({ ...r, index: 9 }, [entry], "p1").match).toBe(false);
    expect(checkReceipt(r, [entry], "other").match).toBe(false);
  });
  it("never throws on malformed input", () => {
    for (const bad of [null, undefined, 5, "x", [], {}, { ...r, format: "nope" }, { ...r, index: "3" }, { ...r, index: -1 }]) {
      const res = checkReceipt(bad, [entry], "p1");
      expect(res.match).toBe(false);
      if (!res.match) expect(res.reason).toBeTruthy();
    }
  });
});
