"use client";

import { useState } from "react";
import { checkReceipt, type ChainEntry, type ReceiptCheck as Result } from "@/lib/receipt";

const MAX_BYTES = 64 * 1024;

export function ReceiptCheck({ projectId, entries }: { projectId: string; entries: ChainEntry[] }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  function run() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setResult({ match: false, reason: "That is not valid JSON." });
      return;
    }
    setResult(checkReceipt(parsed, entries, projectId));
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setResult({ match: false, reason: "That file is too large to be a receipt." });
      return;
    }
    setText(await file.text());
    setResult(null);
  }

  return (
    <div className="mt-2 rounded-xl border border-line bg-surface p-4">
      <p className="text-sm text-slate-600">
        Paste the receipt you downloaded after deciding (or choose the file) to confirm it matches an entry in this chain.
      </p>
      <label htmlFor="receipt-json" className="mt-3 block text-sm font-medium text-ink">
        Receipt JSON
      </label>
      <textarea
        id="receipt-json"
        rows={6}
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setResult(null);
        }}
        className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} disabled={!text.trim()} className="btn btn-primary disabled:opacity-50">
          Check receipt
        </button>
        <label htmlFor="receipt-file" className="text-sm text-muted">
          or upload{" "}
          <input
            id="receipt-file"
            type="file"
            accept="application/json,.json"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="text-xs"
          />
        </label>
      </div>
      <div role="status" className="empty:hidden">
        {result &&
          (result.match ? (
            <p className="mt-3 rounded-lg border border-ok/25 bg-ok-soft px-3 py-2 text-sm font-semibold text-ok">
              Match: this receipt is entry #{result.index} in this chain.
            </p>
          ) : (
            <p className="mt-3 rounded-lg border border-bad/25 bg-bad-soft px-3 py-2 text-sm text-bad">
              <span className="font-semibold">No match.</span> {result.reason}
            </p>
          ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        A match shows the entry exists as recorded. The name on a receipt is whatever the reviewer typed.
      </p>
    </div>
  );
}
