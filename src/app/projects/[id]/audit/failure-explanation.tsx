import type { Explanation } from "@/lib/ledger/explain";

export function FailureExplanation({ explanation: x }: { explanation: Explanation }) {
  return (
    <div className="mt-4 rounded-lg border border-line bg-white px-4 py-3 text-sm text-ink">
      <p className="font-semibold">{x.headline}</p>
      <p className="mt-1 text-slate-700">{x.detail}</p>
      {x.untrustedNote && <p className="mt-1 text-warn">{x.untrustedNote}</p>}
      {x.milestoneNote && (
        <p className="mt-2 text-slate-700">
          <span className="font-semibold">Milestone cross-check: </span>
          {x.milestoneNote}
        </p>
      )}
      <p className="mt-2 text-xs text-muted">
        <span className="font-semibold uppercase tracking-wide">Best-effort. </span>
        {x.caveat.replace(/^Best-effort:\s*/, "")}
      </p>
    </div>
  );
}
