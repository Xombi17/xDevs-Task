// Server-only: loads chains from SQLite and verifies them with node:crypto.
import { createHash } from "node:crypto";
import type { Database } from "better-sqlite3";
import { verifyChain, type StoredEntry, type VerifyResult } from "@/lib/ledger/verify";

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

type Row = {
  project_id: string;
  idx: number;
  timestamp: string;
  action: string;
  actor: string;
  payload_json: string;
  prev_hash: string;
  hash: string;
};

export function getEntries(db: Database, projectId: string): StoredEntry[] {
  const rows = db
    .prepare("SELECT * FROM ledger_entries WHERE project_id = ? ORDER BY idx")
    .all(projectId) as Row[];
  return rows.map((r) => ({
    projectId: r.project_id,
    index: r.idx,
    timestamp: r.timestamp,
    action: r.action,
    actor: r.actor,
    payloadJson: r.payload_json,
    prevHash: r.prev_hash,
    hash: r.hash,
  }));
}

export function verifyProject(db: Database, projectId: string): Promise<VerifyResult> {
  return verifyChain(projectId, getEntries(db, projectId), sha256Hex);
}
