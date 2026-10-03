import type { VerifyResult } from "@/lib/ledger/verify";
import { HashText } from "@/components/ui/hash-text";

type Row = VerifyResult["entries"][number];

const ROW: Record<Row["status"], string> = {
  ok: "border-ok/25 bg-ok-soft",
  broken: "border-bad/40 bg-bad-soft ring-2 ring-bad/30",
  untrusted: "border-warn/30 bg-warn-soft",
};
const TEXT: Record<Row["status"], string> = { ok: "text-ok", broken: "text-bad", untrusted: "text-warn" };

const REASON: Record<NonNullable<Row["reason"]>, string> = {
  "self-hash": "Stored hash does not match the recomputed hash",
  "prev-link": "prevHash does not match the previous entry's hash",
  index: "Stored index does not match its position in the chain",
  project: "Entry belongs to a different project",
};

function label(r: Row, brokenAt?: number) {
  if (r.status === "ok") return "OK";
  if (r.status === "broken") return "BROKEN";
  return `UNTRUSTED (downstream of #${brokenAt})`;
}

export function TamperMap({ result }: { result: VerifyResult }) {
  return (
    <div className="mt-4">
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Legend">
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-sm bg-ok" />Green: intact</li>
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-sm bg-bad" />Red: first failure</li>
        <li className="flex items-center gap-1.5"><span aria-hidden="true" className="size-2.5 rounded-sm bg-warn" />Amber: untrusted because an earlier entry failed</li>
      </ul>
      <ol aria-label="Tamper map" className="space-y-1.5">
        {result.entries.map((r) => {
          const differs = r.expectedHash !== r.storedHash;
          return (
            <li key={r.index} className={`rounded-lg border px-3 py-2 ${ROW[r.status]}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <a href={`#entry-${r.index}`} className="font-mono text-sm font-bold text-ink underline-offset-2 hover:underline">
                  #{r.index}
                </a>
                <span className={`text-xs font-bold tracking-wide ${TEXT[r.status]}`}>{label(r, result.brokenAt)}</span>
              </div>
              {r.status === "broken" && r.reason && (
                <p className="mt-1 text-xs font-medium text-bad">{REASON[r.reason]}</p>
              )}
              {r.status === "ok" ? (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                  <span className="font-semibold uppercase tracking-wide text-muted">stored</span>
                  <HashText hash={r.storedHash} short />
                </div>
              ) : (
                <dl className="mt-1.5 space-y-1.5 text-xs">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
                    <dt className="w-16 shrink-0 font-semibold uppercase tracking-wide text-muted">expected</dt>
                    <dd className="min-w-0"><HashText hash={r.expectedHash} /></dd>
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
                    <dt className="w-16 shrink-0 font-semibold uppercase tracking-wide text-muted">stored</dt>
                    <dd className="min-w-0"><HashText hash={r.storedHash} /></dd>
                  </div>
                  {r.status === "broken" && differs && (
                    <p className="font-bold text-bad">≠ expected and stored hashes differ</p>
                  )}
                </dl>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
