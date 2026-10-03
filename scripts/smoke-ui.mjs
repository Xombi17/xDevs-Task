// Production-build smoke: seed -> build -> start -> fetch every page -> assert.
// Usage: npm run smoke:ui   (no new dependencies)
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
const ZERO_ID = "00000000-0000-0000-0000-000000000000";

const failures = [];
function check(name, ok, detail = "") {
  if (ok) console.log(`PASS  ${name}`);
  else {
    console.log(`FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
    failures.push(name);
  }
}

// React inserts <!-- --> between adjacent text nodes; drop them so phrases match.
const norm = (html) => html.replace(/<!--.*?-->/g, "");
// Visible markup only: no <script> payloads (RSC flight data), no style blocks.
const withoutScripts = (html) => html.replace(/<script\b[\s\S]*?<\/script>/g, "").replace(/<style\b[\s\S]*?<\/style>/g, "");

async function get(p) {
  const res = await fetch(BASE + p, { redirect: "manual" });
  return { status: res.status, text: await res.text() };
}

function containsAll(name, html, needles) {
  const h = norm(html);
  for (const n of needles) check(`${name} contains "${n}"`, h.includes(n));
}

async function waitReady() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(BASE + "/");
      if (r.status === 200) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not become ready within 60s");
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "signseal-smoke-"));
const env = { ...process.env, DB_PATH: path.join(tmp, "smoke.db") };
let server;

function killServer() {
  if (server?.pid) {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

try {
  for (const [label, args] of [
    ["seed", ["run", "seed"]],
    ["build", ["next", "build"]],
  ]) {
    const cmd = label === "seed" ? "npm" : "npx";
    const r = spawnSync(cmd, args, { env, stdio: "inherit" });
    if (r.status !== 0) throw new Error(`${label} failed with status ${r.status}`);
  }

  server = spawn("npx", ["next", "start", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
  await waitReady();

  const list = await (await fetch(`${BASE}/api/projects`)).json();
  const projects = Array.isArray(list) ? list : list.projects;
  const seeded = projects.find((p) => p.title === "Website Redesign") ?? projects[0];
  const id = seeded.id;
  const detail = await (await fetch(`${BASE}/api/projects/${id}`)).json();
  const token = detail.reviewToken;
  check("seeded project and review token found", !!id && typeof token === "string" && token.length >= 32);

  // Dashboard
  const home = await get("/");
  check("/ returns 200", home.status === 200);
  containsAll("/", home.text, ["SignSeal", "Website Redesign", "2 / 4 approved"]);
  check("/ does not contain the review token anywhere", !home.text.includes(token));

  // New project
  const created = await get("/projects/new");
  check("/projects/new returns 200", created.status === 200);
  containsAll("/projects/new", created.text, ["New project", "Add milestone"]);

  // Project detail
  const proj = await get(`/projects/${id}`);
  check("/projects/:id returns 200", proj.status === 200);
  containsAll("/projects/:id", proj.text, ["Copy client link", "Approved", "Changes requested"]);
  check("/projects/:id token not in visible HTML", !withoutScripts(proj.text).includes(token));
  {
    // The token may only appear inside the copy-link handler data: path "/review/<token>".
    let ok = true;
    let from = 0;
    let count = 0;
    for (;;) {
      const i = proj.text.indexOf(token, from);
      if (i === -1) break;
      count++;
      if (proj.text.slice(Math.max(0, i - 8), i) !== "/review/") ok = false;
      from = i + token.length;
    }
    check("/projects/:id token only appears as the copy-link path", ok, `${count} occurrence(s)`);
  }

  // Audit
  const audit = await get(`/projects/${id}/audit`);
  check("/projects/:id/audit returns 200", audit.status === 200);
  containsAll("/projects/:id/audit", audit.text, ["Verify integrity", "Head hash", "tamper-controls", "#0"]);
  check("/projects/:id/audit does not contain the review token anywhere", !audit.text.includes(token));

  // Review page
  const review = await get(`/review/${token}`);
  check("/review/:token returns 200", review.status === 200);
  containsAll("/review/:token", review.text, ["Your name", "Website Redesign"]);
  check("/review/:token is noindex", /<meta name="robots" content="[^"]*noindex/.test(review.text));
  check("/review/:token sends no referrer", /<meta name="referrer" content="no-referrer"/.test(review.text));
  {
    const visible = withoutScripts(review.text);
    check("/review/:token does not echo the token in text or head", !visible.includes(token));
    check("/review/:token title is generic", /<title>Review milestones[^<]*<\/title>/.test(review.text));
    check("/review/:token has no dangerouslySetInnerHTML", !review.text.includes("dangerouslySetInnerHTML"));
  }

  // Not-found behaviour must be real HTTP 404, not a 200 with a not-found body.
  const badReview = await get("/review/not-a-token");
  check("bad review token returns 404", badReview.status === 404, `got ${badReview.status}`);
  check("bad review token shows neutral message", norm(badReview.text).includes("This review link is not valid"));
  const badProject = await get(`/projects/${ZERO_ID}`);
  check("bad project id returns 404", badProject.status === 404, `got ${badProject.status}`);
  const badAudit = await get(`/projects/${ZERO_ID}/audit`);
  check("bad project id audit returns 404", badAudit.status === 404, `got ${badAudit.status}`);

  // Integrity
  const verify = await (await fetch(`${BASE}/api/projects/${id}/verify`)).json();
  check("verify API reports valid === true", verify.valid === true);
} catch (e) {
  check("smoke run completed", false, String(e?.message ?? e));
} finally {
  killServer();
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll smoke checks passed");
