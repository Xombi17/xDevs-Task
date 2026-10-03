import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Database } from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { getEntries } from "@/lib/ledger/chain";
import { AppError } from "@/lib/http/errors";
import { rateLimit, resetRateLimit } from "@/lib/http/rate-limit";
import { createProject, getLedger, getProject, listProjects } from "@/lib/services/projects";
import { decide, getReviewByToken } from "@/lib/services/review";

let dir: string;
let db: Database;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "signseal-svc-"));
  db = openDb(path.join(dir, "test.db"));
  resetRateLimit();
});

afterEach(() => {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

const input = (title = "Website Redesign") => ({
  title,
  clientName: "Acme",
  milestones: [{ title: "Wireframes" }, { title: "Design" }, { title: "Launch", dueDate: "2026-12-01" }],
});

const count = (table: string) =>
  (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;

describe("createProject", () => {
  it("writes project, milestones and a PROJECT_CREATED genesis entry", () => {
    const p = createProject(db, input());
    expect(p.reviewToken).toHaveLength(43);
    expect(p.milestones).toHaveLength(3);
    const entries = getEntries(db, p.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].index).toBe(0);
    expect(entries[0].action).toBe("PROJECT_CREATED");
    expect(entries[0].actor).toBe("agency");
    expect(entries[0].prevHash).toBe("0".repeat(64));
  });

  it("rolls everything back when a step fails", () => {
    // A milestone title that is not a string makes the insert throw mid-transaction.
    const bad = { ...input(), milestones: [{ title: "ok" }, { title: {} as unknown as string }, { title: "x" }] };
    expect(() => createProject(db, bad)).toThrow();
    expect(count("projects")).toBe(0);
    expect(count("milestones")).toBe(0);
    expect(count("ledger_entries")).toBe(0);
  });

  it("list and detail expose tokens only on the detail DTO", async () => {
    const p = createProject(db, input());
    expect(JSON.stringify(listProjects(db))).not.toContain(p.reviewToken);
    expect(getProject(db, p.id).reviewToken).toBe(p.reviewToken);
    expect(JSON.stringify(await getLedger(db, p.id))).not.toContain(p.reviewToken);
  });
});

describe("getReviewByToken", () => {
  it("throws NOT_FOUND 404 for an unknown token", () => {
    expect.assertions(3);
    try {
      getReviewByToken(db, "nope");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(404);
      expect((e as AppError).code).toBe("NOT_FOUND");
    }
  });

  it("returns a DTO without the token", () => {
    const p = createProject(db, input());
    const r = getReviewByToken(db, p.reviewToken);
    expect(r.milestones).toHaveLength(3);
    expect(JSON.stringify(r)).not.toContain(p.reviewToken);
  });
});

describe("decide", () => {
  it("records an approval and returns a receipt", () => {
    const p = createProject(db, input());
    const m = p.milestones[0];
    const out = decide(db, p.reviewToken, { milestoneId: m.id, decision: "approved", actor: "Jane" });
    expect(out.receipt.index).toBe(1);
    expect(out.receipt.hash).toHaveLength(64);
    expect(out.milestone.status).toBe("approved");
    expect(getEntries(db, p.id)).toHaveLength(2);
  });

  it("returns the identical 404 for a milestone of another project (IDOR)", () => {
    const a = createProject(db, input("A"));
    const b = createProject(db, input("B"));
    const grab = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return e as AppError;
      }
      throw new Error("expected throw");
    };
    const unknownToken = grab(() => getReviewByToken(db, "nope"));
    const foreign = grab(() =>
      decide(db, a.reviewToken, { milestoneId: b.milestones[0].id, decision: "approved", actor: "Eve" }),
    );
    expect(foreign.status).toBe(404);
    expect(foreign.status).toBe(unknownToken.status);
    expect(foreign.code).toBe(unknownToken.code);
    expect(foreign.message).toBe(unknownToken.message);
    expect(getEntries(db, a.id)).toHaveLength(1);
    expect(getEntries(db, b.id)).toHaveLength(1);
  });

  it("second decision on the same milestone is a 409 ALREADY_DECIDED with no new entry", () => {
    const p = createProject(db, input());
    const m = p.milestones[0];
    decide(db, p.reviewToken, { milestoneId: m.id, decision: "approved", actor: "Jane" });
    expect.assertions(4);
    try {
      decide(db, p.reviewToken, { milestoneId: m.id, decision: "changes_requested", actor: "Jane", note: "x" });
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(409);
      expect((e as AppError).code).toBe("ALREADY_DECIDED");
    }
    expect(getEntries(db, p.id)).toHaveLength(2);
  });

  it("maps a pipe actor to 422 INVALID_ACTOR", () => {
    const p = createProject(db, input());
    expect.assertions(2);
    try {
      decide(db, p.reviewToken, { milestoneId: p.milestones[0].id, decision: "approved", actor: "a|b" });
    } catch (e) {
      expect((e as AppError).status).toBe(422);
      expect((e as AppError).code).toBe("INVALID_ACTOR");
    }
  });
});

describe("rateLimit", () => {
  it("allows max hits per key then blocks, other keys unaffected, reset clears", () => {
    const cfg = { max: 3, windowMs: 60_000 };
    expect(rateLimit("k", cfg).ok).toBe(true);
    expect(rateLimit("k", cfg).ok).toBe(true);
    expect(rateLimit("k", cfg).ok).toBe(true);
    const blocked = rateLimit("k", cfg);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimit("other", cfg).ok).toBe(true);
    resetRateLimit();
    expect(rateLimit("k", cfg).ok).toBe(true);
  });
});
