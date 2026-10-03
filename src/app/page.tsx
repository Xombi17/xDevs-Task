import Link from "next/link";
import { getDb } from "@/lib/db";
import { listProjects } from "@/lib/services/projects";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, plural } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Dashboard() {
  const projects = listProjects(getDb());

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Projects</h1>
          <p className="mt-1 text-sm text-muted">
            {projects.length > 0
              ? `${plural(projects.length, "project")}, newest first`
              : "Client approvals, sealed in a verifiable ledger."}
          </p>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No projects yet"
            description="Create a project with milestones, share the private review link, and every decision is sealed into a tamper-evident trail."
            action={
              <Link href="/projects/new" className="btn btn-primary">
                Create your first project
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {projects.map((p) => {
            const pct = p.totalCount > 0 ? Math.round((p.approvedCount / p.totalCount) * 100) : 0;
            return (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="group block rounded-xl transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <Card className="transition-shadow group-hover:shadow-lift group-hover:border-accent/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-semibold text-ink group-hover:text-accent">{p.title}</h2>
                        <p className="mt-0.5 truncate text-sm text-muted">{p.clientName}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <div
                        role="progressbar"
                        aria-label={`${p.title} approval progress`}
                        aria-valuemin={0}
                        aria-valuemax={p.totalCount}
                        aria-valuenow={p.approvedCount}
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"
                      >
                        <div
                          className={`h-full rounded-full ${p.status === "changes_requested" ? "bg-warn" : "bg-ok"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium tabular-nums text-slate-600">
                        {p.approvedCount} / {p.totalCount} approved
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted">Created {formatDateTime(p.createdAt)}</p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
