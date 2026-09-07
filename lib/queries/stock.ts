import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { productVariants, products, stockBatches, suppliers } from "@/db/schema";
import { variantLabel } from "@/lib/queries/product-detail";

export type SupplierOption = { id: number; name: string };

/** Compact catalogue for the stock-in form: active products with their active variants. */
export type PickerVariant = { id: number; label: string; lastCost: number | null };
export type PickerProduct = { id: number; sku: string; name: string; variants: PickerVariant[] };

export async function getSuppliers(): Promise<SupplierOption[]> {
  return db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers).orderBy(suppliers.name);
}

export async function getStockInCatalogue(): Promise<PickerProduct[]> {
  // most recent batch cost per variant
  const lastCost = db
    .select({
      variantId: stockBatches.variantId,
      unitCost: stockBatches.unitCost,
      rn: sql<number>`row_number() over (partition by ${stockBatches.variantId} order by ${stockBatches.receivedAt} desc, ${stockBatches.id} desc)`.as("rn"),
    })
    .from(stockBatches)
    .as("last_cost");

  const rows = await db
    .select({
      productId: products.id,
      sku: products.sku,
      name: products.name,
      variantId: productVariants.id,
      size: productVariants.size,
      color: productVariants.color,
      lastCost: lastCost.unitCost,
    })
    .from(products)
    .innerJoin(productVariants, and(eq(productVariants.productId, products.id), eq(productVariants.isActive, true)))
    .leftJoin(lastCost, and(eq(lastCost.variantId, productVariants.id), eq(lastCost.rn, 1)))
    .where(eq(products.isActive, true))
    .orderBy(products.name, productVariants.size, productVariants.color, productVariants.id);

  const out: PickerProduct[] = [];
  for (const r of rows) {
    let p = out[out.length - 1];
    if (!p || p.id !== r.productId) {
      p = { id: r.productId, sku: r.sku, name: r.name, variants: [] };
      out.push(p);
    }
    p.variants.push({ id: r.variantId, label: variantLabel(r), lastCost: r.lastCost == null ? null : Number(r.lastCost) });
  }
  return out;
}

export type RecentBatch = {
  id: number;
  productId: number;
  productName: string;
  sku: string;
  variantLabel: string;
  supplier: string | null;
  reference: string | null;
  qtyReceived: number;
  qtyRemaining: number;
  unitCost: number;
  receivedAt: Date;
};

export async function getRecentStockIn(limit = 10): Promise<RecentBatch[]> {
  const rows = await db
    .select({
      id: stockBatches.id,
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      size: productVariants.size,
      color: productVariants.color,
      supplier: suppliers.name,
      reference: stockBatches.reference,
      qtyReceived: stockBatches.qtyReceived,
      qtyRemaining: stockBatches.qtyRemaining,
      unitCost: stockBatches.unitCost,
      receivedAt: stockBatches.receivedAt,
    })
    .from(stockBatches)
    .innerJoin(productVariants, eq(stockBatches.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(suppliers, eq(stockBatches.supplierId, suppliers.id))
    .orderBy(desc(stockBatches.receivedAt), desc(stockBatches.id))
    .limit(limit);
  return rows.map(({ size, color, ...r }) => ({ ...r, variantLabel: variantLabel({ size, color }) }));
}

/** Batches just created by a stock-in, for the confirmation panel. */
export async function getBatchesByIds(ids: number[]): Promise<RecentBatch[]> {
  if (!ids.length) return [];
  const rows = await db
    .select({
      id: stockBatches.id,
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      size: productVariants.size,
      color: productVariants.color,
      supplier: suppliers.name,
      reference: stockBatches.reference,
      qtyReceived: stockBatches.qtyReceived,
      qtyRemaining: stockBatches.qtyRemaining,
      unitCost: stockBatches.unitCost,
      receivedAt: stockBatches.receivedAt,
    })
    .from(stockBatches)
    .innerJoin(productVariants, eq(stockBatches.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(suppliers, eq(stockBatches.supplierId, suppliers.id))
    .where(inArray(stockBatches.id, ids))
    .orderBy(stockBatches.id);
  return rows.map(({ size, color, ...r }) => ({ ...r, variantLabel: variantLabel({ size, color }) }));
}

// ---- low stock (for the Stock-in page) ---------------------------------------

export type LowStockLevel = "out" | "low";
export type LowStockRow = {
  variantId: number;
  productId: number;
  productName: string;
  sku: string;
  variantLabel: string;
  stock: number;
  productStock: number;
  reorderLevel: number;
  lastCost: number | null;
  /** out = this variant has 0 on hand; low = the product's total is at/below its reorder level */
  level: LowStockLevel;
};

/**
 * Variants worth restocking: any active variant with 0 on hand, plus every
 * variant of a product whose total stock is at or below its reorder level.
 * Sorted worst first (out of stock, then lowest relative to reorder level).
 */
export async function getLowStock(): Promise<LowStockRow[]> {
  const productStock = db
    .select({
      productId: productVariants.productId,
      total: sql<number>`coalesce(sum(${productVariants.stockOnHand}), 0)`.as("total"),
    })
    .from(productVariants)
    .where(eq(productVariants.isActive, true))
    .groupBy(productVariants.productId)
    .as("product_stock");

  const lastCost = db
    .select({
      variantId: stockBatches.variantId,
      unitCost: stockBatches.unitCost,
      rn: sql<number>`row_number() over (partition by ${stockBatches.variantId} order by ${stockBatches.receivedAt} desc, ${stockBatches.id} desc)`.as("rn"),
    })
    .from(stockBatches)
    .as("low_last_cost");

  const rows = await db
    .select({
      variantId: productVariants.id,
      productId: products.id,
      productName: products.name,
      sku: products.sku,
      size: productVariants.size,
      color: productVariants.color,
      stock: productVariants.stockOnHand,
      productStock: sql<number>`coalesce(${productStock.total}, 0)`.mapWith(Number),
      reorderLevel: products.reorderLevel,
      lastCost: lastCost.unitCost,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(productStock, eq(productStock.productId, products.id))
    .leftJoin(lastCost, and(eq(lastCost.variantId, productVariants.id), eq(lastCost.rn, 1)))
    .where(
      and(
        eq(products.isActive, true),
        eq(productVariants.isActive, true),
        sql`(${productVariants.stockOnHand} <= 0 or coalesce(${productStock.total}, 0) <= ${products.reorderLevel})`
      )
    )
    .orderBy(
      sql`case when ${productVariants.stockOnHand} <= 0 then 0 else 1 end`,
      sql`coalesce(${productStock.total}, 0)::float / nullif(${products.reorderLevel}, 0)`,
      products.name,
      productVariants.size,
      productVariants.color
    );

  return rows.map((r) => ({
    variantId: r.variantId,
    productId: r.productId,
    productName: r.productName,
    sku: r.sku,
    variantLabel: variantLabel(r),
    stock: r.stock,
    productStock: r.productStock,
    reorderLevel: r.reorderLevel,
    lastCost: r.lastCost == null ? null : Number(r.lastCost),
    level: r.stock <= 0 ? "out" : "low",
  }));
}
