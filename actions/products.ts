"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { categories, orderItems, priceTiers, productVariants, products, stockBatches, stockMovements } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/components/ui/form-message";

// ---- input shapes -----------------------------------------------------------

const optionalText = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .nullable()
  .optional();

const money = z.coerce.number().min(0, "Price can't be negative").max(99_999_999, "Price is too large");

const variantSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  size: optionalText,
  color: optionalText,
  priceOverride: z
    .union([z.literal(""), z.coerce.number().min(0)])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  isActive: z.boolean().optional().default(true),
  /** create only: how many pieces are already on the shelf — becomes the first stock-in */
  initialStock: z.coerce.number().int().min(0, "Starting stock can't be negative").max(1_000_000, "Starting stock is too large").optional().default(0),
});

const tierSchema = z.object({
  minQty: z.coerce.number().int().min(1, "Tier min qty must be at least 1"),
  price: money,
  priceGroup: optionalText,
});

const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name"),
  sku: z.string().trim().min(1, "Enter a SKU").max(40, "SKU is too long"),
  slug: z.string().trim().max(80).optional().default(""),
  categoryId: z
    .union([z.literal(""), z.coerce.number().int().positive()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v)),
  description: optionalText,
  imageUrl: optionalText,
  basePrice: money,
  baseCost: money,
  unit: z.enum(["pc", "dozen", "set"], { message: "Pick a unit" }),
  moq: z.coerce.number().int().min(1, "MOQ must be at least 1"),
  reorderLevel: z.coerce.number().int().min(0, "Reorder level can't be negative"),
  initialStock: z.coerce.number().int().min(0, "Starting stock can't be negative").max(1_000_000, "Starting stock is too large").optional().default(0),
  isActive: z.boolean(),
  variants: z.array(variantSchema),
  tiers: z.array(tierSchema),
});

