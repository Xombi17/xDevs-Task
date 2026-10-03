// DEMO ONLY. Imported dynamically by the gated tamper route and statically by the seed script.
//
// Drop the UPDATE trigger, alter ONE payload_json, recreate the triggers: all inside a single
// IMMEDIATE transaction on the caller's connection. DDL is transactional in SQLite, so any
// failure (including the trigger-count check at the end) rolls the DROP back too and the
// ledger can never be left unprotected. hash / prev_hash are never touched, which is exactly
// what makes verify report "Broken".
import type { Database } from "better-sqlite3";
import { TRIGGER_NAMES, TRIGGERS_SQL } from "@/lib/db/ddl";
import { notFound } from "@/lib/http/errors";
import { canonicalJson } from "@/lib/ledger/hash";

export function mutatePayload(payloadJson: string): string {
  const parsed: unknown = JSON.parse(payloadJson);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return canonicalJson({ tamperCount: 1 });
  }
  const obj = { ...(parsed as Record<string, unknown>) };
  const first = typeof obj.tamperCount !== "number";
  if (first && typeof obj.decision === "string") {
    obj.decision = obj.decision === "approved" ? "changes_requested" : "approved";
  } else if (first && typeof obj.title === "string") {
    obj.title = `${obj.title} (edited)`;
  }
  obj.tamperCount = (first ? 0 : (obj.tamperCount as number)) + 1;
  return canonicalJson(obj);
}

export function tamperEntry(db: Database, entryId: number) {
  const run = db.transaction(() => {
    // Prepared per call: never cache statements across the DDL change.
    const row = db
      .prepare("SELECT id, project_id, idx, payload_json FROM ledger_entries WHERE id = ?")
      .get(entryId) as { id: number; project_id: string; idx: number; payload_json: string } | undefined;
    if (!row) throw notFound(); // before any DDL

    const countSql = "SELECT COUNT(*) AS c FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'ledger_entries'";
    const before = (db.prepare(countSql).get() as { c: number }).c;

    db.exec(`DROP TRIGGER IF EXISTS ${TRIGGER_NAMES[0]}`);
    const after = mutatePayload(row.payload_json);
    const res = db.prepare("UPDATE ledger_entries SET payload_json = ? WHERE id = ?").run(after, entryId);
    if (res.changes !== 1) throw new Error("tamper: expected to change exactly one row");
    db.exec(TRIGGERS_SQL); // IF NOT EXISTS recreates only the dropped trigger

    const recount = (db.prepare(countSql).get() as { c: number }).c;
    if (recount !== before) throw new Error(`tamper: trigger count changed (${before} -> ${recount}); rolling back`);

    return { entryId: row.id, projectId: row.project_id, index: row.idx, before: row.payload_json, after };
  });
  return run.immediate();
}
