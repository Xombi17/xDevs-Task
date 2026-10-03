"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createProjectSchema } from "@/lib/services/schemas";

const MIN_MILESTONES = 3;
const MAX_MILESTONES = 20;

type Row = { key: number; title: string; description: string; dueDate: string };
type Errors = Record<string, string>;

const input =
  "mt-1 block w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink shadow-sm placeholder:text-slate-400 focus-visible:outline-2 aria-[invalid=true]:border-bad";
const okBorder = "border-line";
const label = "block text-sm font-medium text-ink";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs font-medium text-bad">
      {message}
    </p>
  );
}

export function NewProjectForm() {
  const router = useRouter();
  const uid = useId();
  const nextKey = useRef(MIN_MILESTONES);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: MIN_MILESTONES }, (_, key) => ({ key, title: "", description: "", dueDate: "" })),
  );
  const [errors, setErrors] = useState<Errors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addRow = () => {
    if (rows.length >= MAX_MILESTONES) return;
    setRows((rs) => [...rs, { key: nextKey.current++, title: "", description: "", dueDate: "" }]);
  };
  const removeRow = (key: number) => {
    if (rows.length <= MIN_MILESTONES) return;
    setRows((rs) => rs.filter((r) => r.key !== key));
    setErrors({});
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setServerError(null);

    // Optional fields are dropped when empty: the schema is strict.
    const payload = {
      title,
      clientName,
      milestones: rows.map((r) => {
        const m: { title: string; description?: string; dueDate?: string } = { title: r.title };
        if (r.description.trim()) m.description = r.description.trim();
        if (r.dueDate) m.dueDate = r.dueDate;
        return m;
      }),
    };

    // Client validation is UX only; the server re-validates (422 handled below).
    const parsed = createProjectSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const p = issue.path.join(".");
        if (!(p in next)) next[p] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.ok) {
        const created = (await res.json()) as { id: string };
        router.push(`/projects/${created.id}`);
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string; details?: { path: string; message: string }[] };
      } | null;
      if (res.status === 422 && Array.isArray(body?.error?.details)) {
        const next: Errors = {};
        for (const d of body.error.details) if (!(d.path in next)) next[d.path] = d.message;
        setErrors(next);
        setServerError("Please fix the highlighted fields.");
      } else {
        setServerError(body?.error?.message ?? "Something went wrong. Please try again.");
      }
    } catch {
      setServerError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const err = (path: string) => errors[path];
  const cls = (path: string) => `${input} ${err(path) ? "" : okBorder}`;
  const canRemove = rows.length > MIN_MILESTONES;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-title`} className={label}>
            Project title
          </label>
          <input
            id={`${uid}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Brand website redesign"
            autoComplete="off"
            aria-invalid={!!err("title")}
            aria-describedby={err("title") ? `${uid}-title-err` : undefined}
            className={cls("title")}
          />
          <FieldError id={`${uid}-title-err`} message={err("title")} />
        </div>
        <div>
          <label htmlFor={`${uid}-client`} className={label}>
            Client name
          </label>
          <input
            id={`${uid}-client`}
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            maxLength={120}
            placeholder="Acme Studio"
            autoComplete="off"
            aria-invalid={!!err("clientName")}
            aria-describedby={err("clientName") ? `${uid}-client-err` : undefined}
            className={cls("clientName")}
          />
          <FieldError id={`${uid}-client-err`} message={err("clientName")} />
        </div>
      </div>

      <fieldset className="min-w-0">
        <legend className="flex w-full items-baseline justify-between gap-3">
          <span className="text-base font-semibold text-ink">Milestones</span>
          <span className="text-xs text-muted">
            {rows.length} / {MAX_MILESTONES}
          </span>
        </legend>
        <p id={`${uid}-min`} className="mt-0.5 text-xs text-muted">
          At least {MIN_MILESTONES} milestones
        </p>
        {err("milestones") && <FieldError id={`${uid}-ms-err`} message={err("milestones")} />}

        <ol className="mt-3 space-y-3">
          {rows.map((r, i) => {
            const base = `milestones.${i}`;
            const tId = `${uid}-m${r.key}-title`;
            const dId = `${uid}-m${r.key}-desc`;
            const dtId = `${uid}-m${r.key}-date`;
            return (
              <li key={r.key} className="rounded-lg border border-line bg-canvas/60 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-semibold text-accent">Milestone {i + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeRow(r.key)}
                    disabled={!canRemove}
                    aria-describedby={canRemove ? undefined : `${uid}-min`}
                    aria-label={`Remove milestone ${i + 1}`}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-bad-soft hover:text-bad disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-2 space-y-3">
                  <div>
                    <label htmlFor={tId} className={label}>
                      Title
                    </label>
                    <input
                      id={tId}
                      value={r.title}
                      onChange={(e) => update(r.key, { title: e.target.value })}
                      maxLength={120}
                      placeholder="Homepage design"
                      autoComplete="off"
                      aria-invalid={!!err(`${base}.title`)}
                      aria-describedby={err(`${base}.title`) ? `${tId}-err` : undefined}
                      className={cls(`${base}.title`)}
                    />
                    <FieldError id={`${tId}-err`} message={err(`${base}.title`)} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                    <div>
                      <label htmlFor={dId} className={label}>
                        Description <span className="font-normal text-muted">(optional)</span>
                      </label>
                      <textarea
                        id={dId}
                        value={r.description}
                        onChange={(e) => update(r.key, { description: e.target.value })}
                        maxLength={1000}
                        rows={2}
                        aria-invalid={!!err(`${base}.description`)}
                        aria-describedby={err(`${base}.description`) ? `${dId}-err` : undefined}
                        className={cls(`${base}.description`)}
                      />
                      <FieldError id={`${dId}-err`} message={err(`${base}.description`)} />
                    </div>
                    <div>
                      <label htmlFor={dtId} className={label}>
                        Due date <span className="font-normal text-muted">(optional)</span>
                      </label>
                      <input
                        id={dtId}
                        type="date"
                        value={r.dueDate}
                        onChange={(e) => update(r.key, { dueDate: e.target.value })}
                        aria-invalid={!!err(`${base}.dueDate`)}
                        aria-describedby={err(`${base}.dueDate`) ? `${dtId}-err` : undefined}
                        className={cls(`${base}.dueDate`)}
                      />
                      <FieldError id={`${dtId}-err`} message={err(`${base}.dueDate`)} />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= MAX_MILESTONES}
          className="btn btn-secondary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Add milestone
        </button>
      </fieldset>

      {serverError && (
        <div role="alert" className="rounded-lg border border-bad/25 bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
          {serverError}
        </div>
      )}

      <div className="flex justify-end border-t border-line pt-4">
        <button type="submit" disabled={submitting} className="btn btn-primary w-full disabled:opacity-60 sm:w-auto">
          {submitting ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}
