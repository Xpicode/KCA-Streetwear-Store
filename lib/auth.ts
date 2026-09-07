/**
 * Session auth with no extra packages.
 *  - passwords: scrypt (node:crypto), stored as "scrypt$<salt>$<hash>"
 *  - sessions: HMAC-signed cookie  { kind: "admin" | "customer", id, exp }
 *
 * AUTH_SECRET in .env.local signs the cookie. Change it to log everyone out.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

const COOKIE = "ws_session";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export { hashPassword, verifyPassword } from "./auth-hash";

// ---- session cookie ---------------------------------------------------------
export type SessionKind = "admin";
type Payload = { kind: SessionKind; id: number; exp: number };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set in .env.local");
  return s;
}

function sign(data: string) {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

/** Sign any small JSON payload (must include `exp` as unix seconds) for use in a cookie. */
export function signPayload<T extends { exp: number }>(p: T) {
  const data = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${data}.${sign(data)}`;
}

/** Verify a token from signPayload; null if tampered or expired. */
export function verifyPayload<T extends { exp: number }>(token: string | undefined): T | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString()) as T;
    if (!p.exp || p.exp < Date.now() / 1000) return null;
    return p;
  } catch {
    return null;
  }
}

const encode = (p: Payload) => signPayload(p);
const decode = (token: string | undefined) => verifyPayload<Payload>(token);

export async function createSession(kind: SessionKind, id: number) {
  const jar = await cookies();
  jar.set(COOKIE, encode({ kind, id, exp: Math.floor(Date.now() / 1000) + MAX_AGE }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

async function readSession(): Promise<Payload | null> {
  const jar = await cookies();
  return decode(jar.get(COOKIE)?.value);
}

// ---- current user helpers (cached per request) -------------------------------
export type AdminUser = { id: number; name: string; email: string; role: "owner" | "staff" };

export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const s = await readSession();
  if (!s || s.kind !== "admin") return null;
  const [u] = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.id, s.id))
    .limit(1);
  return u ?? null;
});

/** Use in admin pages/actions. Redirects to login when signed out. */
export async function requireAdmin(opts?: { owner?: boolean }): Promise<AdminUser> {
  const u = await getAdminUser();
  if (!u) redirect("/admin/login");
  if (opts?.owner && u.role !== "owner") redirect("/admin?denied=1");
  return u;
}
