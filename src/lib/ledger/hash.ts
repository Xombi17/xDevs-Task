// Pure ledger hashing pieces. NO imports: this file runs unchanged in Node,
// the browser (Web Crypto) and the standalone export verifier.
//
// Formula (locked):
//   hash = SHA256( index | timestamp | action | actor | canonicalJson(payload) | prevHash )

export const GENESIS_HASH = "0".repeat(64);

export const ACTIONS = ["PROJECT_CREATED", "MILESTONE_APPROVED", "CHANGES_REQUESTED"] as const;
export type LedgerAction = (typeof ACTIONS)[number];

// Recursively key-sorted, whitespace-free JSON. Arrays keep their order.
// undefined object values are dropped (like JSON.stringify); null is kept.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("canonicalJson: non-finite number");
    }
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return "[" + value.map((v) => canonicalJson(v)).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const parts = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k]));
  return "{" + parts.join(",") + "}";
}

// "|" is the field delimiter, so it must never appear in the free-text actor.
export function assertValidActor(actor: string): void {
  if (actor.length === 0) throw new Error("actor must not be empty");
  if (actor.includes("|")) throw new Error('actor must not contain "|"');
}

// The one place the hash input is built. payloadJson must already be canonical,
// so exactly the stored string is what gets hashed.
export function preimage(f: {
  index: number;
  timestamp: string;
  action: string;
  actor: string;
  payloadJson: string;
  prevHash: string;
}): string {
  return [String(f.index), f.timestamp, f.action, f.actor, f.payloadJson, f.prevHash].join("|");
}
