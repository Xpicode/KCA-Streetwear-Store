import { and, between, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  orderItems,
  orders,
  priceTiers,
  productVariants,
  products,
  stockBatches,
  stockMovements,
  suppliers,
  users,
} from "@/db/schema";
import { periodRange, type Period } from "@/lib/profit";
import type { Bucket } from "@/lib/queries/dashboard";

export type VariantRow = {
  id: number;
  size: string | null;
  color: string | null;
  skuSuffix: string | null;
  priceOverride: number | null;
  stockOnHand: number;
  stockReserved: number;
  isActive: boolean;
  /** true when the variant has movements, batches or order lines — it can be deactivated but not deleted */
  locked: boolean;
};

export type TierRow = { id: number; minQty: number; price: number; priceGroup: string | null };

export type BatchRow = {
  id: number;
  variantId: number;
  variantLabel: string;
  supplier: string | null;
  reference: string | null;
  qtyReceived: number;
  qtyRemaining: number;
  unitCost: number;
  receivedAt: Date;
};

export type MovementRow = {
  id: number;
  variantLabel: string;
  type: "in" | "sale" | "adjust" | "return";
  qty: number;
  note: string | null;
  by: string | null;
  createdAt: Date;
};

export type ProductDetail = {
  id: number;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  retailPrice: number | null;
  baseCost: number;
  unit: string;
  moq: number;
  reorderLevel: number;
  isActive: boolean;
  categoryId: number | null;
  category: string | null;
  createdAt: Date;
  /** weighted-average unit cost of open batches (qty_remaining > 0) */
  avgCost: number;
  stockOnHand: number;
  stockReserved: number;
  variants: VariantRow[];
  tiers: TierRow[];
  batches: BatchRow[];
  movements: MovementRow[];
};

export function variantLabel(v: { size: string | null; color: string | null }) {
  const parts = [v.size, v.color].filter(Boolean);
  return parts.length ? parts.join(" / ") : "Default";
}

