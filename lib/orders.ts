/**
 * Order pipeline: every state change runs in one transaction and follows the stock rules
 * in AGENT-BRIEF.md. Server actions (actions/orders.ts) and the storefront call these.
 *
 *   createOrderForCustomer  -> pending   (no stock effect)
 *   confirmOrder            -> confirmed (stock_reserved += qty; needs on_hand − reserved ≥ qty)
 *   packOrder               -> packed    (on_hand −= qty, reserved −= qty, movement, FIFO batches, cost snapshot)
 *   deliverOrder            -> delivered (profit counts on delivered_at)
 *   recordPayment           -> payment_status; delivered + fully paid -> paid
 *   cancelOrder             -> cancelled (from pending/confirmed; releases reservation)
 */
import "server-only";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  orderItems,
  orders,
  payments,
  productVariants,
  products,
  stockBatches,
  stockMovements,
} from "@/db/schema";
import { nextOrderNo } from "@/lib/order-no";
import { lineProfit } from "@/lib/profit";

/** A rule violation the user should see verbatim (not a bug). */
export class OrderError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const money = (n: number) => Math.round(n * 100) / 100;

export type NewOrderLine = { variantId: number; qty: number; unitPrice: number };
export type NewOrderInput = {
  customerId: number;
  lines: NewOrderLine[];
  note?: string | null;
  source?: "storefront" | "retail" | "manual";
  discount?: number;
  /** Admin user id when entered by staff; null for storefront requests. */
  handledBy?: number | null;
};

/**
 * Creates a PENDING order with a fresh order number. Reusable by the storefront checkout
 * and the admin "New order" form. Validates variants exist and are active; does not touch stock.
 */
