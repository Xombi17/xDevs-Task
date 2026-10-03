import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { canonicalJson, preimage } from "@/lib/ledger/hash";
import { seedDemo, seedTampered } from "@/lib/seed";
import { getExport } from "@/lib/services/projects";

const SCRIPT = path.resolve(__dirname, "verify-chain.mjs");

type Script = {
  canonicalJson: (v: unknown) => string;
  preimage: (e: Record<string, unknown>) => string;
};
let script: Script;

type Doc = Awaited<ReturnType<typeof getExport>>;
let dir: string;
let demo: Doc;
let tampered: Doc;

beforeEach(async () => {
  script = (await import(/* @vite-ignore */ pathToFileURL(SCRIPT).href)) as Script;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "signseal-script-"));
  const db = openDb(path.join(dir, "s.db"));
  const a = seedDemo(db);
  const b = seedTampered(db);
  demo = await getExport(db, a.projectId);
  tampered = await getExport(db, b.projectId);
  db.close();
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function run(doc: unknown, ...extra: string[]) {
  const f = path.join(dir, "export.json");
  fs.writeFileSync(f, typeof doc === "string" ? doc : JSON.stringify(doc));
  const r = spawnSync(process.execPath, [SCRIPT, f, ...extra], { encoding: "utf8" });
  return { code: r.status, out: r.stdout + r.stderr };
}

const clone = (d: Doc) => JSON.parse(JSON.stringify(d)) as Doc;

describe("script parity with src/lib/ledger/hash.ts", () => {
  const values: unknown[] = [
    { b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } },
    { meta: { y: [1, 2], x: 1 }, title: "T" },
    { title: "T", meta: { x: 1, y: [1, 2] } },
    { note: "a|b|c", pipe: "|" },
    { emoji: "ship it \u{1F680}", accent: "café üñ", cjk: "漢字" },
    { a: undefined, b: null, c: [null, undefined, 1] },
    [1, [2, [3, { k: "v" }]]],
    "plain string",
    42,
    null,
    { "key with \"quotes\"": 'line\nbreak\t"x"' },
  ];

  it.each(values.map((v, i) => [i, v] as const))("canonicalJson matches for vector %i", (_i, v) => {
    expect(script.canonicalJson(v)).toBe(canonicalJson(v));
  });

  it("canonicalJson of shuffled key order is identical in both implementations", () => {
    const a = { x: 1, y: { q: 1, p: 2 }, z: [1, 2] };
    const b = { z: [1, 2], y: { p: 2, q: 1 }, x: 1 };
    expect(script.canonicalJson(a)).toBe(script.canonicalJson(b));
    expect(script.canonicalJson(a)).toBe(canonicalJson(b));
  });

  it("both throw on non-finite numbers", () => {
    expect(() => script.canonicalJson({ a: NaN })).toThrow();
    expect(() => canonicalJson({ a: NaN })).toThrow();
  });

  it("preimage matches, including pipes and unicode", () => {
    const f = {
      index: 3,
      timestamp: "2026-01-01T00:00:00.000Z",
      action: "CHANGES_REQUESTED",
      actor: "Zoë \u{1F680}",
      payloadJson: canonicalJson({ note: "a|b" }),
      prevHash: "ab".repeat(32),
    };
    expect(script.preimage(f)).toBe(preimage(f));
  });
});

describe("CLI on exports", () => {
  it("exits 0 and prints VALID for the seeded demo export", () => {
    const r = run(demo);
    expect(r.code).toBe(0);
    expect(r.out).toContain("VALID");
    expect(r.out).toContain(demo.headHash);
  });

  it("exits 1 at entry #2 for the pre-tampered seed project", () => {
    const r = run(tampered);
    expect(r.code).toBe(1);
    expect(r.out).toContain("BROKEN at entry #2");
  });

  it("style A: edited payload at N is reported at #N", () => {
    const d = clone(demo);
    d.entries[1].payloadJson = canonicalJson({ forged: true });
    const r = run(d);
    expect(r.code).toBe(1);
    expect(r.out).toContain("#1");
    expect(r.out).toContain("self-hash");
  });

  it("style B: payload edited AND hash rewritten passes N, breaks at N+1 via prev-link", async () => {
    const { createHash } = await import("node:crypto");
    const d = clone(demo);
    d.entries[1].payloadJson = canonicalJson({ forged: true });
    d.entries[1].hash = createHash("sha256").update(preimage(d.entries[1]), "utf8").digest("hex");
    const r = run(d);
    expect(r.code).toBe(1);
    expect(r.out).toContain("BROKEN at entry #2");
    expect(r.out).toContain("prev-link");
  });

  it("truncated tail passes alone but fails with --head of the original", () => {
    const d = clone(demo);
    d.entries.pop();
    d.length = d.entries.length;
    d.headHash = d.entries[d.entries.length - 1].hash;
    expect(run(d).code).toBe(0);
    const pinned = run(d, "--head", demo.headHash);
    expect(pinned.code).toBe(1);
    expect(pinned.out).toContain("head mismatch (possible truncation)");
    expect(run(demo, "--head", demo.headHash).code).toBe(0);
  });

  it("declared headHash or length disagreeing with entries fails", () => {
    const d = clone(demo);
    d.headHash = "f".repeat(64);
    expect(run(d).code).toBe(1);
    const e = clone(demo);
    e.length = 99;
    expect(run(e).code).toBe(1);
  });

  it("exits 2 for missing file, bad JSON, missing keys and no args", () => {
    expect(spawnSync(process.execPath, [SCRIPT, "/nonexistent.json"]).status).toBe(2);
    expect(spawnSync(process.execPath, [SCRIPT]).status).toBe(2);
    expect(run("{not json").code).toBe(2);
    expect(run({ nope: true }).code).toBe(2);
  });
});
