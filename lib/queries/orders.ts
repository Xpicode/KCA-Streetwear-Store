import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  orderItems,
  orders,
  payments,
  priceTiers,
  productVariants,
  products,
  users,
} from "@/db/schema";

export const ORDER_VIEWS = ["active", "history"] as const;
export type OrderView = (typeof ORDER_VIEWS)[number];

/** Active = still moving through the pipeline; History = finished (paid) or cancelled. */
export const ACTIVE_STATUSES = ["pending", "confirmed", "packed", "paid"] as const;
export const HISTORY_STATUSES = ["delivered", "cancelled"] as const;

export const ORDER_TABS = ["all", "pending", "confirmed", "packed", "delivered", "unpaid", "paid", "cancelled"] as const;
export type OrderTab = (typeof ORDER_TABS)[number];

export const ORDER_SORTS = ["status", "newest", "oldest", "total"] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

/** pending first — the order you'd work the queue in. */
const STATUS_PRIORITY = sql`case ${orders.status} when 'pending' then 0 when 'confirmed' then 1 when 'packed' then 2 when 'paid' then 3 when 'delivered' then 4 else 5 end`;

export type OrderListRow = {
  id: number;
  orderNo: string;
  requestedAt: Date;
  customer: string;
  customerId: number;
  source: string;
  status: string;
  paymentStatus: string;
  total: number;
  units: number;
  lines: number;
};

function tabWhere(tab: OrderTab) {
  if (tab === "all") return undefined;
  if (tab === "unpaid") return and(ne(orders.paymentStatus, "paid"), ne(orders.status, "cancelled"));
  return eq(orders.status, tab);
}

function viewWhere(view: OrderView) {
  return inArray(orders.status, view === "active" ? [...ACTIVE_STATUSES] : [...HISTORY_STATUSES]);
}

export async function getOrders(
  opts: { view?: OrderView; tab?: OrderTab; q?: string; sort?: OrderSort } = {}
): Promise<OrderListRow[]> {
  const view = opts.view ?? "active";
  const where = [viewWhere(view), tabWhere(opts.tab ?? "all")];
  if (opts.q?.trim()) {
    const term = opts.q.trim();
    const like = `%${term.replace(/^#/, "")}%`;
    where.push(or(ilike(orders.orderNo, like), ilike(customers.shopName, `%${term}%`), ilike(customers.contactName, `%${term}%`)));
  }
  const rows = await db
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      requestedAt: orders.requestedAt,
      customer: customers.shopName,
      customerId: customers.id,
      source: orders.source,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      total: orders.total,
      units: sql<number>`coalesce(sum(${orderItems.qty}), 0)`.mapWith(Number),
      lines: count(orderItems.id),
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(...where.filter(Boolean)))
    .groupBy(orders.id, customers.id)
    .orderBy(...orderBy(opts.sort ?? (view === "active" ? "status" : "newest")));
  return rows;
}

function orderBy(sort: OrderSort) {
  switch (sort) {
    case "status":
      return [asc(STATUS_PRIORITY), desc(orders.requestedAt), desc(orders.id)];
    case "oldest":
      return [asc(orders.requestedAt), asc(orders.id)];
    case "total":
      return [desc(orders.total), desc(orders.id)];
    default:
      return [desc(orders.requestedAt), desc(orders.id)];
  }
}

export type OrderCounts = {
  activeTotal: number;
  historyTotal: number;
  byTab: Record<OrderTab, number>;
};

