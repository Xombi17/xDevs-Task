import type { Database } from "better-sqlite3";
import { tamperEntry } from "@/lib/dev/tamper"; // seed/CLI + tests only, never imported by app routes
import { createProject } from "@/lib/services/projects";
import { decide } from "@/lib/services/review";

const TITLE = "Website Redesign";

const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

// Idempotent demo seed. Goes only through createProject/decide so every
// ledger row comes from the real append path (T-02-12).
export function seedDemo(db: Database): { created: boolean; projectId: string; reviewToken?: string } {
  const existing = db.prepare("SELECT id FROM projects WHERE title = ?").get(TITLE) as { id: string } | undefined;
  if (existing) return { created: false, projectId: existing.id };

  const project = createProject(db, {
    title: TITLE,
    clientName: "Acme Studio",
    milestones: [
      { title: "Discovery & Brief", description: "Stakeholder interviews and a signed-off project brief.", dueDate: daysFromNow(7) },
      { title: "Design Mockups", description: "High-fidelity mockups for the key pages.", dueDate: daysFromNow(21) },
      { title: "Frontend Build", description: "Responsive implementation of the approved designs.", dueDate: daysFromNow(45) },
      { title: "Launch", description: "Deploy to production and hand over.", dueDate: daysFromNow(60) },
    ],
  });

  const token = project.reviewToken;
  const [m1, m2, m3] = project.milestones;
  decide(db, token, { milestoneId: m1.id, decision: "approved", actor: "Jane Doe" });
  decide(db, token, { milestoneId: m2.id, decision: "approved", actor: "Jane Doe" });
  decide(db, token, {
    milestoneId: m3.id,
    decision: "changes_requested",
    actor: "Jane Doe",
    note: "Please make the navigation more prominent on mobile.",
  });

  return { created: true, projectId: project.id, reviewToken: token };
}

const TAMPERED_TITLE = "Legacy Audit (tampered)";

// Pre-tampered project so Broken is visible in any run mode (incl. production/Docker).
// Built via createProject/decide, then entry idx 2 is altered with the tamper helper.
export function seedTampered(db: Database): { created: boolean; projectId: string } {
  const existing = db.prepare("SELECT id FROM projects WHERE title = ?").get(TAMPERED_TITLE) as { id: string } | undefined;
  if (existing) return { created: false, projectId: existing.id };

  const project = createProject(db, {
    title: TAMPERED_TITLE,
    clientName: "Globex Corp",
    milestones: [
      { title: "Audit Scope", description: "Agree the scope of the audit." },
      { title: "Findings Report", description: "Deliver the written findings." },
      { title: "Remediation Plan", description: "Plan to address the findings." },
    ],
  });
  const token = project.reviewToken;
  const [m1, m2, m3] = project.milestones;
  decide(db, token, { milestoneId: m1.id, decision: "approved", actor: "Jane Doe" });
  decide(db, token, { milestoneId: m2.id, decision: "approved", actor: "Jane Doe" });
  decide(db, token, { milestoneId: m3.id, decision: "changes_requested", actor: "Jane Doe", note: "Needs a clearer timeline." });

  const row = db.prepare("SELECT id FROM ledger_entries WHERE project_id = ? AND idx = 2").get(project.id) as { id: number };
  tamperEntry(db, row.id);
  return { created: true, projectId: project.id };
}
