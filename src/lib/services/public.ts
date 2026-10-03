import type { Database } from "better-sqlite3";
import { notFound } from "@/lib/http/errors";

// Explicit column list on purpose: the public verify page must never load review_token.
export function getPublicSummary(db: Database, id: string) {
  const row = db.prepare("SELECT id, title, client_name AS clientName FROM projects WHERE id = ?").get(id) as
    | { id: string; title: string; clientName: string }
    | undefined;
  if (!row) throw notFound();
  return { id: row.id, title: row.title, clientName: row.clientName };
}
