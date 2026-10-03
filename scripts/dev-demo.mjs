// Starts `next dev` with the tamper demo enabled. DEMO ONLY: never use in production.
import { spawn } from "node:child_process";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to start the tamper demo with NODE_ENV=production.");
  process.exit(1);
}

console.log("Tamper demo ENABLED (DEMO ONLY). Never use in production.");

const child = spawn("npx", ["next", "dev", ...process.argv.slice(2)], {
  env: { ...process.env, ENABLE_TAMPER_DEMO: "true" },
  stdio: "inherit",
});

for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
