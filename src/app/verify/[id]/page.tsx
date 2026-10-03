import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { getLedger, getVerify } from "@/lib/services/projects";
import { getPublicSummary } from "@/lib/services/public";
import { Card } from "@/components/ui/card";
import { HashText } from "@/components/ui/hash-text";
import { formatDateTime } from "@/lib/format";
import { TamperMap } from "@/app/projects/[id]/audit/tamper-map";
import { BrowserReverify } from "@/app/projects/[id]/audit/browser-reverify";
import { ReceiptCheck } from "./receipt-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public page: no token, no login. Generic title, kept out of indexes and referrers.
export function generateMetadata(): Metadata {
  return {
    title: "Verify audit trail",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

const ACTION_LABEL: Record<string, string> = {
  PROJECT_CREATED: "Project created",
  MILESTONE_APPROVED: "Milestone approved",
  CHANGES_REQUESTED: "Changes requested",
};

// Only getPublicSummary/getLedger/getVerify here: none of them can return the review token.
async function load(id: string) {
  try {
    const db = getDb();
    const project = getPublicSummary(db, id);
    const ledger = await getLedger(db, id);
    const verify = await getVerify(db, id);
    return { project, ledger, verify };
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}

export default async function PublicVerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, ledger, verify } = await load(id);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Public verification</p>
      <h1 className="mt-1 break-words text-2xl font-bold tracking-tight sm:text-3xl">{project.title}</h1>
      <p className="mt-1 text-sm text-muted">
        Anyone with this address can check that the approval history below has not been altered. No login needed.
      </p>

      <div
        role="status"
        className={`mt-6 rounded-xl border px-4 py-3 ${
          verify.valid ? "border-ok/25 bg-ok-soft text-ok" : "border-bad/40 bg-bad-soft text-bad"
        }`}
      >
        {verify.valid ? (
          <>
            <p className="text-lg font-bold">Valid</p>
            <p className="text-sm">{verify.length} {verify.length === 1 ? "entry" : "entries"}, chain intact</p>
          </>
        ) : (
          <>
            <p className="text-lg font-bold">Broken at entry #{verify.brokenAt}</p>
            <p className="text-sm">Entries after #{verify.brokenAt} can no longer be trusted.</p>
          </>
        )}
      </div>

      <Card className="mt-4">
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
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <a href={`/api/verify/${id}/export`} download className="btn btn-secondary">
            Export JSON
          </a>
          <p className="text-xs text-muted">
            Check it offline with <code className="rounded bg-slate-100 px-1 font-mono">node scripts/verify-chain.mjs</code>
          </p>
        </div>
        <BrowserReverify key={`${verify.valid}-${verify.headHash}`} projectId={id} server={verify} />
      </Card>

      <h2 className="mt-8 text-lg font-semibold">Chain integrity</h2>
      <p className="text-xs text-muted">Each entry is recomputed from its contents and linked to the one before it.</p>
      <TamperMap result={verify} />

      <h2 className="mt-8 text-lg font-semibold">Check a receipt</h2>
      <ReceiptCheck
        projectId={id}
        entries={ledger.entries.map((e) => ({ index: e.index, hash: e.hash, actor: e.actor, timestamp: e.timestamp }))}
      />

      <h2 className="mt-8 text-lg font-semibold">Chain</h2>
      <p className="text-xs text-muted">{ledger.length} {ledger.length === 1 ? "entry" : "entries"}, oldest first</p>
      <ol className="mt-4 border-l-2 border-line pl-5">
        {ledger.entries.map((e) => (
          <li key={e.index} id={`entry-${e.index}`} className="relative pb-5 last:pb-0">
            <span
              aria-hidden="true"
              className={`absolute -left-[1.72rem] top-5 size-3 rounded-full ring-4 ring-canvas ${
                e.action === "MILESTONE_APPROVED" ? "bg-ok" : e.action === "CHANGES_REQUESTED" ? "bg-warn" : "bg-accent"
              }`}
            />
            <Card className="scroll-mt-20 target:ring-2 target:ring-accent/40">
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
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex flex-wrap items-center gap-x-2">
                  <dt className="w-10 font-semibold uppercase tracking-wide text-muted">hash</dt>
                  <dd className="min-w-0"><HashText hash={e.hash} copy /></dd>
                </div>
                <div className="flex flex-wrap items-center gap-x-2">
                  <dt className="w-10 font-semibold uppercase tracking-wide text-muted">prev</dt>
                  <dd className="min-w-0"><HashText hash={e.prevHash} copy /></dd>
                </div>
              </dl>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
