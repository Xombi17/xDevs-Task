import type { Database } from "better-sqlite3";
import { fromLedgerError, notFound } from "@/lib/http/errors";
import { append, LedgerError } from "@/lib/ledger/append";
import { toReviewDto, type MilestoneRow, type ProjectRow } from "@/lib/services/dto";
import type { DecisionInput } from "@/lib/services/schemas";

function projectByToken(db: Database, token: string): ProjectRow {
  const p = db.prepare("SELECT * FROM projects WHERE review_token = ?").get(token) as ProjectRow | undefined;
  if (!p) throw notFound();
  return p;
}

export function getReviewByToken(db: Database, token: string) {
  const p = projectByToken(db, token);
  const ms = db
    .prepare("SELECT * FROM milestones WHERE project_id = ? ORDER BY position")
    .all(p.id) as MilestoneRow[];
  return toReviewDto(p, ms);
}

export function decide(db: Database, token: string, input: DecisionInput) {
  const p = projectByToken(db, token);

  // IDOR guard: the milestone must belong to the project the token unlocks.
  // A foreign id gets the same 404 as an unknown token.
  const owned = db
    .prepare("SELECT id FROM milestones WHERE id = ? AND project_id = ?")
    .get(input.milestoneId, p.id);
  if (!owned) throw notFound();

  const status = input.decision;
  const note = input.note ?? null;
  try {
    // The decide-once check runs inside append's immediate transaction,
    // so parallel requests cannot both succeed.
    const entry = append(db, {
      projectId: p.id,
      action: status === "approved" ? "MILESTONE_APPROVED" : "CHANGES_REQUESTED",
      actor: input.actor,
      payload: { milestoneId: input.milestoneId, decision: status, note },
      milestone: {
        id: input.milestoneId,
        status,
        decidedBy: input.actor,
        decidedAt: new Date().toISOString(),
        note,
      },
    });
    return {
      milestone: { id: input.milestoneId, status },
      receipt: {
        projectId: p.id,
        index: entry.index,
        hash: entry.hash,
        timestamp: entry.timestamp,
        action: entry.action,
        actor: input.actor,
      },
    };
  } catch (e) {
    if (e instanceof LedgerError) throw fromLedgerError(e);
    throw e;
  }
}
