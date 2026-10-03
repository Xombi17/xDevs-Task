import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { getLedger, getProject } from "@/lib/services/projects";
import { Card } from "@/components/ui/card";
import { HashText } from "@/components/ui/hash-text";
import { formatDateTime } from "@/lib/format";
import { VerifyButton } from "./verify-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  PROJECT_CREATED: "Project created",
  MILESTONE_APPROVED: "Milestone approved",
  CHANGES_REQUESTED: "Changes requested",
};

const ACTION_DOT: Record<string, string> = {
  PROJECT_CREATED: "bg-accent",
  MILESTONE_APPROVED: "bg-ok",
  CHANGES_REQUESTED: "bg-warn",
};

function noteOf(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "note" in payload) {
    const n = (payload as { note?: unknown }).note;
    if (typeof n === "string" && n.trim()) return n;
  }
  return null;
}

async function load(id: string) {
  try {
    const db = getDb();
    const project = getProject(db, id);
    const ledger = await getLedger(db, id);
    return { project, ledger };
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, ledger } = await load(id);

  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const explainContext = {
    entries: ledger.entries.map((e) => {
      const p = (e.payload && typeof e.payload === "object" ? e.payload : {}) as Record<string, unknown>;
      return { index: e.index, action: e.action, milestoneId: str(p.milestoneId), decision: str(p.decision) };
    }),
    milestones: project.milestones.map((m) => ({ id: m.id, title: m.title, status: m.status })),
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/projects/${id}`} className="text-sm font-medium text-muted hover:text-accent">
        ← {project.title}
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Audit trail</h1>
      <p className="mt-1 text-sm text-muted">
        Every decision is chained to the one before it. Entries are numbered from #0 (the genesis entry), the same
        numbering Verify uses.
      </p>

      <Card className="mt-6">
        <dl className="grid gap-4 sm:grid-cols-[auto_1fr] sm:gap-x-10">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Entries</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{ledger.length}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Head hash</dt>
            <dd className="mt-1.5">
              <HashText hash={ledger.headHash} copy />
            </dd>
          </div>
        </dl>
        <div className="mt-5 border-t border-line pt-4">
          <VerifyButton projectId={id} explainContext={explainContext} />
        </div>
      </Card>

      <section data-slot="tamper-controls" aria-label="Tamper demo controls" className="mt-4 empty:hidden">
        {/* PHASE 4 SLOT: tamper button and tamper map render here */}
      </section>

      <h2 className="mt-8 text-lg font-semibold">Timeline</h2>
      <p className="text-xs text-muted">{ledger.length} {ledger.length === 1 ? "entry" : "entries"}, oldest first</p>
      <ol className="mt-4 border-l-2 border-line pl-5">
        {ledger.entries.map((e) => {
          const note = noteOf(e.payload);
          return (
            <li key={e.index} id={`entry-${e.index}`} className="relative pb-5 last:pb-0">
              <span
                aria-hidden="true"
                className={`absolute -left-[1.72rem] top-5 size-3 rounded-full ring-4 ring-canvas ${ACTION_DOT[e.action] ?? "bg-slate-400"}`}
              />
              <Card className="scroll-mt-20">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold">
                    <span className="mr-2 font-mono text-accent">#{e.index}</span>
                    {ACTION_LABEL[e.action] ?? e.action}
                  </h3>
                  <time dateTime={e.timestamp} className="text-xs text-muted">
                    {formatDateTime(e.timestamp)}
                  </time>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  by <span className="font-medium text-ink">{e.actor}</span>
                </p>
                {note && (
                  <p className="mt-2 whitespace-pre-line break-words rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                    “{note}”
                  </p>
                )}
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <dt className="w-10 font-semibold uppercase tracking-wide text-muted">hash</dt>
                    <dd>
                      <HashText hash={e.hash} short copy />
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2">
                    <dt className="w-10 font-semibold uppercase tracking-wide text-muted">prev</dt>
                    <dd>
                      <HashText hash={e.prevHash} short copy />
                    </dd>
                  </div>
                </dl>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
