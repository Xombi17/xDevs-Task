import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  ACTIONS,
  GENESIS_HASH,
  assertValidActor,
  canonicalJson,
  preimage,
} from "@/lib/ledger/hash";

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

describe("canonicalJson", () => {
  it("sorts keys recursively, keeps array order, no whitespace", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } })).toBe(
      '{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}',
    );
  });

  it("key-order shuffle gives identical json and identical SHA-256", () => {
    const one = { title: "T", milestones: 2, meta: { x: 1, y: [1, 2] } };
    const two = { meta: { y: [1, 2], x: 1 }, milestones: 2, title: "T" };
    expect(canonicalJson(one)).toBe(canonicalJson(two));
    expect(sha(canonicalJson(one))).toBe(sha(canonicalJson(two)));
  });

  it("preserves unicode and pipes verbatim", () => {
    expect(canonicalJson({ a: "café ✓", b: "x|y" })).toBe('{"a":"café ✓","b":"x|y"}');
  });

  it("drops undefined object values, keeps null", () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it("throws on non-finite numbers", () => {
    expect(() => canonicalJson({ a: NaN })).toThrow();
    expect(() => canonicalJson({ a: Infinity })).toThrow();
  });
});

describe("assertValidActor", () => {
  it("rejects pipe and empty", () => {
    expect(() => assertValidActor("a|b")).toThrow();
    expect(() => assertValidActor("")).toThrow();
  });
  it("accepts normal names", () => {
    expect(() => assertValidActor("Jane Doe")).not.toThrow();
    expect(() => assertValidActor("Zoë")).not.toThrow();
  });
});

describe("GENESIS_HASH and ACTIONS", () => {
  it("is 64 zeros", () => {
    expect(GENESIS_HASH).toHaveLength(64);
    expect(GENESIS_HASH).toBe("0".repeat(64));
    expect([...GENESIS_HASH].every((c) => c === "0")).toBe(true);
  });
  it("lists the three actions", () => {
    expect([...ACTIONS]).toEqual(["PROJECT_CREATED", "MILESTONE_APPROVED", "CHANGES_REQUESTED"]);
  });
});

describe("preimage", () => {
  const entry = {
    index: 0,
    timestamp: "2026-01-01T00:00:00.000Z",
    action: "PROJECT_CREATED",
    actor: "Agency",
    payloadJson: canonicalJson({ title: "T", milestones: 2 }),
    prevHash: GENESIS_HASH,
  };

  it("joins fields with | in order", () => {
    expect(preimage(entry)).toBe(
      `0|2026-01-01T00:00:00.000Z|PROJECT_CREATED|Agency|{"milestones":2,"title":"T"}|${"0".repeat(64)}`,
    );
  });

  it("matches the golden SHA-256 vector", () => {
    // Computed once with node:crypto and cross-checked with `printf '%s' ... | sha256sum`.
    expect(sha(preimage(entry))).toBe(
      "f07145196c7772dc86988652c486cf431829d4b39533bb7121db5fb441e2f04f",
    );
  });
});
