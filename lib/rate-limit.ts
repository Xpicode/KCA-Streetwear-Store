/**
 * Failed-attempt rate limiter backed by the database (fixed window; counts only what you `hit`).
 *
 * Counters live in the `login_attempts` table so every server instance shares them — on a
 * serverless host (Vercel) each request may land on a different instance, where in-memory
 * counters would be useless. A handful of tiny rows; expired ones are swept now and then.
 */
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

export type RateRule = { limit: number; windowMs: number };

/** Seconds until `key` is allowed again, or 0 while it is under the limit. */
export async function retryAfter(key: string, rule: RateRule): Promise<number> {
  const [row] = await db.select().from(loginAttempts).where(eq(loginAttempts.key, key)).limit(1);
  if (!row) return 0;
  const now = Date.now();
  const resetAt = row.resetAt.getTime();
  if (resetAt <= now || row.count < rule.limit) return 0;
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

/** Record one failure against `key`; a window that has already ended starts over at 1. */
export async function hit(key: string, rule: RateRule) {
  const resetAt = new Date(Date.now() + rule.windowMs);
  await db
    .insert(loginAttempts)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: loginAttempts.key,
      set: {
        // `excluded` is the row we tried to insert (count 1, fresh reset_at)
        count: sql`case when ${loginAttempts.resetAt} <= now() then 1 else ${loginAttempts.count} + 1 end`,
        resetAt: sql`case when ${loginAttempts.resetAt} <= now() then excluded.reset_at else ${loginAttempts.resetAt} end`,
      },
    });
  if (Math.random() < 0.05) {
    await db.delete(loginAttempts).where(sql`${loginAttempts.resetAt} < now() - interval '1 day'`);
  }
}

/** Forget `key` (e.g. after a successful sign-in). */
export async function clear(key: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.key, key));
}
