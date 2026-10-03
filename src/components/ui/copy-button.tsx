"use client";

import { useEffect, useRef, useState } from "react";

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function useCopy() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async (text: string) => {
    const ok = await writeClipboard(text);
    setState(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };
  return { state, copy };
}

function CopyIcon({ done }: { done: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {done ? (
        <path d="m4.5 10.5 3.5 3.5 7.5-8" />
      ) : (
        <>
          <rect x="7" y="7" width="9" height="9" rx="2" />
          <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
        </>
      )}
    </svg>
  );
}

function CopyView({
  state,
  onClick,
  label,
  copiedLabel,
  variant,
}: {
  state: "idle" | "copied" | "failed";
  onClick: () => void;
  label: string;
  copiedLabel: string;
  variant: "primary" | "secondary" | "ghost";
}) {
  const style =
    variant === "primary"
      ? "btn btn-primary"
      : variant === "secondary"
        ? "btn btn-secondary"
        : "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted hover:bg-slate-100 hover:text-ink";
  return (
    <>
      <button type="button" onClick={onClick} className={style}>
        <CopyIcon done={state === "copied"} />
        {state === "copied" ? copiedLabel : label}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? copiedLabel : state === "failed" ? "Copy failed" : ""}
      </span>
      {state === "failed" && <span aria-hidden="true" className="text-xs text-bad">Copy failed</span>}
    </>
  );
}

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  variant = "ghost",
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const { state, copy } = useCopy();
  return <CopyView state={state} onClick={() => copy(value)} label={label} copiedLabel={copiedLabel} variant={variant} />;
}

/** Builds the absolute URL at click time so SSR and hydration never differ. */
export function CopyLinkButton({ path, variant = "primary" }: { path: string; variant?: "primary" | "secondary" }) {
  const { state, copy } = useCopy();
  return (
    <CopyView
      state={state}
      onClick={() => copy(window.location.origin + path)}
      label="Copy client link"
      copiedLabel="Link copied"
      variant={variant}
    />
  );
}
