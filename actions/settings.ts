"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { categories, orders, products, stockMovements, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/auth-hash";
import type { ActionState } from "@/components/ui/form-message";

function revalidateSettings() {
  revalidatePath("/admin/settings");
  revalidatePath("/admin/products");
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// ---- categories ---------------------------------------------------------------

const categorySchema = z.object({
  name: z.string().trim().min(2, "Enter a category name").max(60),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export async function addCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin({ owner: true });
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, sortOrder } = parsed.data;
  const slug = slugify(name);
  if (!slug) return { error: "Use letters or numbers in the category name." };
  const [dup] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, slug)).limit(1);
  if (dup) return { error: `A category with the slug "${slug}" already exists.` };
  await db.insert(categories).values({ name, slug, sortOrder });
  revalidateSettings();
  return { ok: true };
}

const renameSchema = categorySchema.extend({ id: z.coerce.number().int().positive() });

export async function updateCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin({ owner: true });
  const parsed = renameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, name, sortOrder } = parsed.data;
  const slug = slugify(name);
  if (!slug) return { error: "Use letters or numbers in the category name." };
  const [dup] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.slug, slug), ne(categories.id, id)))
    .limit(1);
  if (dup) return { error: `Another category already uses the slug "${slug}".` };
  const [row] = await db.update(categories).set({ name, slug, sortOrder }).where(eq(categories.id, id)).returning({ id: categories.id });
  if (!row) return { error: "Category not found." };
  revalidateSettings();
  return { ok: true };
}

export async function deleteCategory(id: number): Promise<ActionState> {
  await requireAdmin({ owner: true });
  const [{ n }] = await db.select({ n: count() }).from(products).where(eq(products.categoryId, id));
  if (n > 0) return { error: `This category still has ${n} product${n === 1 ? "" : "s"}. Move them first.` };
  await db.delete(categories).where(eq(categories.id, id));
  revalidateSettings();
  return { ok: true };
}

// ---- staff users --------------------------------------------------------------

const staffSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["owner", "staff"]),
  password: z.string().min(6, "Password needs at least 6 characters").max(100),
});

export async function addStaffUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin({ owner: true });
  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, role, password } = parsed.data;
  const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (dup) return { error: "A user with that email already exists." };
  await db.insert(users).values({ name, email, role, passwordHash: hashPassword(password) });
  revalidateSettings();
  return { ok: true };
}

/** Deletes a staff login. Refused when the user is referenced by orders or stock movements. */
export async function deleteStaffUser(id: number): Promise<ActionState> {
  const me = await requireAdmin({ owner: true });
  if (id === me.id) return { error: "You cannot delete your own login." };
  const [[handled], [moved]] = await Promise.all([
    db.select({ n: count() }).from(orders).where(eq(orders.handledBy, id)),
    db.select({ n: count() }).from(stockMovements).where(eq(stockMovements.createdBy, id)),
  ]);
  if (handled.n > 0 || moved.n > 0) {
    return {
      error: `This user handled ${handled.n} order${handled.n === 1 ? "" : "s"} and ${moved.n} stock movement${moved.n === 1 ? "" : "s"}, so the login cannot be deleted. Change their password instead to lock them out.`,
    };
  }
  await db.delete(users).where(eq(users.id, id));
  revalidateSettings();
  return { ok: true };
}

const passwordSchema = z.object({
  id: z.coerce.number().int().positive(),
  password: z.string().min(6, "Password needs at least 6 characters").max(100),
});

export async function setStaffPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin({ owner: true });
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const [row] = await db
    .update(users)
    .set({ passwordHash: hashPassword(parsed.data.password) })
    .where(eq(users.id, parsed.data.id))
    .returning({ id: users.id });
  if (!row) return { error: "User not found." };
  revalidateSettings();
  return { ok: true };
}