export async function createOrderForCustomer(input: NewOrderInput): Promise<{ id: number; orderNo: string }> {
  const lines = mergeLines(input.lines);
  if (lines.length === 0) throw new OrderError("Add at least one line to the order.");
  for (const l of lines) {
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new OrderError("Quantities must be whole numbers above zero.");
    if (!Number.isFinite(l.unitPrice) || l.unitPrice < 0) throw new OrderError("Unit prices must be zero or more.");
  }
  const discount = money(input.discount ?? 0);
  if (discount < 0) throw new OrderError("Discount cannot be negative.");

  return db.transaction(async (tx) => {
    const [customer] = await tx
      .select({ id: customers.id, status: customers.status })
      .from(customers)
      .where(eq(customers.id, input.customerId))
      .limit(1);
    if (!customer) throw new OrderError("Customer not found.");
    if (customer.status === "blocked") throw new OrderError("This customer is blocked and cannot place orders.");

    const variantRows = await tx
      .select({
        id: productVariants.id,
        active: productVariants.isActive,
        productActive: products.isActive,
        name: products.name,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(inArray(productVariants.id, lines.map((l) => l.variantId)));
    for (const l of lines) {
      const v = variantRows.find((r) => r.id === l.variantId);
      if (!v) throw new OrderError(`Variant ${l.variantId} does not exist.`);
      if (!v.active || !v.productActive) throw new OrderError(`${v.name} is no longer available.`);
    }

    const subtotal = money(lines.reduce((a, l) => a + l.qty * l.unitPrice, 0));
    if (discount > subtotal) throw new OrderError("Discount is larger than the order subtotal.");
    const total = money(subtotal - discount);

    const orderNo = await nextOrderNo(tx);
    const [order] = await tx
      .insert(orders)
      .values({
        orderNo,
        customerId: input.customerId,
        status: "pending",
        paymentStatus: "unpaid",
        subtotal,
        discount,
        total,
        note: input.note?.trim() || null,
        source: input.source ?? "storefront",
        handledBy: input.handledBy ?? null,
      })
      .returning({ id: orders.id, orderNo: orders.orderNo });

    await tx.insert(orderItems).values(
      lines.map((l) => ({
        orderId: order.id,
        variantId: l.variantId,
        qty: l.qty,
        unitPrice: money(l.unitPrice),
        lineTotal: money(l.qty * l.unitPrice),
      }))
    );
    return order;
  });
}

/** Same variant twice → one line (keeps the first unit price). */
function mergeLines(lines: NewOrderLine[]): NewOrderLine[] {
  const map = new Map<number, NewOrderLine>();
  for (const l of lines) {
    const cur = map.get(l.variantId);
    if (cur) cur.qty += l.qty;
    else map.set(l.variantId, { ...l });
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

async function lockOrder(tx: Tx, orderId: number) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!order) throw new OrderError("Order not found.");
  return order;
}

async function lockedItems(tx: Tx, orderId: number) {
  return tx
    .select({
      id: orderItems.id,
      variantId: orderItems.variantId,
      qty: orderItems.qty,
      unitPrice: orderItems.unitPrice,
      onHand: productVariants.stockOnHand,
      reserved: productVariants.stockReserved,
      name: products.name,
      size: productVariants.size,
      color: productVariants.color,
    })
    .from(orderItems)
    .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.id)
    .for("update", { of: productVariants });
}

export function variantLabel(v: { name: string; size: string | null; color: string | null }) {
  const opt = [v.size, v.color].filter(Boolean).join(" / ");
  return opt ? `${v.name} (${opt})` : v.name;
}

/** pending → confirmed: reserve stock. Checks available = on_hand − reserved. */
export async function confirmOrder(orderId: number, userId: number) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status !== "pending") throw new OrderError(`Only pending orders can be confirmed (this one is ${order.status}).`);
    const items = await lockedItems(tx, orderId);
    if (items.length === 0) throw new OrderError("This order has no lines.");

    const short = items.filter((i) => i.onHand - i.reserved < i.qty);
    if (short.length) {
      const msg = short
        .map((i) => `${variantLabel(i)}: need ${i.qty}, only ${Math.max(i.onHand - i.reserved, 0)} available`)
        .join("; ");
      throw new OrderError(`Not enough stock to confirm. ${msg}.`);
    }

    for (const i of items) {
      await tx
        .update(productVariants)
        .set({ stockReserved: sql`${productVariants.stockReserved} + ${i.qty}` })
        .where(eq(productVariants.id, i.variantId));
    }
    await tx
      .update(orders)
      .set({ status: "confirmed", confirmedAt: new Date(), handledBy: userId })
      .where(eq(orders.id, orderId));
    return order.orderNo;
  });
}

/**
 * confirmed → packed: deduct on_hand and reserved, log a `sale` movement per line,
 * consume batches FIFO (oldest received_at first) and snapshot unit_cost as the
 * FIFO blend actually consumed. line_profit = (unit_price − unit_cost) × qty.
 */
export async function packOrder(orderId: number, userId: number) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status !== "confirmed") throw new OrderError(`Only confirmed orders can be packed (this one is ${order.status}).`);
    const items = await lockedItems(tx, orderId);

    const short = items.filter((i) => i.onHand < i.qty);
    if (short.length) {
      const msg = short.map((i) => `${variantLabel(i)}: need ${i.qty}, only ${i.onHand} on hand`).join("; ");
      throw new OrderError(`Not enough stock to pack. ${msg}.`);
    }

    for (const i of items) {
      await tx
        .update(productVariants)
        .set({
          stockOnHand: sql`${productVariants.stockOnHand} - ${i.qty}`,
          stockReserved: sql`greatest(${productVariants.stockReserved} - ${i.qty}, 0)`,
        })
        .where(eq(productVariants.id, i.variantId));

      await tx.insert(stockMovements).values({
        variantId: i.variantId,
        type: "sale",
        qty: -i.qty,
        referenceId: orderId,
        note: order.orderNo,
        createdBy: userId,
      });

      const unitCost = await consumeBatchesFifo(tx, i.variantId, i.qty);
      await tx
        .update(orderItems)
        .set({ unitCost, lineProfit: money(lineProfit(i.unitPrice, unitCost, i.qty)) })
        .where(eq(orderItems.id, i.id));
    }

    const [{ paidSoFar }] = await tx
      .select({ paidSoFar: sql<number>`coalesce(sum(${payments.amount}), 0)`.mapWith(Number) })
      .from(payments)
      .where(eq(payments.orderId, orderId));
    await tx
      .update(orders)
      .set({ status: paidSoFar >= order.total - 0.005 ? "paid" : "packed", packedAt: new Date(), handledBy: order.handledBy ?? userId })
      .where(eq(orders.id, orderId));
    return order.orderNo;
  });
}

