// Explicit allow-list mappers (API-03). Never spread a row: new columns must be
// opted in here before they can leave the server.
import type { StoredEntry } from "@/lib/ledger/verify";

export type ProjectRow = { id: string; title: string; client_name: string; review_token: string; created_at: string };
export type MilestoneRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: "pending" | "approved" | "changes_requested";
  decided_by: string | null;
  decided_at: string | null;
  note: string | null;
  position: number;
};

export function toMilestoneDto(m: MilestoneRow) {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    dueDate: m.due_date,
    status: m.status,
    decidedBy: m.decided_by,
    decidedAt: m.decided_at,
    note: m.note,
    position: m.position,
  };
}

export function toProjectSummaryDto(p: ProjectRow, milestones: MilestoneRow[]) {
  const approvedCount = milestones.filter((m) => m.status === "approved").length;
  const totalCount = milestones.length;
  const status: "pending" | "in_progress" | "complete" | "changes_requested" = milestones.some(
    (m) => m.status === "changes_requested",
  )
    ? "changes_requested"
    : totalCount > 0 && approvedCount === totalCount
      ? "complete"
      : approvedCount > 0
        ? "in_progress"
        : "pending";
  return { id: p.id, title: p.title, clientName: p.client_name, createdAt: p.created_at, approvedCount, totalCount, status };
}

// Agency-only: GET /api/projects/:id and the POST /api/projects response are the
// only places the review token is returned (the agency needs it to share the link).
export function toProjectDetailDto(p: ProjectRow, milestones: MilestoneRow[]) {
  return {
    ...toProjectSummaryDto(p, milestones),
    reviewToken: p.review_token,
    milestones: milestones.map(toMilestoneDto),
  };
}

// Public client view: no project id, no token.
export function toReviewDto(p: ProjectRow, milestones: MilestoneRow[]) {
  return {
    projectTitle: p.title,
    clientName: p.client_name,
    milestones: milestones.map(toMilestoneDto),
  };
}

export function toLedgerDto(entries: StoredEntry[], headHash: string, length: number) {
  return {
    headHash,
    length,
    entries: entries.map((e) => ({
      index: e.index,
      timestamp: e.timestamp,
      action: e.action,
      actor: e.actor,
      payloadJson: e.payloadJson,
      payload: JSON.parse(e.payloadJson) as unknown,
      prevHash: e.prevHash,
      hash: e.hash,
    })),
  };
}

// Public export document (EXPT-01). Explicit allow-list: no token, no client name,
// no parsed payload. payloadJson stays the exact stored string so hashes recompute.
export function toExportDto(projectId: string, title: string, entries: StoredEntry[], headHash: string, length: number) {
  return {
    format: "signseal-ledger-export/v1" as const,
    projectId,
    title,
    exportedAt: new Date().toISOString(),
    headHash,
    length,
    entries: entries.map((e) => ({
      index: e.index,
      timestamp: e.timestamp,
      action: e.action,
      actor: e.actor,
      payloadJson: e.payloadJson,
      prevHash: e.prevHash,
      hash: e.hash,
    })),
  };
}
