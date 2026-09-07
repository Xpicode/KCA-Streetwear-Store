import { and, between, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orderItems, orders, productVariants, products, stockBatches } from "@/db/schema";

// ---- date range -----------------------------------------------------------------

export type Range = { from: Date; to: Date; fromKey: string; toKey: string; preset: Preset | null };
export type Preset = "week" | "month" | "last-month";
export const PRESETS: { key: Preset; label: string }[] = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "last-month", label: "Last month" },
];

const pad = (n: number) => String(n).padStart(2, "0");
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseKey(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Resolve ?from=&to= or ?preset= into a local-time day range. Default: this month. */
export function resolveRange(params: { from?: string; to?: string; preset?: string }, now = new Date()): Range {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  let from: Date;
  let to: Date;
  let preset: Preset | null = null;

  const pf = parseKey(params.from);
  const pt = parseKey(params.to);
  if (pf || pt) {
    from = pf ?? pt!;
    to = pt ?? pf!;
    if (to < from) [from, to] = [to, from];
  } else {
    preset = params.preset === "week" || params.preset === "last-month" ? params.preset : "month";
    if (preset === "week") {
      from = new Date(today);
      const day = (from.getDay() + 6) % 7; // Monday = 0
      from.setDate(from.getDate() - day);
      to = new Date(from);
      to.setDate(to.getDate() + 6);
    } else if (preset === "last-month") {
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
    } else {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      to = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }
  }
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return { from, to: end, fromKey: dateKey(from), toKey: dateKey(to), preset };
}

// ---- profit reports (delivered date, delivered + paid orders) ------------------------

const SOLD = ["delivered", "paid"] as const;
const soldIn = (r: Range) => and(inArray(orders.status, [...SOLD]), between(orders.deliveredAt, r.from, r.to));

const revenue = sql<number>`coalesce(sum(${orderItems.lineTotal}), 0)`.mapWith(Number);
const cost = sql<number>`coalesce(sum(${orderItems.qty} * coalesce(${orderItems.unitCost}, 0)), 0)`.mapWith(Number);
const profit = sql<number>`coalesce(sum(${orderItems.lineProfit}), 0)`.mapWith(Number);
const units = sql<number>`coalesce(sum(${orderItems.qty}), 0)`.mapWith(Number);
const orderCount = sql<number>`count(distinct ${orders.id})`.mapWith(Number);

export type Summary = { revenue: number; cost: number; profit: number; orders: number; units: number };

export async function getProfitSummary(r: Range): Promise<Summary> {
  const [row] = await db
    .select({ revenue, cost, profit, units, orders: orderCount })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(soldIn(r));
  return row;
}

export type ProductProfitRow = { id: number; name: string; sku: string; units: number; revenue: number; cost: number; profit: number };

export async function getProfitByProduct(r: Range): Promise<ProductProfitRow[]> {
  return db
    .select({ id: products.id, name: products.name, sku: products.sku, units, revenue, cost, profit })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(soldIn(r))
    .groupBy(products.id)
    .orderBy(desc(sql`sum(${orderItems.lineProfit})`));
}

export type CustomerProfitRow = { id: number; shopName: string; orders: number; units: number; revenue: number; cost: number; profit: number };

export async function getProfitByCustomer(r: Range): Promise<CustomerProfitRow[]> {
  return db
    .select({ id: customers.id, shopName: customers.shopName, orders: orderCount, units, revenue, cost, profit })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(soldIn(r))
    .groupBy(customers.id)
    .orderBy(desc(sql`sum(${orderItems.lineProfit})`));
}

export type DayProfitRow = { day: string; orders: number; units: number; revenue: number; cost: number; profit: number };

/** One row per calendar day that had deliveries (bucketed in JS so it follows the server's timezone). */
export async function getProfitByDay(r: Range): Promise<DayProfitRow[]> {
  const rows = await db
    .select({
      orderId: orders.id,
      at: orders.deliveredAt,
      qty: orderItems.qty,
      revenue: orderItems.lineTotal,
      cost: sql<number>`${orderItems.qty} * coalesce(${orderItems.unitCost}, 0)`.mapWith(Number),
      profit: sql<number>`coalesce(${orderItems.lineProfit}, 0)`.mapWith(Number),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(soldIn(r));

  const days = new Map<string, DayProfitRow & { ids: Set<number> }>();
  for (const x of rows) {
    if (!x.at) continue;
    const key = dateKey(x.at);
    const d = days.get(key) ?? { day: key, orders: 0, units: 0, revenue: 0, cost: 0, profit: 0, ids: new Set<number>() };
    d.ids.add(x.orderId);
    d.units += x.qty;
    d.revenue += x.revenue;
    d.cost += x.cost;
    d.profit += x.profit;
    days.set(key, d);
  }
  return [...days.values()]
    .map(({ ids, ...d }) => ({ ...d, orders: ids.size }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
}

// ---- stock value + slow movers -------------------------------------------------------

export type StockValueRow = { id: number; name: string; sku: string; qty: number; value: number; avgCost: number };

/** Σ qty_remaining × unit_cost per product from open batches. */
export async function getStockValue(): Promise<StockValueRow[]> {
  return db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      qty: sql<number>`coalesce(sum(${stockBatches.qtyRemaining}), 0)`.mapWith(Number),
      value: sql<number>`coalesce(sum(${stockBatches.qtyRemaining} * ${stockBatches.unitCost}), 0)`.mapWith(Number),
      avgCost: sql<number>`coalesce(sum(${stockBatches.qtyRemaining} * ${stockBatches.unitCost}) / nullif(sum(${stockBatches.qtyRemaining}), 0), 0)`.mapWith(Number),
    })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .leftJoin(stockBatches, eq(stockBatches.variantId, productVariants.id))
    .where(eq(products.isActive, true))
    .groupBy(products.id)
    .orderBy(desc(sql`coalesce(sum(${stockBatches.qtyRemaining} * ${stockBatches.unitCost}), 0)`));
}

export type SlowMoverRow = { id: number; name: string; sku: string; stock: number; lastSoldAt: Date | null };

/** Active products with zero units delivered in the range. */
export async function getSlowMovers(r: Range): Promise<SlowMoverRow[]> {
  const soldIds = db
    .select({ id: productVariants.productId })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .where(soldIn(r));

  const lastSold = db
    .select({
      productId: productVariants.productId,
      lastSoldAt: sql<Date>`max(${orders.deliveredAt})`.as("last_sold_at"),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .where(inArray(orders.status, [...SOLD]))
    .groupBy(productVariants.productId)
    .as("last_sold");

  const stock = db
    .select({ productId: productVariants.productId, stock: sql<number>`sum(${productVariants.stockOnHand})`.as("stock") })
    .from(productVariants)
    .groupBy(productVariants.productId)
    .as("stock");

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      stock: sql<number>`coalesce(${stock.stock}, 0)`.mapWith(Number),
      lastSoldAt: lastSold.lastSoldAt,
    })
    .from(products)
    .leftJoin(stock, eq(stock.productId, products.id))
    .leftJoin(lastSold, eq(lastSold.productId, products.id))
    .where(and(eq(products.isActive, true), notInArray(products.id, soldIds)))
    .orderBy(desc(sql`coalesce(${stock.stock}, 0)`));
  return rows.map((x) => ({ ...x, lastSoldAt: x.lastSoldAt ? new Date(x.lastSoldAt) : null }));
}

export type ReportKey = "summary" | "products" | "customers" | "days" | "stock-value" | "slow-movers";
export const REPORT_KEYS: ReportKey[] = ["summary", "products", "customers", "days", "stock-value", "slow-movers"];
