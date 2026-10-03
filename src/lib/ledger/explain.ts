// Best-effort human explanation of a failed verification. Pure: no Node built-ins and
// no DOM, only types from ./verify, so it runs on the server and in the client.

import type { VerifyResult } from "./verify";

export type EntryContext = { index: number; action: string; milestoneId?: string; decision?: string };
export type MilestoneState = { id: string; title: string; status: string };

export type Explanation = {
  brokenAt: number;
  check: "self-hash" | "prev-link" | "index" | "project";
  headline: string;
  detail: string;
  untrustedNote?: string;
  milestoneNote?: string;
  caveat: string;
};

const LABEL: Record<Explanation["check"], string> = {
  "self-hash": "self-hash",
  "prev-link": "prevHash link",
  index: "index",
  project: "project",
};

const CAVEAT =
  "Best-effort: the ledger stores hashes, not the original values, so it can show that an entry changed but not which field changed or what it said before.";

export function explainFailure(
  result: VerifyResult,
  contexts: EntryContext[],
  milestones: MilestoneState[],
): Explanation | null {
  if (result.valid || result.brokenAt === undefined) return null;
  const n = result.brokenAt;
  const row = result.entries[n];
  const check = row?.reason ?? "self-hash";

  let detail: string;
  switch (check) {
    case "self-hash":
      detail = `The SHA-256 recomputed from entry #${n}'s stored index, timestamp, action, actor, payload and prevHash differs from its stored hash, so a hashed field was changed after the entry was sealed.`;
      break;
    case "prev-link":
      detail = `Entry #${n}'s prevHash does not equal entry #${n - 1}'s stored hash, so the link to the previous entry is broken.`;
      break;
    case "index":
      detail = `Entry #${n} is stored with an index that does not match its position in the chain.`;
      break;
    default:
      detail = `Entry #${n} belongs to a different project than the chain it sits in.`;
  }

  const k = result.entries.filter((e) => e.status === "untrusted").length;
  const untrustedNote = k > 0 ? `${k} later ${k === 1 ? "entry is" : "entries are"} untrusted.` : undefined;

  let milestoneNote: string | undefined;
  const ctx = contexts.find((c) => c.index === n);
  if (ctx?.milestoneId && ctx.decision) {
    const m = milestones.find((x) => x.id === ctx.milestoneId);
    if (m) {
      milestoneNote =
        ctx.decision !== m.status
          ? `Entry #${n} now says ${ctx.decision} for "${m.title}" while the app currently has the milestone as ${m.status}; they disagree.`
          : `The app's milestone state for "${m.title}" (${m.status}) still matches the entry's claim, so only the hash exposes the edit.`;
    }
  }

  return {
    brokenAt: n,
    check,
    headline: `Entry #${n} failed the ${LABEL[check]} check`,
    detail,
    untrustedNote,
    milestoneNote,
    caveat: CAVEAT,
  };
}
