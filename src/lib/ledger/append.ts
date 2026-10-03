// Server-only single writer for the ledger (LEDG-04).
import type { Database } from "better-sqlite3";
import { GENESIS_HASH, assertValidActor, canonicalJson, preimage, type LedgerAction } from "@/lib/ledger/hash";
import { sha256Hex } from "@/lib/ledger/chain";

export type LedgerErrorCode =
  | "PROJECT_NOT_FOUND"
  | "MILESTONE_NOT_FOUND"
  | "ALREADY_DECIDED"
  | "INVALID_ACTOR";

export class LedgerError extends Error {
  constructor(
    public code: LedgerErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "LedgerError";
  }
}

export type AppendInput = {
  projectId: string;
  action: LedgerAction;
  actor: string;
  payload: unknown;
  now?: () => string;
  milestone?: {
    id: string;
    status: "approved" | "changes_requested";
    decidedBy: string;
    decidedAt: string;
    note?: string | null;
  };
};

export type AppendResult = {
  index: number;
  timestamp: string;
  action: string;
  actor: string;
  payloadJson: string;
  prevHash: string;
  hash: string;
};

export function append(db: Database, input: AppendInput): AppendResult {
  // .immediate() takes the write lock BEFORE the head read, so concurrent
  // writers serialize and cannot fork the chain. UNIQUE(project_id, idx) is
  // the backstop. Everything inside is synchronous.
  const run = db.transaction((inp: AppendInput): AppendResult => {
    try {
      assertValidActor(inp.actor);
    } catch (e) {
      throw new LedgerError("INVALID_ACTOR", (e as Error).message);
    }

    const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(inp.projectId);
    if (!project) throw new LedgerError("PROJECT_NOT_FOUND");

    if (inp.milestone) {
      const m = db
        .prepare("SELECT status FROM milestones WHERE id = ? AND project_id = ?")
        .get(inp.milestone.id, inp.projectId) as { status: string } | undefined;
      if (!m) throw new LedgerError("MILESTONE_NOT_FOUND");
      if (m.status !== "pending") throw new LedgerError("ALREADY_DECIDED");
    }

    const head = db
      .prepare("SELECT idx, hash FROM ledger_entries WHERE project_id = ? ORDER BY idx DESC LIMIT 1")
      .get(inp.projectId) as { idx: number; hash: string } | undefined;
    const index = head ? head.idx + 1 : 0;
    const prevHash = head ? head.hash : GENESIS_HASH;
    const timestamp = (inp.now ?? (() => new Date().toISOString()))();
    const payloadJson = canonicalJson(inp.payload);
    const hash = sha256Hex(
      preimage({ index, timestamp, action: inp.action, actor: inp.actor, payloadJson, prevHash }),
    );

    db.prepare(
      `INSERT INTO ledger_entries (project_id, idx, timestamp, action, actor, payload_json, prev_hash, hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(inp.projectId, index, timestamp, inp.action, inp.actor, payloadJson, prevHash, hash);

    if (inp.milestone) {
      const m = inp.milestone;
      db.prepare(
        "UPDATE milestones SET status = ?, decided_by = ?, decided_at = ?, note = ? WHERE id = ? AND project_id = ?",
      ).run(m.status, m.decidedBy, m.decidedAt, m.note ?? null, m.id, inp.projectId);
    }

    return { index, timestamp, action: inp.action, actor: inp.actor, payloadJson, prevHash, hash };
  });
  return run.immediate(input);
}
