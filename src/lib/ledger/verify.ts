// Pure chain verification. Works in Node and the browser: the SHA-256
// implementation is injected (node:crypto or Web Crypto), nothing is imported
// besides ./hash.
//
// Known limit: truncating the TAIL of a chain cannot be detected from the
// chain alone (a shorter chain is still internally consistent). The head hash
// must be pinned externally (exported/anchored; see README in Phase 5).

import { GENESIS_HASH, preimage } from "./hash";

export type Hasher = (input: string) => string | Promise<string>;

export type StoredEntry = {
  projectId: string;
  index: number;
  timestamp: string;
  action: string;
  actor: string;
  payloadJson: string;
  prevHash: string;
  hash: string;
};

export type EntryStatus = "ok" | "broken" | "untrusted";

export type VerifyResult = {
  valid: boolean;
  headHash: string;
  length: number;
  brokenAt?: number;
  entries: Array<{
    index: number;
    status: EntryStatus;
    expectedHash: string;
    storedHash: string;
    reason?: "index" | "project" | "prev-link" | "self-hash";
  }>;
};

type Reason = NonNullable<VerifyResult["entries"][number]["reason"]>;

// Returns the first failing check for entry e at position i, or undefined.
function firstFailure(
  e: StoredEntry,
  i: number,
  projectId: string,
  prevStored: string,
  expectedHash: string,
): Reason | undefined {
  if (e.index !== i) return "index";
  if (e.projectId !== projectId) return "project";
  if (e.prevHash !== prevStored) return "prev-link";
  if (expectedHash !== e.hash) return "self-hash";
  return undefined;
}

export async function verifyChain(
  projectId: string,
  entries: StoredEntry[],
  sha256Hex: Hasher,
): Promise<VerifyResult> {
  const out: VerifyResult["entries"] = [];
  let brokenAt: number | undefined;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    // Always recompute from STORED fields so the evidence is concrete.
    const expectedHash = await sha256Hex(preimage(e));
    const base = { index: e.index, expectedHash, storedHash: e.hash };

    if (brokenAt !== undefined) {
      out.push({ ...base, status: "untrusted" });
      continue;
    }
    const prevStored = i === 0 ? GENESIS_HASH : entries[i - 1].hash;
    const reason = firstFailure(e, i, projectId, prevStored, expectedHash);
    if (reason) {
      brokenAt = i;
      out.push({ ...base, status: "broken", reason });
    } else {
      out.push({ ...base, status: "ok" });
    }
  }

  return {
    valid: brokenAt === undefined,
    headHash: entries.length ? entries[entries.length - 1].hash : GENESIS_HASH,
    length: entries.length,
    ...(brokenAt !== undefined ? { brokenAt } : {}),
    entries: out,
  };
}
