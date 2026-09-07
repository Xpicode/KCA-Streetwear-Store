"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import { clear, hit, retryAfter } from "@/lib/rate-limit";
import type { ActionState } from "@/components/ui/form-message";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

/**
 * Brute-force protection. Only failed attempts count. The per-email rule is the real
 * defence (an attacker can't dodge it by changing address); the per-IP rule caps
 * spraying many emails from one place. x-forwarded-for is only meaningful behind your
 * own reverse proxy — treat the IP rule as a bonus, not a guarantee.
 */
const EMAIL_RULE = { limit: 5, windowMs: 15 * 60_000 };
const IP_RULE = { limit: 30, windowMs: 15 * 60_000 };

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

function waitMessage(seconds: number) {
  const mins = Math.ceil(seconds / 60);
  return `Too many sign-in attempts. Try again in ${mins} ${mins === 1 ? "minute" : "minutes"}.`;
}

export async function adminLogin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const emailKey = `login:email:${parsed.data.email}`;
  const ipKey = `login:ip:${await clientIp()}`;
  const wait = Math.max(retryAfter(emailKey, EMAIL_RULE), retryAfter(ipKey, IP_RULE));
  if (wait > 0) return { error: waitMessage(wait) };

  const [u] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!u || !verifyPassword(parsed.data.password, u.passwordHash)) {
    hit(emailKey, EMAIL_RULE);
    hit(ipKey, IP_RULE);
    return { error: "Wrong email or password." };
  }

  clear(emailKey);
  await createSession("admin", u.id);
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}
