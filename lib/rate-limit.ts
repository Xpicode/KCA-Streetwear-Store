/**
 * Small in-memory rate limiter (fixed window; counts only what you `hit`).
 *
 * Fine for one server process, which is how this app runs (a single Node / Docker instance).
 * If it is ever scaled to several instances behind a load balancer, move the counters to
 * Postgres or Redis — each instance would otherwise keep its own count.
 */
type Bucket = { count: number; resetAt: number };
export type RateRule = { limit: number; windowMs: number };

// kept on globalThis so a dev-server module reload can't reset the counters
const g = globalThis as unknown as { __wsRateBuckets?: Map<string, Bucket> };
const buckets = (g.__wsRateBuckets ??= new Map<string, Bucket>());
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/** Seconds until `key` is allowed again, or 0 while it is under the limit. */
export function retryAfter(key: string, rule: RateRule, now = Date.now()): number {
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now || b.count < rule.limit) return 0;
  return Math.max(1, Math.ceil((b.resetAt - now) / 1000));
}

/** Record one failure against `key`. */
export function hit(key: string, rule: RateRule, now = Date.now()) {
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
  else b.count += 1;
}

/** Forget `key` (e.g. after a successful sign-in). */
export function clear(key: string) {
  buckets.delete(key);
}
