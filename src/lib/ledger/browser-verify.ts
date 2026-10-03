// Browser re-verification. It runs the SAME verifyChain as the server, but with
// Web Crypto (crypto.subtle) as the SHA-256 implementation. Agreement shows two
// SHA-256 implementations produce identical results; it is not an independent
// verifier (the standalone script is). No Node built-in imports.

import { verifyChain, type Hasher, type StoredEntry, type VerifyResult } from "./verify";

export type LedgerEntryDto = {
  index: number;
  timestamp: string;
  action: string;
  actor: string;
  payloadJson: string;
  prevHash: string;
  hash: string;
};

export type BrowserVerifyOutcome =
  | { kind: "unavailable"; message: string }
  | { kind: "done"; result: VerifyResult; agrees: boolean; differences: string[] };

type CryptoLike = { subtle?: { digest?: (alg: string, data: BufferSource) => Promise<ArrayBuffer> } } | undefined | null;

export function getWebCryptoHasher(c: CryptoLike = globalThis.crypto): Hasher | null {
  const digest = c?.subtle?.digest;
  if (!c || !c.subtle || typeof digest !== "function") return null;
  const subtle = c.subtle;
  return async (input: string) => {
    const buf = await subtle.digest!("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  };
}

export function compareVerify(server: VerifyResult, browser: VerifyResult): { agrees: boolean; differences: string[] } {
  const d: string[] = [];
  if (server.valid !== browser.valid) d.push(`valid: server ${server.valid}, browser ${browser.valid}`);
  if (server.brokenAt !== browser.brokenAt) d.push(`brokenAt: server ${server.brokenAt ?? "none"}, browser ${browser.brokenAt ?? "none"}`);
  if (server.headHash !== browser.headHash) d.push("head hash differs");
  if (server.length !== browser.length) d.push(`length: server ${server.length}, browser ${browser.length}`);
  const n = Math.max(server.entries.length, browser.entries.length);
  for (let i = 0; i < n; i++) {
    const s = server.entries[i];
    const b = browser.entries[i];
    if (!s || !b) {
      d.push(`entry #${i} missing on ${s ? "browser" : "server"}`);
    } else if (s.status !== b.status) {
      d.push(`entry #${i} status: server ${s.status}, browser ${b.status}`);
    } else if (s.expectedHash !== b.expectedHash) {
      d.push(`entry #${i} expected hash differs`);
    }
  }
  return { agrees: d.length === 0, differences: d };
}

export async function runBrowserVerify(
  projectId: string,
  ledgerEntries: LedgerEntryDto[],
  server: VerifyResult,
  crypto: CryptoLike = globalThis.crypto,
): Promise<BrowserVerifyOutcome> {
  const hasher = getWebCryptoHasher(crypto);
  if (!hasher) {
    return {
      kind: "unavailable",
      message:
        "Web Crypto is not available in this browser context. It needs a secure context (HTTPS or localhost). The server verification result still applies.",
    };
  }
  try {
    const entries: StoredEntry[] = ledgerEntries.map((e) => ({
      projectId,
      index: e.index,
      timestamp: e.timestamp,
      action: e.action,
      actor: e.actor,
      payloadJson: e.payloadJson,
      prevHash: e.prevHash,
      hash: e.hash,
    }));
    const result = await verifyChain(projectId, entries, hasher);
    return { kind: "done", result, ...compareVerify(server, result) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { kind: "unavailable", message: `Web Crypto failed (${msg}). The server verification result still applies.` };
  }
}
