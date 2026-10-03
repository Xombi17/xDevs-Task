import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { getProject } from "@/lib/services/projects";
import { Card } from "@/components/ui/card";
import { CopyLinkButton } from "@/components/ui/copy-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function load(id: string) {
  try {
    return getProject(getDb(), id);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = load(id);
  const pct = project.totalCount > 0 ? Math.round((project.approvedCount / project.totalCount) * 100) : 0;
  const milestones = [...project.milestones].sort((a, b) => a.position - b.position);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="text-sm font-medium text-muted hover:text-accent">
        ← All projects
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{project.title}</h1>
          <p className="mt-1 text-sm text-muted">
            For {project.clientName} · Created {formatDateTime(project.createdAt)}
          </p>
        </div>
        <StatusBadge status={project.status} className="mt-1.5" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div
          role="progressbar"
          aria-label="Approval progress"
          aria-valuemin={0}
          aria-valuemax={project.totalCount}
          aria-valuenow={project.approvedCount}
          className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className={`h-full rounded-full ${project.status === "changes_requested" ? "bg-warn" : "bg-ok"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-medium tabular-nums text-slate-600">
          {project.approvedCount} / {project.totalCount} approved
        </span>
      </div>

      <Card className="mt-6 border-accent/20 bg-accent-soft/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Client review link</h2>
            <p className="mt-0.5 text-sm text-muted">
              Anyone with this link can approve milestones. No login needed, so share it privately.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyLinkButton path={`/review/${project.reviewToken}`} />
            <Link href={`/projects/${id}/audit`} className="btn btn-secondary">
              View audit trail
            </Link>
          </div>
        </div>
      </Card>

      <h2 className="mt-8 text-lg font-semibold">Milestones</h2>
      <ol className="mt-3 space-y-3">
        {milestones.map((m, i) => (
          <li key={m.id}>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono text-xs font-semibold text-slate-600"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="break-words text-base font-semibold text-ink">{m.title}</h3>
                    {m.description && <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-600">{m.description}</p>}
                    {m.dueDate && <p className="mt-1 text-xs text-muted">Due {m.dueDate}</p>}
                  </div>
                </div>
                <StatusBadge status={m.status} />
              </div>
              {m.decidedAt && (
                <div className="mt-3 border-t border-line pt-3 text-sm text-slate-600">
                  <p>
                    {m.status === "approved" ? "Approved" : "Changes requested"} by{" "}
                    <span className="font-medium text-ink">{m.decidedBy}</span> on {formatDateTime(m.decidedAt)}
                  </p>
                  {m.note && (
                    <p className="mt-2 whitespace-pre-line break-words rounded-lg bg-warn-soft px-3 py-2 text-warn">
                      “{m.note}”
                    </p>
                  )}
                </div>
              )}
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