export async function getOrderCounts(): Promise<OrderCounts> {
  const [byStatus, [unpaid]] = await Promise.all([
    db.select({ status: orders.status, n: count() }).from(orders).groupBy(orders.status),
    db.select({ n: count() }).from(orders).where(tabWhere("unpaid")),
  ]);
  const get = (s: string) => byStatus.find((r) => r.status === s)?.n ?? 0;
  const activeTotal = get("pending") + get("confirmed") + get("packed") + get("paid");
  const historyTotal = get("delivered") + get("cancelled");
  return {
    activeTotal,
    historyTotal,
    byTab: {
      all: 0, // filled per view by the caller
      pending: get("pending"),
      confirmed: get("confirmed"),
      packed: get("packed"),
      delivered: get("delivered"),
      unpaid: unpaid.n,
      paid: get("paid"),
      cancelled: get("cancelled"),
    },
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

export async function getOrder(id: number) {
  const [order] = await db
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      subtotal: orders.subtotal,
      discount: orders.discount,
      total: orders.total,
      note: orders.note,
      source: orders.source,
      requestedAt: orders.requestedAt,
      confirmedAt: orders.confirmedAt,
      packedAt: orders.packedAt,
      deliveredAt: orders.deliveredAt,
      handledBy: users.name,
      customer: {
        id: customers.id,
        shopName: customers.shopName,
        contactName: customers.contactName,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        priceGroup: customers.priceGroup,
      },
    })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .leftJoin(users, eq(orders.handledBy, users.id))
    .where(eq(orders.id, id))
    .limit(1);
  if (!order) return null;

  const [items, pays] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        variantId: orderItems.variantId,
        qty: orderItems.qty,
        unitPrice: orderItems.unitPrice,
        unitCost: orderItems.unitCost,
        lineTotal: orderItems.lineTotal,
        lineProfit: orderItems.lineProfit,
        productId: products.id,
        productName: products.name,
        sku: products.sku,
        size: productVariants.size,
        color: productVariants.color,
        onHand: productVariants.stockOnHand,
        reserved: productVariants.stockReserved,
      })
      .from(orderItems)
      .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(eq(orderItems.orderId, id))
      .orderBy(asc(orderItems.id)),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(desc(payments.paidAt), desc(payments.id)),
  ]);

  const paid = pays.reduce((a, p) => a + p.amount, 0);
  const units = items.reduce((a, i) => a + i.qty, 0);
  const cost = items.reduce((a, i) => a + (i.unitCost ?? 0) * i.qty, 0);
  const profit = items.reduce((a, i) => a + (i.lineProfit ?? 0), 0);
  const costed = items.length > 0 && items.every((i) => i.unitCost != null);

  return { ...order, items, payments: pays, paid, balance: order.total - paid, units, cost, profit, costed };
}

// ---- data for the "New order" form -----------------------------------------

export async function getCustomersForSelect() {
  return db
    .select({ id: customers.id, shopName: customers.shopName, priceGroup: customers.priceGroup, status: customers.status })
    .from(customers)
    .where(ne(customers.status, "blocked"))
    .orderBy(customers.shopName);
}

export type FormVariant = {
  id: number;
  size: string | null;
  color: string | null;
  priceOverride: number | null;
  available: number;
};
export type FormProduct = {
  id: number;
  name: string;
  sku: string;
  basePrice: number;
  moq: number;
  tiers: { minQty: number; price: number; priceGroup: string | null }[];
  variants: FormVariant[];
};

export async function getProductsForOrderForm(): Promise<FormProduct[]> {
  const [prods, variants, tiers] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, sku: products.sku, basePrice: products.basePrice, moq: products.moq })
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(products.name),
    db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        size: productVariants.size,
        color: productVariants.color,
        priceOverride: productVariants.priceOverride,
        available: sql<number>`${productVariants.stockOnHand} - ${productVariants.stockReserved}`.mapWith(Number),
      })
      .from(productVariants)
      .where(eq(productVariants.isActive, true))
      .orderBy(productVariants.id),
    db
      .select({ productId: priceTiers.productId, minQty: priceTiers.minQty, price: priceTiers.price, priceGroup: priceTiers.priceGroup })
      .from(priceTiers),
  ]);
  return prods.map((p) => ({
    ...p,
    tiers: tiers.filter((t) => t.productId === p.id).map(({ minQty, price, priceGroup }) => ({ minQty, price, priceGroup })),
    variants: variants
      .filter((v) => v.productId === p.id)
      .map(({ id, size, color, priceOverride, available }) => ({ id, size, color, priceOverride, available })),
  }));
}
