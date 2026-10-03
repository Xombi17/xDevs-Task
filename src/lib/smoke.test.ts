import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { GENESIS_HASH } from "@/lib/ledger/hash";

describe("toolchain smoke", () => {
  it("resolves the @/ alias to a real module", () => {
    expect(GENESIS_HASH).toHaveLength(64);
  });

  it("loads better-sqlite3 natively and finds this file", async () => {
    const { default: Database } = await import("better-sqlite3");
    const db = new Database(":memory:");
    const row = db.prepare("select 1 as one").get() as { one: number };
    expect(row.one).toBe(1);
    db.close();
    expect(fs.existsSync(path.resolve("src/lib/smoke.test.ts"))).toBe(true);
  });
});
