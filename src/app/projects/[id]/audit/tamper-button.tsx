"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LEDGER_CHANGED_EVENT } from "./events";

export function TamperButton({ entryId, index }: { entryId: number; index: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const titleId = `tamper-title-${entryId}`;

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/dev/tamper/${entryId}`, { method: "POST" });
      if (res.ok) {
        close();
        setDone(true);
        window.dispatchEvent(new Event(LEDGER_CHANGED_EVENT));
        router.refresh();
      } else {
        let msg = `Tamper failed (HTTP ${res.status}).`;
        try {
          const body = (await res.json()) as { error?: { message?: string } };
          if (body.error?.message) msg = body.error.message;
        } catch {
          /* keep generic message */
        }
        setError(msg);
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={open} className="btn btn-secondary text-bad">
        Tamper (DEMO ONLY)
      </button>
      {done && (
        <p role="status" className="mt-2 text-xs text-bad">
          Entry #{index} tampered. Re-verifying…
        </p>
      )}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(92vw,28rem)] rounded-xl border border-line bg-white p-5 text-ink shadow-xl backdrop:bg-black/40"
      >
        <h3 id={titleId} className="text-base font-semibold">
          Tamper with entry #{index}?
        </h3>
        <p className="mt-2 text-sm text-slate-700">
          <span className="font-bold text-bad">DEMO ONLY.</span> This alters entry #{index}&apos;s payload in this
          local database. The hash is not recomputed, so Verify will report the chain as Broken.
        </p>
        {error && (
          <div role="alert" className="mt-3 rounded-lg border border-bad/25 bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </div>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" autoFocus onClick={close} disabled={busy} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="btn bg-bad text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Tampering…" : `Yes, tamper entry #${index}`}
          </button>
        </div>
      </dialog>
    </div>
  );
}
