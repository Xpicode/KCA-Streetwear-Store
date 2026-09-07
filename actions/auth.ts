"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, verifyPassword } from "@/lib/auth";
import type { ActionState } from "@/components/ui/form-message";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export async function adminLogin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const [u] = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (!u || !verifyPassword(parsed.data.password, u.passwordHash)) return { error: "Wrong email or password." };
  await createSession("admin", u.id);
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}
