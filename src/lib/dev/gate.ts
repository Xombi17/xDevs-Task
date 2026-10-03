// Tamper-demo gate. No DB import: safe to use from server pages as well as the route.
// Evaluated per call (never cached at module load) so tests and env changes take effect.
import { AppError } from "@/lib/http/errors";

export function tamperEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" && env.ENABLE_TAMPER_DEMO === "true";
}

export const TAMPER_DISABLED_MESSAGE =
  "The tamper demo is disabled. Set ENABLE_TAMPER_DEMO=true in .env.local (or run `npm run dev:demo`) " +
  "and restart the dev server. It can never run when NODE_ENV=production (e.g. `next start` or Docker); " +
  'there, the seeded "Legacy Audit (tampered)" project shows the Broken state instead.';

export function tamperDisabledError(): AppError {
  return new AppError(403, "TAMPER_DISABLED", TAMPER_DISABLED_MESSAGE, {
    enable: ["Set ENABLE_TAMPER_DEMO=true in .env.local", "or run `npm run dev:demo`", "then restart the dev server"],
  });
}
