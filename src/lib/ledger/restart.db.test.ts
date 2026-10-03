import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDb } from "@/lib/db";
import { verifyProject } from "@/lib/ledger/chain";
import { seedDemo } from "@/lib/seed";
import { createProject, getExport } from "@/lib/services/projects";
import { decide } from "@/lib/services/review";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "signseal-restart-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("restart persistence", () => {
  it("closing and reopening the file DB keeps the chain valid with the same head", async () => {
    const file = path.join(dir, "restart.db");
    const db1 = openDb(file);
    const { projectId } = seedDemo(db1);
    const p = createProject(db1, {
      title: "Second",
      clientName: "C",
      milestones: [{ title: "a" }, { title: "b" }, { title: "c" }],
    });
    decide(db1, p.reviewToken, { milestoneId: p.milestones[0].id, decision: "approved", actor: "Jane" });
    const before = await verifyProject(db1, projectId);
    const before2 = await verifyProject(db1, p.id);
    expect(before.valid && before2.valid).toBe(true);
    db1.close();

    const db2 = openDb(file);
    const after = await verifyProject(db2, projectId);
    const after2 = await verifyProject(db2, p.id);
    expect(after.valid).toBe(true);
    expect(after.headHash).toBe(before.headHash);
    expect(after.length).toBe(before.length);
    expect(after2.headHash).toBe(before2.headHash);
    expect(after2.length).toBe(2);
    expect((await getExport(db2, projectId)).headHash).toBe(before.headHash);
    db2.close();
  });
});
