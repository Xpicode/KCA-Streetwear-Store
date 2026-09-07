"use server";

import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { productVariants, products, stockBatches, stockMovements, suppliers } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/components/ui/form-message";
import { ADJUST_REASONS, REASON_LABEL, type AdjustReason } from "@/components/admin/stock-reasons";

// ---- stock-in ---------------------------------------------------------------

const lineSchema = z.object({
  variantId: z.coerce.number().int().positive("Pick a product and variant on every line"),
  qty: z.coerce.number().int().min(1, "Quantity must be at least 1 on every line"),
  unitCost: z.coerce.number().min(0, "Unit cost can't be negative").max(99_999_999, "Unit cost is too large"),
});

const stockInSchema = z.object({
  supplierId: z.string().trim(),
  supplierName: z.string().trim().max(120).optional().default(""),
  reference: z
    .string()
    .trim()
    .max(200)
    .transform((s) => (s === "" ? null : s)),
  receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a received date"),
  lines: z.array(lineSchema).min(1, "Add at least one line"),
});

export async function stockIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();

  let lines: unknown = [];
  try {
    const raw = formData.get("lines");
    lines = typeof raw === "string" && raw ? JSON.parse(raw) : [];
  } catch {
    return { error: "The form data was malformed. Reload the page and try again." };
  }

  const parsed = stockInSchema.safeParse({
    supplierId: formData.get("supplierId") ?? "",
    supplierName: formData.get("supplierName") ?? "",
    reference: formData.get("reference") ?? "",
    receivedAt: formData.get("receivedAt") ?? "",
    lines,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (d.supplierId === "new" && d.supplierName.length < 2) return { error: "Enter the new supplier's name." };
  if (d.supplierId !== "" && d.supplierId !== "new" && !/^\d+$/.test(d.supplierId)) return { error: "Pick a supplier." };

  // received date at local noon so the day is stable across timezones
  const [y, m, day] = d.receivedAt.split("-").map(Number);
  const receivedAt = new Date(y, m - 1, day, 12, 0, 0, 0);
  if (Number.isNaN(receivedAt.getTime())) return { error: "Pick a valid received date." };
  if (receivedAt.getTime() > Date.now() + 24 * 3600 * 1000) return { error: "Received date can't be in the future." };

  // every line must point at a variant of an active product
  const variantIds = [...new Set(d.lines.map((l) => l.variantId))];
  const known = await db
    .select({ id: productVariants.id, productId: productVariants.productId, productActive: products.isActive })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(inArray(productVariants.id, variantIds));
  if (known.length !== variantIds.length) return { error: "One of the variants no longer exists. Reload the page and try again." };
  if (known.some((k) => !k.productActive)) return { error: "One of the products is inactive. Activate it before stocking in." };
  const productIds = [...new Set(known.map((k) => k.productId))];

  const batchIds: number[] = [];
  await db.transaction(async (tx) => {
    let supplierId: number | null = null;
    if (d.supplierId === "new") {
      const name = d.supplierName;
      const [existing] = await tx
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(sql`lower(${suppliers.name}) = lower(${name})`)
        .limit(1);
      if (existing) supplierId = existing.id;
      else {
        const [s] = await tx.insert(suppliers).values({ name }).returning({ id: suppliers.id });
        supplierId = s.id;
      }
    } else if (d.supplierId !== "") {
      supplierId = Number(d.supplierId);
      const [s] = await tx.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
      if (!s) throw new Error("Supplier not found");
    }

    for (const line of d.lines) {
      const [batch] = await tx
        .insert(stockBatches)
        .values({
          variantId: line.variantId,
          supplierId,
          qtyReceived: line.qty,
          qtyRemaining: line.qty,
          unitCost: line.unitCost,
          receivedAt,
          reference: d.reference,
        })
        .returning({ id: stockBatches.id });
      await tx.insert(stockMovements).values({
        variantId: line.variantId,
        type: "in",
        qty: line.qty,
        referenceId: batch.id,
        note: d.reference ? `Stock-in · ${d.reference}` : "Stock-in",
        createdBy: user.id,
      });
      await tx
        .update(productVariants)
        .set({ stockOnHand: sql`${productVariants.stockOnHand} + ${line.qty}` })
        .where(eq(productVariants.id, line.variantId));
      batchIds.push(batch.id);
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/stock-in");
  revalidatePath("/shop");
  for (const pid of productIds) revalidatePath(`/admin/products/${pid}`);
  redirect(`/admin/stock-in?received=${batchIds.join(",")}`);
}

// ---- adjustments ------------------------------------------------------------

const adjustSchema = z.object({
  variantId: z.coerce.number().int().positive(),
  qty: z.coerce.number().int().refine((n) => n !== 0, "Enter a quantity other than 0"),
  reason: z.enum(ADJUST_REASONS, { message: "Pick a reason" }),
  note: z
    .string()
    .trim()
    .max(300, "Note is too long")
    .transform((s) => (s === "" ? null : s)),
});

/**
 * Adjust stock on hand for a variant by a signed qty.
 * Inserts a stock_movements row (type `adjust`, or `return` when the reason is a customer return),
 * updates stock_on_hand and, for a negative qty, consumes batch qty_remaining FIFO.
 */
export async function adjustStock(input: { variantId: number; qty: number; reason: AdjustReason; note?: string | null }): Promise<ActionState> {
  const user = await requireAdmin();
  const parsed = adjustSchema.safeParse({ ...input, note: input.note ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { variantId, qty, reason, note } = parsed.data;

  let productId = 0;
  try {
    await db.transaction(async (tx) => {
      const [v] = await tx
        .select({ id: productVariants.id, productId: productVariants.productId, onHand: productVariants.stockOnHand })
        .from(productVariants)
        .where(eq(productVariants.id, variantId))
        .for("update");
      if (!v) throw new Rejected("That variant no longer exists.");
      productId = v.productId;
      if (v.onHand + qty < 0) throw new Rejected(`Only ${v.onHand} on hand — can't remove ${Math.abs(qty)}.`);

      await tx.insert(stockMovements).values({
        variantId,
        type: reason === "return" ? "return" : "adjust",
        qty,
        note: note ? `${REASON_LABEL[reason]} · ${note}` : REASON_LABEL[reason],
        createdBy: user.id,
      });
      await tx
        .update(productVariants)
        .set({ stockOnHand: sql`${productVariants.stockOnHand} + ${qty}` })
        .where(eq(productVariants.id, variantId));

      if (qty < 0) {
        let left = -qty;
        const open = await tx
          .select({ id: stockBatches.id, remaining: stockBatches.qtyRemaining })
          .from(stockBatches)
          .where(and(eq(stockBatches.variantId, variantId), gt(stockBatches.qtyRemaining, 0)))
          .orderBy(asc(stockBatches.receivedAt), asc(stockBatches.id))
          .for("update");
        for (const b of open) {
          if (left <= 0) break;
          const take = Math.min(left, b.remaining);
          await tx.update(stockBatches).set({ qtyRemaining: b.remaining - take }).where(eq(stockBatches.id, b.id));
          left -= take;
        }
      }
    });
  } catch (e) {
    if (e instanceof Rejected) return { error: e.message };
    throw e;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/shop");
  return { ok: true };
}

/** useActionState wrapper for the inline per-variant form on the product page. */
export async function adjustStockForm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const qty = Number(formData.get("qty"));
  const direction = formData.get("direction") === "out" ? -1 : 1;
  const reason = formData.get("reason");
  return adjustStock({
    variantId: Number(formData.get("variantId")),
    qty: Number.isFinite(qty) ? Math.abs(qty) * direction : 0,
    reason: (typeof reason === "string" ? reason : "other") as AdjustReason,
    note: typeof formData.get("note") === "string" ? (formData.get("note") as string) : null,
  });
}

class Rejected extends Error {}