type VariantInput = z.infer<typeof variantSchema>;
type ProductInput = z.infer<typeof productSchema>;

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function parseJson(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readForm(formData: FormData): { data: ProductInput; newCategory: string | null } | { error: string } {
  const variants = parseJson(formData.get("variants"));
  const tiers = parseJson(formData.get("tiers"));
  if (variants === null || tiers === null) return { error: "The form data was malformed. Reload the page and try again." };

  // "new" in the category select means: create the category typed in newCategory
  const rawCategory = formData.get("categoryId") ?? "";
  const newCategory = rawCategory === "new" ? String(formData.get("newCategory") ?? "").trim() : null;
  if (rawCategory === "new" && (newCategory == null || newCategory.length < 2)) {
    return { error: "Enter the new category's name." };
  }

  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku"),
    slug: formData.get("slug") ?? "",
    categoryId: rawCategory === "new" ? "" : rawCategory,
    description: formData.get("description"),
    imageUrl: formData.get("imageUrl"),
    basePrice: formData.get("basePrice"),
    baseCost: formData.get("baseCost") ?? 0,
    unit: formData.get("unit"),
    moq: formData.get("moq"),
    reorderLevel: formData.get("reorderLevel"),
    initialStock: formData.get("initialStock") ?? 0,
    isActive: formData.get("isActive") === "on",
    variants,
    tiers,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const data = parsed.data;
  data.sku = data.sku.toUpperCase();
  data.slug = data.slug ? slugify(data.slug) : slugify(data.name);
  if (!data.slug) return { error: "Enter a name or a slug that contains letters or numbers." };

  // a product with no options still gets one default variant; the form-level
  // starting stock belongs to it (with variant rows, each row carries its own)
  if (data.variants.length === 0) {
    data.variants = [{ size: null, color: null, priceOverride: null, isActive: true, initialStock: data.initialStock }];
  }

  const seen = new Set<string>();
  for (const v of data.variants) {
    const key = `${v.size ?? ""}|${v.color ?? ""}`;
    if (seen.has(key)) {
      return { error: `Duplicate variant: ${[v.size, v.color].filter(Boolean).join(" / ") || "Default"}. Each size + color pair must be unique.` };
    }
    seen.add(key);
  }
  if (data.variants.length > 1 && data.variants.some((v) => !v.size && !v.color && v.id == null)) {
    return { error: "A blank size + color row can only be used on its own. Remove it or fill it in." };
  }

  const tierKeys = new Set<string>();
  for (const t of data.tiers) {
    const key = `${t.minQty}|${t.priceGroup ?? ""}`;
    if (tierKeys.has(key)) return { error: `Two price tiers start at ${t.minQty} pcs for the same price group.` };
    tierKeys.add(key);
  }

  return { data, newCategory: newCategory || null };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Find a category by name (case-insensitive) or create it. */
async function resolveCategory(tx: Tx, name: string): Promise<number> {
  const slug = slugify(name);
  const [existing] = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(sql`lower(${categories.name}) = lower(${name}) or ${categories.slug} = ${slug}`)
    .limit(1);
  if (existing) return existing.id;
  const [row] = await tx.insert(categories).values({ name, slug: slug || `category-${Date.now()}` }).returning({ id: categories.id });
  return row.id;
}

// ---- product photo upload ---------------------------------------------------

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const UPLOAD_DIR = ["uploads", "products"] as const;

/**
 * If the form carried a photo file, store it under public/uploads/products and
 * return its public URL. Returns { url: null } when no file was chosen.
 */
async function saveUploadedImage(formData: FormData, sku: string): Promise<{ url: string | null } | { error: string }> {
  const file = formData.get("imageFile");
  if (!(file instanceof File) || file.size === 0) return { url: null };
  if (file.size > MAX_IMAGE_BYTES) return { error: "That photo is over 5 MB. Use a smaller image." };
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { error: "Photos must be JPG, PNG, WebP, or GIF." };

  const name = `${slugify(sku) || "product"}-${Date.now()}.${ext}`;
  const dir = path.join(process.cwd(), "public", ...UPLOAD_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return { url: `/${UPLOAD_DIR.join("/")}/${name}` };
}

/** Best-effort delete of a previously uploaded photo (never a pasted external link). */
async function removeUploadedImage(url: string | null | undefined) {
  if (!url || !url.startsWith(`/${UPLOAD_DIR.join("/")}/`)) return;
  const name = path.basename(url);
  try {
    await unlink(path.join(process.cwd(), "public", ...UPLOAD_DIR, name));
  } catch {
    // already gone — fine
  }
}

/** Translate a Postgres unique-violation into a message the owner can act on. */
function uniqueError(e: unknown): string | null {
  const err = e as { code?: string; constraint_name?: string; message?: string };
  if (err?.code !== "23505") return null;
  const c = err.constraint_name ?? "";
  if (c.includes("sku")) return "That SKU is already used by another product.";
  if (c.includes("slug")) return "That slug is already used by another product. Pick a different one.";
  if (c.includes("variants_unique_option")) return "Two variants have the same size and color. Each pair must be unique.";
  return "Something already exists with those details.";
}

// ---- create -----------------------------------------------------------------

export async function createProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const r = readForm(formData);
  if ("error" in r) return { error: r.error };
  const { variants, tiers, initialStock: _unused, ...p } = r.data;

  const up = await saveUploadedImage(formData, p.sku);
  if ("error" in up) return { error: up.error };
  if (up.url) p.imageUrl = up.url;

  let id: number;
  try {
    id = await db.transaction(async (tx) => {
      if (r.newCategory) p.categoryId = await resolveCategory(tx, r.newCategory);
      const [row] = await tx.insert(products).values(p).returning({ id: products.id });
      const inserted = await tx
        .insert(productVariants)
        .values(
          variants.map((v) => ({
            productId: row.id,
            size: v.size ?? null,
            color: v.color ?? null,
            priceOverride: v.priceOverride,
            isActive: v.isActive,
            stockOnHand: v.initialStock,
          }))
        )
        .returning({ id: productVariants.id });

      // starting stock becomes the first stock-in batch at the product's unit cost,
      // so FIFO costing and profit work exactly like a normal stock-in
      for (let i = 0; i < variants.length; i++) {
        const qty = variants[i].initialStock;
        if (!qty) continue;
        const [batch] = await tx
          .insert(stockBatches)
          .values({
            variantId: inserted[i].id,
            qtyReceived: qty,
            qtyRemaining: qty,
            unitCost: p.baseCost,
            reference: "Starting stock",
          })
          .returning({ id: stockBatches.id });
        await tx.insert(stockMovements).values({
          variantId: inserted[i].id,
          type: "in",
          qty,
          referenceId: batch.id,
          note: "Starting stock (added with the product)",
          createdBy: user.id,
        });
      }

      if (tiers.length) {
        await tx.insert(priceTiers).values(tiers.map((t) => ({ productId: row.id, minQty: t.minQty, price: t.price, priceGroup: t.priceGroup ?? null })));
      }
      return row.id;
    });
  } catch (e) {
    await removeUploadedImage(up.url);
    const msg = uniqueError(e);
    if (msg) return { error: msg };
    throw e;
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/stock-in");
  redirect(`/admin/products/${id}`);
}

// ---- update -----------------------------------------------------------------

export async function updateProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Missing product id." };
  const r = readForm(formData);
  if ("error" in r) return { error: r.error };
  const { variants, tiers, initialStock: _unused, ...p } = r.data;

  const up = await saveUploadedImage(formData, p.sku);
  if ("error" in up) return { error: up.error };
  if (up.url) p.imageUrl = up.url;

  let previousImage: string | null = null;
  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: products.id, imageUrl: products.imageUrl }).from(products).where(eq(products.id, id)).limit(1);
      if (!existing) throw new NotFound();
      previousImage = existing.imageUrl;

      if (r.newCategory) p.categoryId = await resolveCategory(tx, r.newCategory);
      await tx.update(products).set(p).where(eq(products.id, id));

      // variants: keep ids that came back, delete the rest if they have no history
      const current = await tx
        .select({
          id: productVariants.id,
          history: sql<number>`
            (select count(*) from ${stockMovements} where ${stockMovements.variantId} = ${productVariants.id})
            + (select count(*) from ${stockBatches} where ${stockBatches.variantId} = ${productVariants.id})
            + (select count(*) from ${orderItems} where ${orderItems.variantId} = ${productVariants.id})`.mapWith(Number),
        })
        .from(productVariants)
        .where(eq(productVariants.productId, id));
      const currentIds = new Set(current.map((c) => c.id));
      const keepIds = variants.map((v) => v.id).filter((x): x is number => typeof x === "number");
      for (const k of keepIds) if (!currentIds.has(k)) throw new Rejected("A variant in the form no longer exists. Reload and try again.");

      const toDelete = current.filter((c) => !keepIds.includes(c.id));
      const blocked = toDelete.filter((c) => c.history > 0);
      if (blocked.length) throw new Rejected("A variant with stock history can't be deleted — deactivate it instead.");
      if (toDelete.length) {
        await tx.delete(productVariants).where(and(eq(productVariants.productId, id), notInArray(productVariants.id, keepIds.length ? keepIds : [-1])));
      }

      // Updates can swap size/color between rows, so clear keys first to avoid a transient collision.
      const updates = variants.filter((v): v is VariantInput & { id: number } => typeof v.id === "number");
      if (updates.length) {
        await tx
          .update(productVariants)
          .set({ size: sql`'~pending-' || ${productVariants.id}::text`, color: sql`null` })
          .where(inArray(productVariants.id, updates.map((u) => u.id)));
        for (const v of updates) {
          await tx
            .update(productVariants)
            .set({ size: v.size ?? null, color: v.color ?? null, priceOverride: v.priceOverride, isActive: v.isActive })
            .where(eq(productVariants.id, v.id));
        }
      }
      const inserts = variants.filter((v) => typeof v.id !== "number");
      if (inserts.length) {
        await tx.insert(productVariants).values(
          inserts.map((v) => ({ productId: id, size: v.size ?? null, color: v.color ?? null, priceOverride: v.priceOverride, isActive: v.isActive }))
        );
      }

      // tiers have no history: replace wholesale
      await tx.delete(priceTiers).where(eq(priceTiers.productId, id));
      if (tiers.length) {
        await tx.insert(priceTiers).values(tiers.map((t) => ({ productId: id, minQty: t.minQty, price: t.price, priceGroup: t.priceGroup ?? null })));
      }
    });
  } catch (e) {
    await removeUploadedImage(up.url);
    if (e instanceof NotFound) return { error: "This product no longer exists." };
    if (e instanceof Rejected) return { error: e.message };
    const msg = uniqueError(e);
    if (msg) return { error: msg };
    throw e;
  }

  // the save went through — clean up the photo this update replaced or removed
  if (previousImage && previousImage !== p.imageUrl) await removeUploadedImage(previousImage);

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${id}`);
  revalidatePath(`/admin/products/${id}/edit`);
  revalidatePath("/admin/stock-in");
  revalidatePath("/shop");
  redirect(`/admin/products/${id}`);
}

class NotFound extends Error {}
class Rejected extends Error {}
