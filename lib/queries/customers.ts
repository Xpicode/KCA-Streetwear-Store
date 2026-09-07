import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orderItems, orders, payments } from "@/db/schema";

export type CustomerRow = {
  id: number;
  shopName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  status: "pending" | "approved" | "blocked";
  priceGroup: string;
  orders: number;
  spent: number; // total of delivered + paid orders
  unpaid: number; // balance due on delivered + paid orders (goods handed over, money not yet in)
};

/** Per-customer money summary: orders, spent, unpaid balance. */
function summarySubquery() {
  const paid = db
    .select({ orderId: payments.orderId, paid: sql<number>`sum(${payments.amount})`.as("paid_sum") })
    .from(payments)
    .groupBy(payments.orderId)
    .as("paid");
  return db
    .select({
      customerId: orders.customerId,
      orderCount: sql<number>`count(*) filter (where ${orders.status} <> 'cancelled')`.mapWith(Number).as("order_count"),
      spent: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.status} in ('delivered','paid')), 0)`
        .mapWith(Number)
        .as("spent_total"),
      unpaid: sql<number>`coalesce(sum(${orders.total} - coalesce(${paid.paid}, 0)) filter (where ${orders.status} in ('delivered','paid')), 0)`
        .mapWith(Number)
        .as("unpaid_total"),
    })
    .from(orders)
    .leftJoin(paid, eq(paid.orderId, orders.id))
    .groupBy(orders.customerId)
    .as("summary");
}

export async function getCustomers(opts: { status?: "pending" | "approved" | "blocked" } = {}): Promise<CustomerRow[]> {
  const summary = summarySubquery();
  return db
    .select({
      id: customers.id,
      shopName: customers.shopName,
      contactName: customers.contactName,
      phone: customers.phone,
      email: customers.email,
      status: customers.status,
      priceGroup: customers.priceGroup,
      orders: sql<number>`coalesce(${summary.orderCount}, 0)`.mapWith(Number),
      spent: sql<number>`coalesce(${summary.spent}, 0)`.mapWith(Number),
      unpaid: sql<number>`coalesce(${summary.unpaid}, 0)`.mapWith(Number),
    })
    .from(customers)
    .leftJoin(summary, eq(summary.customerId, customers.id))
    .where(opts.status ? eq(customers.status, opts.status) : undefined)
    .orderBy(sql`case ${customers.status} when 'pending' then 0 else 1 end`, customers.shopName);
}

export async function getCustomerStatusCounts() {
  const rows = await db.select({ status: customers.status, n: count() }).from(customers).groupBy(customers.status);
  const get = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
  return { all: rows.reduce((a, r) => a + r.n, 0), pending: get("pending"), approved: get("approved"), blocked: get("blocked") };
}

export async function getCustomer(id: number) {
  const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!c) return null;
  const { passwordHash, ...rest } = c;
  return { ...rest, hasPassword: !!passwordHash };
}

export type CustomerOrderRow = {
  id: number;
  orderNo: string;
  requestedAt: Date;
  status: string;
  paymentStatus: string;
  total: number;
  paid: number;
  units: number;
  lines: number;
};

export async function getCustomerOrders(customerId: number): Promise<CustomerOrderRow[]> {
  const paid = db
    .select({ orderId: payments.orderId, paid: sql<number>`sum(${payments.amount})`.as("paid_sum") })
    .from(payments)
    .groupBy(payments.orderId)
    .as("paid");
  return db
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      requestedAt: orders.requestedAt,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      total: orders.total,
      paid: sql<number>`coalesce(${paid.paid}, 0)`.mapWith(Number),
      units: sql<number>`coalesce(sum(${orderItems.qty}), 0)`.mapWith(Number),
      lines: count(orderItems.id),
    })
    .from(orders)
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .leftJoin(paid, eq(paid.orderId, orders.id))
    .where(eq(orders.customerId, customerId))
    .groupBy(orders.id, paid.paid)
    .orderBy(desc(orders.requestedAt), desc(orders.id));
}

/** Spent = delivered + paid order totals; unpaid = what is still owed on those delivered orders. */
export async function getCustomerBalance(customerId: number) {
  const summary = summarySubquery();
  const [row] = await db
    .select({
      spent: sql<number>`coalesce(${summary.spent}, 0)`.mapWith(Number),
      unpaid: sql<number>`coalesce(${summary.unpaid}, 0)`.mapWith(Number),
    })
    .from(customers)
    .leftJoin(summary, eq(summary.customerId, customers.id))
    .where(eq(customers.id, customerId));
  return row ?? { spent: 0, unpaid: 0 };
}

/** Price groups in use anywhere (customers or price tiers), always including "standard". */
export async function getPriceGroups(): Promise<string[]> {
  const rows = await db.execute<{ g: string }>(sql`
    select distinct price_group as g from customers
    union select distinct price_group from price_tiers where price_group is not null
  `);
  const set = new Set<string>(["standard", ...rows.map((r) => r.g)]);
  return [...set].sort();
}
