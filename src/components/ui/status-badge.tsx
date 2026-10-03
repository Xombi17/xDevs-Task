export type Status =
  | "pending"
  | "approved"
  | "changes_requested"
  | "in_progress"
  | "complete"
  | "valid"
  | "broken"
  | "untrusted";

const LABEL: Record<Status, string> = {
  pending: "Pending",
  approved: "Approved",
  changes_requested: "Changes requested",
  in_progress: "In progress",
  complete: "Complete",
  valid: "Valid",
  broken: "Broken",
  untrusted: "Untrusted",
};

const TONE: Record<Status, { pill: string; dot: string }> = {
  approved: { pill: "bg-ok-soft text-ok ring-ok/20", dot: "bg-ok" },
  complete: { pill: "bg-ok-soft text-ok ring-ok/20", dot: "bg-ok" },
  valid: { pill: "bg-ok-soft text-ok ring-ok/20", dot: "bg-ok" },
  changes_requested: { pill: "bg-warn-soft text-warn ring-warn/25", dot: "bg-warn" },
  untrusted: { pill: "bg-warn-soft text-warn ring-warn/25", dot: "bg-warn" },
  pending: { pill: "bg-slate-100 text-slate-600 ring-slate-300/60", dot: "bg-slate-400" },
  in_progress: { pill: "bg-accent-soft text-accent ring-accent/20", dot: "bg-accent" },
  broken: { pill: "bg-bad-soft text-bad ring-bad/25", dot: "bg-bad" },
};

export function StatusBadge({ status, className = "" }: { status: Status; className?: string }) {
  const tone = TONE[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${tone.pill} ${className}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${tone.dot}`} />
      {LABEL[status]}
    </span>
  );
}
