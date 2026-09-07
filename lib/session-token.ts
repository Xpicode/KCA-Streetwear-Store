/**
 * Signed, expiring tokens: HMAC-SHA256 over a base64url JSON payload.
 * Used for the admin session cookie, the remembered-shopper cookie and single-order track links.
 *
 * Plain Node crypto only — no Next imports — so proxy.ts (the edge gate) and scripts can
 * verify tokens without pulling in the database or request helpers.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET must be set in .env.local and be at least 32 characters (see .env.example)");
  }
  return s;
}

function sign(data: string) {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

/** Sign any small JSON payload (must include `exp` as unix seconds). */
export function signPayload<T extends { exp: number }>(p: T) {
  const data = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${data}.${sign(data)}`;
}

/** Verify a token from signPayload; null if missing, tampered or expired. */
export function verifyPayload<T extends { exp: number }>(token: string | null | undefined): T | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString()) as T;
    if (typeof p?.exp !== "number" || p.exp < Date.now() / 1000) return null;
    return p;
  } catch {
    return null;
  }
}
