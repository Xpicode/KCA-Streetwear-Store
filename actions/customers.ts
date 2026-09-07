"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/auth-hash";
import type { ActionState } from "@/components/ui/form-message";

function revalidateCustomer(id: number) {
  revalidatePath("/admin/customers");
  revalidatePath(`/admin/customers/${id}`);
}

async function setStatus(id: number, status: "approved" | "blocked"): Promise<ActionState> {
  await requireAdmin();
  const [row] = await db.update(customers).set({ status }).where(eq(customers.id, id)).returning({ id: customers.id });
  if (!row) return { error: "Customer not found." };
  revalidateCustomer(id);
  return { ok: true };
}

export async function approveCustomer(id: number): Promise<ActionState> {
  return setStatus(id, "approved");
}

export async function blockCustomer(id: number): Promise<ActionState> {
  return setStatus(id, "blocked");
}

const profileSchema = z.object({
  id: z.coerce.number().int().positive(),
  shopName: z.string().trim().min(2, "Enter the shop name"),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email").or(z.literal("")).optional(),
  address: z.string().trim().max(500).optional(),
  priceGroup: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{1,30}$/, "Price group: letters, numbers and dashes only"),
  status: z.enum(["pending", "approved", "blocked"]),
});

export async function updateCustomer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, shopName, contactName, phone, email, address, priceGroup, status } = parsed.data;

  if (email) {
    const [dup] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.email, email), ne(customers.id, id)))
      .limit(1);
    if (dup) return { error: "Another customer already uses that email." };
  }

  const [row] = await db
    .update(customers)
    .set({
      shopName,
      contactName: contactName || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      priceGroup,
      status,
    })
    .where(eq(customers.id, id))
    .returning({ id: customers.id });
  if (!row) return { error: "Customer not found." };
  revalidateCustomer(id);
  return { ok: true };
}

export type ResetPasswordState = { ok?: boolean; error?: string; password?: string } | null;

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function generatePassword(len = 10) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Owner only. Sets a fresh random password and returns it once so the owner can pass it on. */
export async function resetCustomerPassword(_prev: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  await requireAdmin({ owner: true });
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Customer not found." };
  const password = generatePassword();
  const [row] = await db
    .update(customers)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(customers.id, id))
    .returning({ id: customers.id });
  if (!row) return { error: "Customer not found." };
  revalidateCustomer(id);
  return { ok: true, password };
}
