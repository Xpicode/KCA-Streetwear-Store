import { and, between, count, desc, eq, inArray, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import { customers, orderItems, orders, productVariants, products } from "@/db/schema";
import { periodRange, type Period } from "@/lib/profit";

export type Kpis = { revenue: number; cost: number; profit: number; orders: number; units: number };
export type Bucket = { label: string; profit: number; cost: number };
export type TopProduct = { id: number; name: string; units: number; profit: number; revenue: number };
export type LowStock = { id: number; name: string; sku: string; stock: number; reorderLevel: number };
export type ActionOrder = {
  id: number;
  orderNo: string;
  customer: string;
  status: "pending" | "confirmed" | "packed" | "paid";
  units: number;
  lines: number;
  total: number;
};

const SOLD = ["delivered", "paid"] as const;

/** Everything the dashboard shows for one period. Profit counts on the delivered date. */
export async function getDashboard(period: Period) {
  const { start, end } = periodRange(period);
  const inWindow = and(inArray(orders.status, [...SOLD]), between(orders.deliveredAt, start, end));

  const [kpis, series, top, low, action, actionCounts] = await Promise.all([
    getKpis(inWindow),
    getSeries(period, start, end, inWindow),
    getTopProducts(inWindow),
    getLowStock(),
    getOrdersNeedingAction(),
    getActionCounts(),
  ]);

  return { period, start, end, kpis, series, top, low, action, actionCounts };
}

type Where = ReturnType<typeof and>;

async function getKpis(inWindow: Where): Promise<Kpis> {
  const [row] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${orderItems.lineTotal}), 0)`.mapWith(Number),
      cost: sql<number>`coalesce(sum(${orderItems.qty} * ${orderItems.unitCost}), 0)`.mapWith(Number),
      profit: sql<number>`coalesce(sum(${orderItems.lineProfit}), 0)`.mapWith(Number),
      orders: sql<number>`count(distinct ${orders.id})`.mapWith(Number),
      units: sql<number>`coalesce(sum(${orderItems.qty}), 0)`.mapWith(Number),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(inWindow);
  return row;
}

/** Profit + cost per hour (today) or per day (week / month), bucketed in JS so it follows the server's timezone. */
async function getSeries(period: Period, start: Date, end: Date, inWindow: Where): Promise<Bucket[]> {
  const rows = await db
    .select({
      at: orders.deliveredAt,
      profit: sql<number>`coalesce(${orderItems.lineProfit}, 0)`.mapWith(Number),
      cost: sql<number>`coalesce(${orderItems.qty} * ${orderItems.unitCost}, 0)`.mapWith(Number),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(inWindow);

  const totals = new Map<string, { profit: number; cost: number }>();
  for (const r of rows) {
    if (!r.at) continue;
    const key = period === "day" ? keyHour(r.at) : keyDay(r.at);
    const t = totals.get(key) ?? { profit: 0, cost: 0 };
    t.profit += r.profit;
    t.cost += r.cost;
    totals.set(key, t);
  }

  const out: Bucket[] = [];
  if (period === "day") {
    for (let h = 8; h <= 20; h++) {
      const d = new Date(start);
      d.setHours(h, 0, 0, 0);
      const t = totals.get(keyHour(d));
      out.push({ label: hourLabel(h), profit: t?.profit ?? 0, cost: t?.cost ?? 0 });
    }
  } else {
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      const t = totals.get(keyDay(cursor));
      out.push({ label: dayLabel(cursor, period), profit: t?.profit ?? 0, cost: t?.cost ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return out;
}

async function getTopProducts(inWindow: Where): Promise<TopProduct[]> {
  return db
    .select({
      id: products.id,
      name: products.name,
      units: sql<number>`coalesce(sum(${orderItems.qty}), 0)`.mapWith(Number),
      profit: sql<number>`coalesce(sum(${orderItems.lineProfit}), 0)`.mapWith(Number),
      revenue: sql<number>`coalesce(sum(${orderItems.lineTotal}), 0)`.mapWith(Number),
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(inWindow)
    .groupBy(products.id, products.name)
    .orderBy(desc(sql`sum(${orderItems.lineProfit})`))
    .limit(5);
}

async function getLowStock(): Promise<LowStock[]> {
  return db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      stock: sql<number>`coalesce(sum(${productVariants.stockOnHand}), 0)`.mapWith(Number),
      reorderLevel: products.reorderLevel,
    })
    .from(products)
    .leftJoin(productVariants, eq(productVariants.productId, products.id))
    .where(eq(products.isActive, true))
    .groupBy(products.id)
    .having(sql`coalesce(sum(${productVariants.stockOnHand}), 0) <= ${products.reorderLevel}`)
    .orderBy(sql`coalesce(sum(${productVariants.stockOnHand}), 0)::float / nullif(${products.reorderLevel}, 0)`)
    .limit(6);
}

async function getOrdersNeedingAction(): Promise<ActionOrder[]> {
  const rows = await db
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      customer: customers.shopName,
      status: orders.status,
      total: orders.total,
      units: sql<number>`coalesce(sum(${orderItems.qty}), 0)`.mapWith(Number),
      lines: count(orderItems.id),
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(inArray(orders.status, ["pending", "confirmed", "packed", "paid"]))
    .groupBy(orders.id, customers.shopName)
    .orderBy(sql`case ${orders.status} when 'pending' then 0 when 'confirmed' then 1 when 'packed' then 2 else 3 end`, orders.requestedAt)
    .limit(6);
  return rows as ActionOrder[];
}

async function getActionCounts() {
  const rows = await db
    .select({ status: orders.status, n: count() })
    .from(orders)
    .where(inArray(orders.status, ["pending", "confirmed", "packed", "paid"]))
    .groupBy(orders.status);
  const get = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
  return { pending: get("pending"), confirmed: get("confirmed"), packed: get("packed"), paid: get("paid") };
}

// ---- helpers ----------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");
const keyDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyHour = (d: Date) => `${keyDay(d)} ${pad(d.getHours())}`;
const hourLabel = (h: number) => (h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`);
const dayLabel = (d: Date, period: Period) =>
  period === "week" ? d.toLocaleDateString("en-PH", { weekday: "short" }) : String(d.getDate());