/**
 * Takes `qty` out of the variant's open batches, oldest first, and returns the blended unit cost.
 * If batches run short (stock adjusted without batches) the remainder is costed at the
 * last known batch cost so the snapshot is never null.
 */
async function consumeBatchesFifo(tx: Tx, variantId: number, qty: number): Promise<number> {
  const open = await tx
    .select({ id: stockBatches.id, remaining: stockBatches.qtyRemaining, unitCost: stockBatches.unitCost })
    .from(stockBatches)
    .where(and(eq(stockBatches.variantId, variantId), gt(stockBatches.qtyRemaining, 0)))
    .orderBy(asc(stockBatches.receivedAt), asc(stockBatches.id))
    .for("update");

  let left = qty;
  let value = 0;
  let lastCost = 0;
  for (const b of open) {
    if (left === 0) break;
    const take = Math.min(left, b.remaining);
    value += take * b.unitCost;
    lastCost = b.unitCost;
    left -= take;
    await tx
      .update(stockBatches)
      .set({ qtyRemaining: b.remaining - take })
      .where(eq(stockBatches.id, b.id));
  }
  if (left > 0) {
    if (lastCost === 0) {
      const [latest] = await tx
        .select({ unitCost: stockBatches.unitCost })
        .from(stockBatches)
        .where(eq(stockBatches.variantId, variantId))
        .orderBy(sql`${stockBatches.receivedAt} desc`)
        .limit(1);
      lastCost = latest?.unitCost ?? 0;
    }
    value += left * lastCost;
  }
  return money(value / qty);
}

/**
 * paid → delivered. Payment ALWAYS comes first: an order can only go out the door
 * once it is packed and fully paid (status "paid").
 */
export async function deliverOrder(orderId: number, userId: number) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status === "packed") {
      throw new OrderError("Payment must be received in full before delivery — record the payment first.");
    }
    if (order.status !== "paid") {
      throw new OrderError(`Only fully paid orders can be marked delivered (this one is ${order.status}).`);
    }
    await tx
      .update(orders)
      .set({ status: "delivered", deliveredAt: new Date(), handledBy: order.handledBy ?? userId })
      .where(eq(orders.id, orderId));
    return order.orderNo;
  });
}

export type PaymentInput = { amount: number; method: "cash" | "bank" | "ewallet"; reference?: string | null; paidAt?: Date };

/** Adds a payment, recomputes payment_status; packed + fully paid → status "paid" (ready to deliver). */
export async function recordPayment(orderId: number, input: PaymentInput) {
  const amount = money(input.amount);
  if (!(amount > 0)) throw new OrderError("Enter an amount above zero.");
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status === "cancelled") throw new OrderError("Cancelled orders cannot take payments.");
    if (order.status === "delivered") throw new OrderError("This order is already delivered and settled.");

    const [{ paid }] = await tx
      .select({ paid: sql<number>`coalesce(sum(${payments.amount}), 0)`.mapWith(Number) })
      .from(payments)
      .where(eq(payments.orderId, orderId));
    const balance = money(order.total - paid);
    if (amount > balance + 0.005) throw new OrderError(`Amount is more than the balance due (${balance.toFixed(2)}).`);

    await tx.insert(payments).values({
      orderId,
      amount,
      method: input.method,
      reference: input.reference?.trim() || null,
      paidAt: input.paidAt ?? new Date(),
    });

    const nowPaid = money(paid + amount);
    const paymentStatus = nowPaid >= order.total - 0.005 ? "paid" : nowPaid > 0 ? "partial" : "unpaid";
    await tx
      .update(orders)
      .set({
        paymentStatus,
        status: paymentStatus === "paid" && order.status === "packed" ? "paid" : order.status,
      })
      .where(eq(orders.id, orderId));
    return { orderNo: order.orderNo, paymentStatus, balance: money(balance - amount) };
  });
}

