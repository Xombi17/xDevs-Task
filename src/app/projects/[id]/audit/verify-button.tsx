"use client";

import { useState } from "react";
import type { VerifyResult } from "@/lib/ledger/verify";
import { HashText } from "@/components/ui/hash-text";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "done"; result: VerifyResult };

const CHIP: Record<"ok" | "broken" | "untrusted", string> = {
  ok: "bg-ok-soft text-ok ring-ok/25",
  broken: "bg-bad-soft text-bad ring-bad/30",
  untrusted: "bg-warn-soft text-warn ring-warn/30",
};

export function VerifyButton({ projectId }: { projectId: string }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function run() {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/projects/${projectId}/verify`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setState({ kind: "done", result: (await res.json()) as VerifyResult });
    } catch {
      setState({ kind: "error" });
    }
  }

  const loading = state.kind === "loading";

  return (
    <div>
      <button type="button" onClick={run} disabled={loading} className="btn btn-primary disabled:opacity-60">
        {loading ? "Verifying…" : "Verify integrity"}
      </button>

      {state.kind === "error" && (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-bad/25 bg-bad-soft px-3 py-2 text-sm text-bad">
          <span className="font-medium">Could not verify. Check your connection and try again.</span>
          <button type="button" onClick={run} className="font-semibold underline underline-offset-2">
            Retry
          </button>
        </div>
      )}

      {state.kind === "done" && <Result result={state.result} />}
    </div>
  );
}

function Result({ result }: { result: VerifyResult }) {
  const bad = !result.valid;
  const hasUntrusted = result.entries.some((e) => e.status === "untrusted");
  return (
    <div
      role="status"
      className={`mt-3 rounded-lg border px-4 py-3 ${
        bad ? "border-bad/25 bg-bad-soft text-bad" : "border-ok/25 bg-ok-soft text-ok"
      }`}
    >
      <p className="text-sm font-semibold">
        {bad
          ? `Broken at entry #${result.brokenAt}`
          : `Valid — ${result.length} ${result.length === 1 ? "entry" : "entries"}, chain intact`}
      </p>
      {bad && hasUntrusted && (
        <p className="mt-1 text-sm text-warn">Entries after #{result.brokenAt} are untrusted.</p>
      )}
      <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Entry verification results">
        {result.entries.map((e) => (
          <li key={e.index}>
            <a
              href={`#entry-${e.index}`}
              className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold ring-1 ring-inset ${CHIP[e.status]}`}
            >
              #{e.index}
              <span className="sr-only"> {e.status === "ok" ? "intact" : e.status}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
        <span className="font-semibold uppercase tracking-wide">Head</span>
        <HashText hash={result.headHash} short copy />
      </div>
    </div>
  );
}
