"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { HashText } from "@/components/ui/hash-text";
import { StatusBadge } from "@/components/ui/status-badge";

type MilestoneStatus = "pending" | "approved" | "changes_requested";
type Milestone = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: MilestoneStatus;
  decidedBy: string | null;
  note: string | null;
};
type Receipt = { index: number; hash: string };
type Decision = "approved" | "changes_requested";

function nameError(name: string): string | null {
  const n = name.trim();
  if (!n) return "Enter your name to continue.";
  if (n.length > 80) return "Name must be 80 characters or fewer.";
  if (n.includes("|")) return 'Name cannot contain the "|" character.';
  return null;
}

async function errorMessage(res: Response): Promise<string> {
  let body: { error?: { details?: unknown } } = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  const details = body.error?.details;
  if (res.status === 404) return "This review link is no longer valid.";
  if (res.status === 409) return "This milestone was already decided.";
  if (res.status === 429) {
    const fromBody = (details as { retryAfterSec?: number } | undefined)?.retryAfterSec;
    const sec = fromBody ?? Number(res.headers.get("Retry-After"));
    return Number.isFinite(sec) && sec > 0
      ? `Too many attempts. Try again in ${sec} seconds.`
      : "Too many attempts. Please try again shortly.";
  }
  if (res.status === 422) {
    const first = Array.isArray(details) ? (details[0] as { message?: string } | undefined) : undefined;
    return first?.message ?? "Please check your input and try again.";
  }
  return "Something went wrong. Please try again.";
}

export function ReviewPanel({ milestones: initial }: { milestones: Milestone[] }) {
  // The token is read from the URL on the client, so it is never serialized into page props.
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const [milestones, setMilestones] = useState(initial);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [open, setOpen] = useState<string | null>(null); // milestone with the change-request form open
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteTouched, setNoteTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});

  const nameErr = nameError(name);

  async function submit(m: Milestone, decision: Decision) {
    setNameTouched(true);
    const note = (notes[m.id] ?? "").trim();
    if (nameErr) return;
    if (decision === "changes_requested" && !note) {
      setNoteTouched((s) => ({ ...s, [m.id]: true }));
      return;
    }
    setBusy(m.id);
    setErrors((s) => ({ ...s, [m.id]: "" }));
    try {
      const res = await fetch(`/api/review/${encodeURIComponent(token)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestoneId: m.id,
          decision,
          actor: name.trim(),
          ...(decision === "changes_requested" ? { note } : {}),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { milestone: { status: MilestoneStatus }; receipt: Receipt };
        setMilestones((list) =>
          list.map((x) =>
            x.id === m.id
              ? {
                  ...x,
                  status: data.milestone.status,
                  decidedBy: name.trim(),
                  note: decision === "changes_requested" ? note : null,
                }
              : x,
          ),
        );
        setReceipts((s) => ({ ...s, [m.id]: data.receipt }));
        setOpen(null);
      } else {
        setErrors((s) => ({ ...s, [m.id]: "" }));
        const msg = await errorMessage(res);
        setErrors((s) => ({ ...s, [m.id]: msg }));
        if (res.status === 409) router.refresh();
      }
    } catch {
      setErrors((s) => ({ ...s, [m.id]: "Something went wrong. Please try again." }));
    } finally {
      setBusy(null);
    }
  }

  if (milestones.length === 0) {
    return (
      <div className="mt-6">
        <EmptyState title="No milestones yet" description="Your agency has not added any milestones to review." />
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="max-w-sm">
        <label htmlFor="reviewer-name" className="block text-sm font-medium text-ink">
          Your name
        </label>
        <input
          id="reviewer-name"
          name="name"
          autoComplete="name"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setNameTouched(true)}
          aria-invalid={nameTouched && !!nameErr}
          aria-describedby={nameTouched && nameErr ? "reviewer-name-err" : undefined}
          className="mt-1 block min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base"
        />
        {nameTouched && nameErr && (
          <p id="reviewer-name-err" className="mt-1 text-sm text-bad">
            {nameErr}
          </p>
        )}
      </div>

      <ol className="mt-6 space-y-3">
        {milestones.map((m) => {
          const pending = m.status === "pending";
          const inFlight = busy === m.id;
          const note = notes[m.id] ?? "";
          const noteErr = noteTouched[m.id] && !note.trim();
          const receipt = receipts[m.id];
          return (
            <li key={m.id}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-semibold text-ink">{m.title}</h2>
                    {m.description && (
                      <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-600">{m.description}</p>
                    )}
                    {m.dueDate && <p className="mt-1 text-xs text-muted">Due {m.dueDate}</p>}
                  </div>
                  <StatusBadge status={m.status} />
                </div>

                {!pending && (
                  <div className="mt-3 border-t border-line pt-3 text-sm text-slate-600">
                    {m.decidedBy && (
                      <p>
                        by <span className="font-medium text-ink">{m.decidedBy}</span>
                      </p>
                    )}
                    {m.note && (
                      <p className="mt-2 whitespace-pre-line break-words rounded-lg bg-warn-soft px-3 py-2 text-warn">
                        “{m.note}”
                      </p>
                    )}
                    {receipt && (
                      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                        Recorded as entry #{receipt.index} <HashText hash={receipt.hash} short />
                      </p>
                    )}
                  </div>
                )}

                {pending && (
                  <div className="mt-4">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={inFlight}
                        onClick={() => submit(m, "approved")}
                        className="min-h-11 w-full rounded-lg bg-ok px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
                      >
                        {inFlight ? "Sending…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={inFlight}
                        aria-expanded={open === m.id}
                        onClick={() => setOpen(open === m.id ? null : m.id)}
                        className="min-h-11 w-full rounded-lg border border-warn bg-surface px-4 text-sm font-semibold text-warn hover:bg-warn-soft disabled:opacity-50 sm:w-auto"
                      >
                        Request changes
                      </button>
                    </div>

                    {open === m.id && (
                      <div className="mt-3">
                        <label htmlFor={`note-${m.id}`} className="block text-sm font-medium text-ink">
                          What needs to change?
                        </label>
                        <textarea
                          id={`note-${m.id}`}
                          rows={3}
                          maxLength={1000}
                          required
                          value={note}
                          disabled={inFlight}
                          onChange={(e) => setNotes((s) => ({ ...s, [m.id]: e.target.value }))}
                          onBlur={() => setNoteTouched((s) => ({ ...s, [m.id]: true }))}
                          aria-invalid={!!noteErr}
                          aria-describedby={noteErr ? `note-err-${m.id}` : undefined}
                          className="mt-1 block w-full rounded-lg border border-line bg-surface px-3 py-2 text-base"
                        />
                        {noteErr && (
                          <p id={`note-err-${m.id}`} className="mt-1 text-sm text-bad">
                            Tell us what needs to change.
                          </p>
                        )}
                        <button
                          type="button"
                          disabled={inFlight || !note.trim()}
                          onClick={() => submit(m, "changes_requested")}
                          className="mt-2 min-h-11 w-full rounded-lg bg-warn px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
                        >
                          {inFlight ? "Sending…" : "Send request"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div role="alert" className="empty:hidden">
                  {errors[m.id] && <p className="mt-3 text-sm text-bad">{errors[m.id]}</p>}
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
