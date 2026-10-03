// End-to-end HTTP smoke against a running SignSeal server (compose service or standalone build).
// Usage: BASE_URL=http://127.0.0.1:3000 npm run smoke:flow
//   EXPECT_TAMPER=disabled (default): POST /api/dev/tamper/1 must return 403 (production service)
//   EXPECT_TAMPER=enabled: the demo profile; a nonexistent id must NOT return 403 (non-destructive)
// Only node built-ins and fetch; no dependencies.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const EXPECT_TAMPER = process.env.EXPECT_TAMPER ?? "disabled";
const here = path.dirname(fileURLToPath(import.meta.url));
const failures = [];

function check(name, ok, detail = "") {
  if (ok) console.log(`PASS  ${name}`);
  else {
    console.log(`FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
    failures.push(name);
  }
}

async function call(method, p, body) {
  const res = await fetch(BASE + p, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, text, json };
}

const created = await call("POST", "/api/projects", {
  title: "Smoke Flow Project",
  clientName: "Smoke Client",
  milestones: [{ title: "One" }, { title: "Two" }, { title: "Three" }],
});
check("create project returns 201", created.status === 201, String(created.status));
const id = created.json?.id;
const token = created.json?.reviewToken;
if (!id || !token) {
  console.log("FAIL  cannot continue without project id and review token");
  process.exit(1);
}

const detail = await call("GET", `/api/projects/${id}`);
check("project detail 200", detail.status === 200);
const mids = detail.json?.milestones?.map((m) => m.id) ?? [];
check("project has 3 milestones", mids.length === 3);

const d1 = await call("POST", `/api/review/${token}/decision`, {
  milestoneId: mids[0],
  decision: "approved",
  actor: "Smoke Client",
});
check("approve milestone 200", d1.status === 200, String(d1.status));
const d2 = await call("POST", `/api/review/${token}/decision`, {
  milestoneId: mids[1],
  decision: "changes_requested",
  actor: "Smoke Client",
  note: "Please revise",
});
check("request changes 200", d2.status === 200, String(d2.status));
const d3 = await call("POST", `/api/review/${token}/decision`, {
  milestoneId: mids[0],
  decision: "approved",
  actor: "Smoke Client",
});
check("second decision on same milestone is 409", d3.status === 409, String(d3.status));

const ledger = await call("GET", `/api/projects/${id}/ledger`);
check("ledger has 3 entries (genesis + 2 decisions)", ledger.json?.entries?.length === 3);

const verify = await call("GET", `/api/projects/${id}/verify`);
check("project verify is valid", verify.status === 200 && verify.json?.valid === true, verify.text.slice(0, 120));

const pub = await call("GET", `/api/verify/${id}`);
check("public verify is valid", pub.status === 200 && pub.json?.valid === true);
check("public verify does not leak the review token", !pub.text.includes(token));

const exp = await call("GET", `/api/verify/${id}/export`);
check("export 200", exp.status === 200);
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "signseal-smoke-")), "export.json");
fs.writeFileSync(tmp, exp.text);
const cli = spawnSync(process.execPath, [path.join(here, "verify-chain.mjs"), tmp], { encoding: "utf8" });
check("scripts/verify-chain.mjs accepts the export (exit 0)", cli.status === 0, (cli.stdout + cli.stderr).trim().slice(0, 160));

const seeded = await call("GET", "/api/projects");
const legacy = seeded.json?.find?.((p) => p.title === "Legacy Audit (tampered)");
check("seeded tampered project present", Boolean(legacy));
if (legacy) {
  const lv = await call("GET", `/api/projects/${legacy.id}/verify`);
  check("seeded tampered project verifies as broken", lv.json?.valid === false, lv.text.slice(0, 120));
}

if (EXPECT_TAMPER === "enabled") {
  const t = await call("POST", "/api/dev/tamper/999999999");
  check("tamper endpoint is NOT 403 in demo mode", t.status !== 403, String(t.status));
} else {
  const t = await call("POST", "/api/dev/tamper/1");
  check("tamper endpoint returns 403", t.status === 403, String(t.status));
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nAll smoke-flow checks passed");
