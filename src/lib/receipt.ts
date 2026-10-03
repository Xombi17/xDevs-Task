// Pure helpers, safe on server and client. A receipt is a convenience copy of one
// chain entry; checking it proves the entry exists, not who the actor really was.

export const RECEIPT_FORMAT = "signseal-receipt/v1" as const;

export type ReceiptInput = {
  projectId: string;
  index: number;
  hash: string;
  actor: string;
  timestamp: string;
  action: string;
};

export type Receipt = ReceiptInput & { format: typeof RECEIPT_FORMAT; verifyPath: string };

export type ChainEntry = { index: number; hash: string; actor: string; timestamp: string };

export type ReceiptCheck = { match: true; index: number } | { match: false; reason: string };

export function buildReceipt(r: ReceiptInput): Receipt {
  return {
    format: RECEIPT_FORMAT,
    projectId: r.projectId,
    index: r.index,
    hash: r.hash,
    actor: r.actor,
    timestamp: r.timestamp,
    action: r.action,
    verifyPath: `/verify/${r.projectId}`,
  };
}

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

export function checkReceipt(input: unknown, entries: ChainEntry[], projectId: string): ReceiptCheck {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { match: false, reason: "That is not a receipt object." };
  }
  const r = input as Record<string, unknown>;
  if (r.format !== RECEIPT_FORMAT) return { match: false, reason: `Unsupported format (expected ${RECEIPT_FORMAT}).` };
  if (typeof r.index !== "number" || !Number.isInteger(r.index) || r.index < 0) {
    return { match: false, reason: "The receipt has no valid entry number." };
  }
  if (!isStr(r.hash) || !isStr(r.actor) || !isStr(r.timestamp) || !isStr(r.projectId)) {
    return { match: false, reason: "The receipt is missing hash, actor, timestamp or project." };
  }
  if (r.projectId !== projectId) return { match: false, reason: "The receipt belongs to a different project." };
  const e = entries.find((x) => x.index === r.index);
  if (!e) return { match: false, reason: `There is no entry #${r.index} in this chain.` };
  if (e.hash !== r.hash) return { match: false, reason: `The hash differs from entry #${r.index}.` };
  if (e.actor !== r.actor) return { match: false, reason: `The actor differs from entry #${r.index}.` };
  if (e.timestamp !== r.timestamp) return { match: false, reason: `The timestamp differs from entry #${r.index}.` };
  return { match: true, index: e.index };
}
