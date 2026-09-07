/**
 * Session auth with no extra packages.
 *  - passwords: scrypt (node:crypto), stored as "scrypt$<salt>$<hash>"
 *  - sessions: HMAC-signed cookie  { kind: "admin" | "customer", id, exp }
 *
 * AUTH_SECRET in .env.local signs the cookie. Change it to log everyone out.
 */
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { signPayload, verifyPayload } from "./session-token";

const COOKIE = "ws_session"; // proxy.ts checks the same cookie at the edge
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export { hashPassword, verifyPassword } from "./auth-hash";
export { signPayload, verifyPayload } from "./session-token";

// ---- session cookie ---------------------------------------------------------
export type SessionKind = "admin";
type Payload = { kind: SessionKind; id: number; exp: number };

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
