/** Storefront "My orders" reads — always scoped to the signed-in customer. */
import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orderItems, orders, payments } from "@/db/schema";
import { variantLabel } from "@/lib/queries/catalog";

export type CustomerOrderRow = {
  id: number;
  orderNo: string;
  status: string;
  paymentStatus: string;
  total: number;
  paid: number;
  balance: number;
  units: number;
  lineCount: number;
  itemSummary: string; // "Snapback Cap ×12, Plain Cotton Tee ×24"
  requestedAt: Date;
};

export async function listCustomerOrders(customerId: number): Promise<CustomerOrderRow[]> {
  const rows = await db.query.orders.findMany({
    where: eq(orders.customerId, customerId),
    with: { items: { with: { variant: { with: { product: { columns: { name: true } } } } } }, payments: true },
    orderBy: [desc(orders.requestedAt), desc(orders.id)],
  });
  return rows.map((o) => {
    const paid = o.payments.reduce((a, p) => a + p.amount, 0);
    // group lines by product for the summary
    const byProduct = new Map<string, number>();
    for (const it of o.items) byProduct.set(it.variant.product.name, (byProduct.get(it.variant.product.name) ?? 0) + it.qty);
    const names = [...byProduct.entries()].map(([n, q]) => `${n} ×${q}`);
    return {
      id: o.id,
      orderNo: o.orderNo,
      status: o.status,
      paymentStatus: o.paymentStatus,
      total: o.total,
      paid,
      balance: Math.max(0, o.total - paid),
      units: o.items.reduce((a, i) => a + i.qty, 0),
      lineCount: o.items.length,
      itemSummary: names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3} more` : ""),
      requestedAt: o.requestedAt,
    };
  });
}

export type CustomerOrderDetail = {
  id: number;
  orderNo: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  balance: number;
  note: string | null;
  requestedAt: Date;
  confirmedAt: Date | null;
  packedAt: Date | null;
  deliveredAt: Date | null;
  paidAt: Date | null; // date of the payment that settled the balance
  lines: { id: number; variantId: number; productId: number; name: string; slug: string; variant: string; qty: number; unitPrice: number; lineTotal: number }[];
  payments: { id: number; amount: number; method: string; paidAt: Date; reference: string | null }[];
};

export async function getCustomerOrder(customerId: number, orderId: number): Promise<CustomerOrderDetail | null> {
  const o = await getShopOrder(orderId);
  return o && o.customerId === customerId ? o : null;
}

/**
 * Order detail by id alone. Callers MUST check access themselves:
 * either the device's remembered customer owns it, or the request carries a
 * signed track token for exactly this order (see /shop/orders track form).
 */
export async function getShopOrder(orderId: number): Promise<(CustomerOrderDetail & { customerId: number; address: string | null }) | null> {
  const o = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      items: { with: { variant: { with: { product: { columns: { id: true, name: true, slug: true } } } } }, orderBy: [orderItems.id] },
      payments: { orderBy: [payments.paidAt, payments.id] },
    },
  });
  if (!o) return null;
  const [cust] = await db.select({ address: customers.address }).from(customers).where(eq(customers.id, o.customerId)).limit(1);
  const paid = o.payments.reduce((a, p) => a + p.amount, 0);
  return {
    customerId: o.customerId,
    address: cust?.address ?? null,
    id: o.id,
    orderNo: o.orderNo,
    status: o.status,
    paymentStatus: o.paymentStatus,
    subtotal: o.subtotal,
    discount: o.discount,
    total: o.total,
    paid,
    balance: Math.max(0, o.total - paid),
    note: o.note,
    requestedAt: o.requestedAt,
    confirmedAt: o.confirmedAt,
    packedAt: o.packedAt,
    deliveredAt: o.deliveredAt,
    paidAt: o.status === "paid" && o.payments.length ? o.payments[o.payments.length - 1].paidAt : null,
    lines: o.items.map((it) => ({
      id: it.id,
      variantId: it.variantId,
      productId: it.variant.product.id,
      name: it.variant.product.name,
      slug: it.variant.product.slug,
      variant: variantLabel(it.variant),
      qty: it.qty,
      unitPrice: it.unitPrice,
      lineTotal: it.lineTotal,
    })),
    payments: o.payments.map((p) => ({ id: p.id, amount: p.amount, method: p.method, paidAt: p.paidAt, reference: p.reference })),
  };
}

/** Lines of one of the customer's own orders, for "Reorder". */
export async function getCustomerOrderLines(customerId: number, orderId: number) {
  return db
    .select({ variantId: orderItems.variantId, qty: sql<number>`sum(${orderItems.qty})`.mapWith(Number) })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.id, orderId), eq(orders.customerId, customerId)))
    .groupBy(orderItems.variantId);
}