/** pending/confirmed → cancelled. Releases the reservation when confirmed. */
export async function cancelOrder(orderId: number, userId: number) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status !== "pending" && order.status !== "confirmed") {
      throw new OrderError(`Only pending or confirmed orders can be cancelled (this one is ${order.status}).`);
    }
    if (order.status === "confirmed") {
      const items = await lockedItems(tx, orderId);
      for (const i of items) {
        await tx
          .update(productVariants)
          .set({ stockReserved: sql`greatest(${productVariants.stockReserved} - ${i.qty}, 0)` })
          .where(eq(productVariants.id, i.variantId));
      }
    }
    await tx
      .update(orders)
      .set({ status: "cancelled", handledBy: order.handledBy ?? userId })
      .where(eq(orders.id, orderId));
    return order.orderNo;
  });
}

export async function updateOrderNote(orderId: number, note: string) {
  const [row] = await db
    .update(orders)
    .set({ note: note.trim() || null })
    .where(eq(orders.id, orderId))
    .returning({ id: orders.id });
  if (!row) throw new OrderError("Order not found.");
}

/**
 * Permanently removes an order (lines and payments cascade). Owner-only.
 * Stock is put right first, depending on how far the order got:
 *   pending    — nothing to undo
 *   confirmed  — reservation released
 *   packed/paid — stock returned to the shelf (movement "return" + a restore batch at the
 *                snapshotted cost, so stock value stays truthful)
 *   delivered  — goods are gone; nothing restored, but its profit leaves the reports
 * Movements history is kept.
 */
export async function deleteOrder(orderId: number) {
  return db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);

    if (order.status === "confirmed") {
      const items = await lockedItems(tx, orderId);
      for (const i of items) {
        await tx
          .update(productVariants)
          .set({ stockReserved: sql`greatest(${productVariants.stockReserved} - ${i.qty}, 0)` })
          .where(eq(productVariants.id, i.variantId));
      }
    }

    if (order.status === "packed" || order.status === "paid") {
      const items = await tx
        .select({ variantId: orderItems.variantId, qty: orderItems.qty, unitCost: orderItems.unitCost })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));
      for (const i of items) {
        await tx
          .update(productVariants)
          .set({ stockOnHand: sql`${productVariants.stockOnHand} + ${i.qty}` })
          .where(eq(productVariants.id, i.variantId));
        await tx.insert(stockMovements).values({
          variantId: i.variantId,
          type: "return",
          qty: i.qty,
          referenceId: orderId,
          note: `Order ${order.orderNo} deleted — stock returned`,
        });
        await tx.insert(stockBatches).values({
          variantId: i.variantId,
          qtyReceived: i.qty,
          qtyRemaining: i.qty,
          unitCost: i.unitCost ?? 0,
          reference: `RESTORE ${order.orderNo}`,
        });
      }
    }

    await tx.delete(orders).where(eq(orders.id, orderId));
    return order.orderNo;
  });
}

/** Bulk delete: each order in its own transaction so one failure doesn't block the rest. */
export async function deleteOrders(orderIds: number[]) {
  const deleted: string[] = [];
  const failed: string[] = [];
  for (const id of orderIds) {
    try {
      deleted.push(await deleteOrder(id));
    } catch {
      failed.push(String(id));
    }
  }
  return { deleted, failed };
}
