#!/usr/bin/env node
// Standalone SignSeal ledger verifier. Usage:
//   node scripts/verify-chain.mjs export.json [--head <expectedHeadHash>]
// Exit codes: 0 valid, 1 broken/mismatch, 2 usage or unreadable input.
//
// Intentionally a hand-written DUPLICATE of src/lib/ledger/hash.ts so it shares
// no code with the app: an auditor can read and trust this one file alone.
//
// Limit: dropping entries from the TAIL leaves a shorter chain that is still
// internally consistent. Pin the head hash you saw earlier with --head to
// detect that.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const GENESIS = "0".repeat(64);

// Recursively key-sorted, whitespace-free JSON; undefined dropped, null kept.
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("canonicalJson: non-finite number");
    }
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) return "[" + value.map((v) => canonicalJson(v)).join(",") + "]";
  const parts = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort()
    .map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k]));
  return "{" + parts.join(",") + "}";
}

// hash = SHA256( index | timestamp | action | actor | payloadJson | prevHash )
export function preimage(e) {
  return [String(e.index), e.timestamp, e.action, e.actor, e.payloadJson, e.prevHash].join("|");
}

const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

export function verifyExport(doc, { pinnedHead } = {}) {
  const entries = doc.entries;
  const out = [];
  let brokenAt;
  let reason;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const expectedHash = sha256(preimage(e));
    const base = { index: e.index, expectedHash, storedHash: e.hash };
    if (brokenAt !== undefined) {
      out.push({ ...base, status: "untrusted" });
      continue;
    }
    const prev = i === 0 ? GENESIS : entries[i - 1].hash;
    let r;
    if (e.index !== i) r = "index";
    else if (e.prevHash !== prev) r = "prev-link";
    else if (expectedHash !== e.hash) r = "self-hash";
    if (r) {
      brokenAt = i;
      reason = r;
      out.push({ ...base, status: "broken", reason: r });
    } else {
      out.push({ ...base, status: "ok" });
    }
  }
  const headHash = entries.length ? entries[entries.length - 1].hash : GENESIS;
  const length = entries.length;
  let valid = brokenAt === undefined;
  if (valid && doc.headHash !== undefined && doc.headHash !== headHash) {
    valid = false;
    reason = "declared headHash does not match the last entry";
  }
  if (valid && doc.length !== undefined && doc.length !== length) {
    valid = false;
    reason = "declared length does not match the entries";
  }
  if (valid && pinnedHead !== undefined && pinnedHead !== headHash) {
    valid = false;
    reason = "head mismatch (possible truncation)";
  }
  return { valid, brokenAt, reason, entries: out, headHash, length };
}

const USAGE = "Usage: node scripts/verify-chain.mjs <export.json> [--head <expectedHeadHash>]";

function main(argv) {
  const args = argv.slice(2);
  const file = args[0];
  let pinnedHead;
  const hi = args.indexOf("--head");
  if (hi !== -1) pinnedHead = args[hi + 1];
  if (!file || file.startsWith("--") || (hi !== -1 && !pinnedHead)) {
    console.error(USAGE);
    return 2;
  }
  let doc;
  try {
    doc = JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    console.error(`Cannot read ${file}: ${err.message}\n${USAGE}`);
    return 2;
  }
  const ok =
    doc &&
    Array.isArray(doc.entries) &&
    doc.entries.every(
      (e) =>
        e &&
        Number.isInteger(e.index) &&
        ["timestamp", "action", "actor", "payloadJson", "prevHash", "hash"].every((k) => typeof e[k] === "string"),
    );
  if (!ok) {
    console.error(`Invalid export: missing entries or entry fields\n${USAGE}`);
    return 2;
  }
  const r = verifyExport(doc, { pinnedHead });
  if (r.valid) {
    console.log(`VALID  length=${r.length} head=${r.headHash}`);
    return 0;
  }
  if (r.brokenAt !== undefined) {
    console.log(`BROKEN at entry #${r.brokenAt} (${r.reason})`);
    const untrusted = r.entries.filter((e) => e.status === "untrusted").map((e) => e.index);
    if (untrusted.length) console.log(`Untrusted downstream entries: ${untrusted.map((i) => "#" + i).join(", ")}`);
  } else {
    console.log(`INVALID: ${r.reason}`);
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv);
}