export async function getProductDetail(id: number): Promise<ProductDetail | null> {
  const [p] = await db
    .select({
      id: products.id,
      sku: products.sku,
      slug: products.slug,
      name: products.name,
      description: products.description,
      imageUrl: products.imageUrl,
      basePrice: products.basePrice,
      retailPrice: products.retailPrice,
      baseCost: products.baseCost,
      unit: products.unit,
      moq: products.moq,
      reorderLevel: products.reorderLevel,
      isActive: products.isActive,
      categoryId: products.categoryId,
      category: categories.name,
      createdAt: products.createdAt,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.id, id))
    .limit(1);
  if (!p) return null;

  const variantIds = db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, id));

  const [variantRows, tiers, batches, movements, [cost]] = await Promise.all([
    db
      .select({
        id: productVariants.id,
        size: productVariants.size,
        color: productVariants.color,
        skuSuffix: productVariants.skuSuffix,
        priceOverride: productVariants.priceOverride,
        stockOnHand: productVariants.stockOnHand,
        stockReserved: productVariants.stockReserved,
        isActive: productVariants.isActive,
        movements: sql<number>`(select count(*) from ${stockMovements} where ${stockMovements.variantId} = ${productVariants.id})`.mapWith(Number),
        batches: sql<number>`(select count(*) from ${stockBatches} where ${stockBatches.variantId} = ${productVariants.id})`.mapWith(Number),
        lines: sql<number>`(select count(*) from ${orderItems} where ${orderItems.variantId} = ${productVariants.id})`.mapWith(Number),
      })
      .from(productVariants)
      .where(eq(productVariants.productId, id))
      .orderBy(productVariants.size, productVariants.color, productVariants.id),
    db
      .select({ id: priceTiers.id, minQty: priceTiers.minQty, price: priceTiers.price, priceGroup: priceTiers.priceGroup })
      .from(priceTiers)
      .where(eq(priceTiers.productId, id))
      .orderBy(priceTiers.priceGroup, priceTiers.minQty),
    db
      .select({
        id: stockBatches.id,
        variantId: stockBatches.variantId,
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
      .leftJoin(suppliers, eq(stockBatches.supplierId, suppliers.id))
      .where(inArray(stockBatches.variantId, variantIds))
      .orderBy(desc(stockBatches.receivedAt), desc(stockBatches.id)),
    db
      .select({
        id: stockMovements.id,
        size: productVariants.size,
        color: productVariants.color,
        type: stockMovements.type,
        qty: stockMovements.qty,
        note: stockMovements.note,
        by: users.name,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(productVariants, eq(stockMovements.variantId, productVariants.id))
      .leftJoin(users, eq(stockMovements.createdBy, users.id))
      .where(inArray(stockMovements.variantId, variantIds))
      .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
      .limit(20),
    db
      .select({
        avgCost: sql<number>`coalesce(sum(${stockBatches.qtyRemaining} * ${stockBatches.unitCost}) / nullif(sum(${stockBatches.qtyRemaining}), 0), 0)`.mapWith(Number),
      })
      .from(stockBatches)
      .where(inArray(stockBatches.variantId, variantIds)),
  ]);

  const variants: VariantRow[] = variantRows.map(({ movements: m, batches: b, lines: l, ...v }) => ({
    ...v,
    locked: m > 0 || b > 0 || l > 0,
  }));

  return {
    ...p,
    avgCost: cost?.avgCost ?? 0,
    stockOnHand: variants.reduce((a, v) => a + v.stockOnHand, 0),
    stockReserved: variants.reduce((a, v) => a + v.stockReserved, 0),
    variants,
    tiers,
    batches: batches.map((b) => ({
      id: b.id,
      variantId: b.variantId,
      variantLabel: variantLabel(b),
      supplier: b.supplier,
      reference: b.reference,
      qtyReceived: b.qtyReceived,
      qtyRemaining: b.qtyRemaining,
      unitCost: b.unitCost,
      receivedAt: b.receivedAt,
    })),
    movements: movements.map((m) => ({
      id: m.id,
      variantLabel: variantLabel(m),
      type: m.type,
      qty: m.qty,
      note: m.note,
      by: m.by,
      createdAt: m.createdAt,
    })),
  };
}

export type ProductProfit = {
  period: Period;
  start: Date;
  end: Date;
  profit: number;
  revenue: number;
  cost: number;
  units: number;
  orders: number;
  /** profit per day for the last 14 days (oldest first) */
  series: Bucket[];
};

const SOLD = ["delivered", "paid"] as const;

/** Profit earned by one product: totals for the period + a 14-day daily series. Counts on the delivered date. */
export async function getProductProfit(productId: number, period: Period): Promise<ProductProfit> {
  const { start, end } = periodRange(period);
  const seriesStart = new Date(end);
  seriesStart.setDate(seriesStart.getDate() - 13);
  seriesStart.setHours(0, 0, 0, 0);

  const forProduct = and(eq(productVariants.productId, productId), inArray(orders.status, [...SOLD]));

  const [[totals], rows] = await Promise.all([
    db
      .select({
        revenue: sql<number>`coalesce(sum(${orderItems.lineTotal}), 0)`.mapWith(Number),
        cost: sql<number>`coalesce(sum(${orderItems.qty} * ${orderItems.unitCost}), 0)`.mapWith(Number),
        profit: sql<number>`coalesce(sum(${orderItems.lineProfit}), 0)`.mapWith(Number),
        units: sql<number>`coalesce(sum(${orderItems.qty}), 0)`.mapWith(Number),
        orders: sql<number>`count(distinct ${orders.id})`.mapWith(Number),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
      .where(and(forProduct, between(orders.deliveredAt, start, end))),
    db
      .select({
        at: orders.deliveredAt,
        profit: sql<number>`coalesce(${orderItems.lineProfit}, 0)`.mapWith(Number),
        cost: sql<number>`coalesce(${orderItems.qty} * ${orderItems.unitCost}, 0)`.mapWith(Number),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orderItems.orderId, orders.id))
      .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
      .where(and(forProduct, between(orders.deliveredAt, seriesStart, end))),
  ]);

  const byDay = new Map<string, { profit: number; cost: number }>();
  for (const r of rows) {
    if (!r.at) continue;
    const k = keyDay(r.at);
    const t = byDay.get(k) ?? { profit: 0, cost: 0 };
    t.profit += r.profit;
    t.cost += r.cost;
    byDay.set(k, t);
  }
  const series: Bucket[] = [];
  const cursor = new Date(seriesStart);
  while (cursor <= end) {
    const t = byDay.get(keyDay(cursor));
    series.push({
      label: cursor.toLocaleDateString("en-PH", { day: "numeric", month: "short" }),
      profit: t?.profit ?? 0,
      cost: t?.cost ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { period, start, end, ...totals, series };
}

const pad = (n: number) => String(n).padStart(2, "0");
const keyDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Distinct price groups in use (customers + tiers), for the tier editor's suggestions. */
export async function getPriceGroups(): Promise<string[]> {
  const rows = await db.execute<{ g: string }>(sql`
    select distinct price_group as g from customers where price_group is not null
    union
    select distinct price_group as g from price_tiers where price_group is not null
    order by 1`);
  return [...rows].map((r) => r.g);
}
