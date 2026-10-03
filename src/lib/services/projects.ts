import { randomUUID } from "node:crypto";
import type { Database } from "better-sqlite3";
import { notFound } from "@/lib/http/errors";
import { append } from "@/lib/ledger/append";
import { getEntries, verifyProject } from "@/lib/ledger/chain";
import { generateToken } from "@/lib/ledger/token";
import {
  toExportDto,
  toLedgerDto,
  toProjectDetailDto,
  toProjectSummaryDto,
  type MilestoneRow,
  type ProjectRow,
} from "@/lib/services/dto";
import type { CreateProjectInput } from "@/lib/services/schemas";

function milestonesOf(db: Database, projectId: string): MilestoneRow[] {
  return db
    .prepare("SELECT * FROM milestones WHERE project_id = ? ORDER BY position")
    .all(projectId) as MilestoneRow[];
}

function requireProject(db: Database, id: string): ProjectRow {
  const p = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as ProjectRow | undefined;
  if (!p) throw notFound();
  return p;
}

// Project, milestones and the genesis ledger entry commit together or not at all (PROJ-02).
// append() opens its own transaction; inside this outer one it becomes a savepoint.
export function createProject(db: Database, input: CreateProjectInput) {
  const id = randomUUID();
  const run = db.transaction(() => {
    db.prepare("INSERT INTO projects (id, title, client_name, review_token, created_at) VALUES (?,?,?,?,?)").run(
      id, input.title, input.clientName, generateToken(), new Date().toISOString(),
    );
    const ins = db.prepare(
      "INSERT INTO milestones (id, project_id, title, description, due_date, position) VALUES (?,?,?,?,?,?)",
    );
    const created: { id: string; title: string }[] = [];
    input.milestones.forEach((m, position) => {
      const mid = randomUUID();
      ins.run(mid, id, m.title, m.description ?? null, m.dueDate ?? null, position);
      created.push({ id: mid, title: m.title });
    });
    append(db, {
      projectId: id,
      action: "PROJECT_CREATED",
      actor: "agency",
      payload: { title: input.title, clientName: input.clientName, milestones: created },
    });
  });
  run.immediate();
  return toProjectDetailDto(requireProject(db, id), milestonesOf(db, id));
}

export function listProjects(db: Database) {
  const rows = db.prepare("SELECT * FROM projects ORDER BY created_at DESC, rowid DESC").all() as ProjectRow[];
  return rows.map((p) => toProjectSummaryDto(p, milestonesOf(db, p.id)));
}

export function getProject(db: Database, id: string) {
  const p = requireProject(db, id);
  return toProjectDetailDto(p, milestonesOf(db, id));
}

export async function getLedger(db: Database, projectId: string) {
  requireProject(db, projectId);
  const entries = getEntries(db, projectId);
  const v = await verifyProject(db, projectId);
  return toLedgerDto(entries, v.headHash, v.length);
}

export async function getVerify(db: Database, projectId: string) {
  requireProject(db, projectId);
  return verifyProject(db, projectId);
}

// Reports the stored chain's head even if it is broken; the standalone verifier judges it.
export async function getExport(db: Database, projectId: string) {
  const p = requireProject(db, projectId);
  const entries = getEntries(db, projectId);
  const v = await verifyProject(db, projectId);
  return toExportDto(p.id, p.title, entries, v.headHash, v.length);
}
