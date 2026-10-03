// Basic in-memory sliding-window limiter (API-02). Per-process only, by design.
const hits = new Map<string, number[]>();

export type RateConfig = { max: number; windowMs: number };

export function rateLimit(key: string, { max, windowMs }: RateConfig): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfterSec: 0 };
}

export function resetRateLimit(): void {
  hits.clear();
}

export function decisionLimit(): RateConfig {
  return {
    max: Number(process.env.RATE_LIMIT_MAX) || 20,
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  };
}
