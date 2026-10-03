"use client";

import { useState } from "react";
import type { VerifyResult } from "@/lib/ledger/verify";
import { getWebCryptoHasher, runBrowserVerify, type BrowserVerifyOutcome, type LedgerEntryDto } from "@/lib/ledger/browser-verify";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "outcome"; outcome: BrowserVerifyOutcome };

// Parent passes a key derived from the server result so state resets on change.
export function BrowserReverify({ projectId, server }: { projectId: string; server: VerifyResult }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function run() {
    setState({ kind: "loading" });
    try {
      if (!getWebCryptoHasher()) {
        setState({ kind: "outcome", outcome: await runBrowserVerify(projectId, [], server, null) });
        return;
      }
      const res = await fetch(`/api/projects/${projectId}/ledger`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { entries: LedgerEntryDto[] };
      setState({ kind: "outcome", outcome: await runBrowserVerify(projectId, body.entries, server) });
    } catch {
      setState({ kind: "error" });
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <button type="button" onClick={run} disabled={state.kind === "loading"} className="btn btn-secondary disabled:opacity-60">
        {state.kind === "loading" ? "Re-verifying…" : "Re-verify in browser"}
      </button>
      <p className="mt-1 text-xs text-muted">Recomputes every hash here with Web Crypto instead of trusting the server.</p>

      {state.kind === "error" && (
        <div role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-bad/25 bg-bad-soft px-3 py-2 text-sm text-bad">
          <span className="font-medium">Could not load the ledger for browser verification.</span>
          <button type="button" onClick={run} className="font-semibold underline underline-offset-2">Retry</button>
        </div>
      )}

      {state.kind === "outcome" && state.outcome.kind === "unavailable" && (
        <p className="mt-3 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn">{state.outcome.message}</p>
      )}

      {state.kind === "outcome" && state.outcome.kind === "done" && (
        <div className="mt-3 rounded-lg border border-line bg-white px-3 py-2 text-sm" aria-live="polite">
          <p className="font-semibold">
            {state.outcome.result.valid
              ? "Browser result: Valid"
              : `Browser result: Broken at entry #${state.outcome.result.brokenAt}`}
          </p>
          <p className={`mt-0.5 font-semibold ${state.outcome.agrees ? "text-ok" : "text-bad"}`}>
            {state.outcome.agrees ? "Agrees with server" : "Differs from server"}
          </p>
          {state.outcome.differences.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs text-bad">
              {state.outcome.differences.map((d) => <li key={d}>{d}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
