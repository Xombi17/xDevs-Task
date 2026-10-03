// Test fixture: run as a separate OS process to create real write contention.
// usage: node --import tsx append-worker.fixture.ts <dbPath> <projectId> <count> <tag>
import { openDb } from "@/lib/db";
import { append } from "@/lib/ledger/append";

const [dbPath, projectId, count, tag] = process.argv.slice(2);
const db = openDb(dbPath);
for (let i = 0; i < Number(count); i++) {
  append(db, {
    projectId,
    action: "MILESTONE_APPROVED",
    actor: `worker-${tag}`,
    payload: { tag, i },
  });
}
db.close();
