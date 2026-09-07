/**
 * Order pipeline against a real Postgres (see vitest.config.ts):
 * pending → confirmed (reserve) → packed (deduct, FIFO cost) → paid → delivered, plus cancel/delete.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, productVariants, stockBatches, stockMovements } from "@/db/schema";
import {
  OrderError,
  cancelOrder,
  confirmOrder,
  createOrderForCustomer,
  deleteOrder,
  deliverOrder,
  packOrder,
  recordPayment,
} from "@/lib/orders";
import { resetDb, seedBasics } from "../helpers/fixtures";

type Fx = Awaited<ReturnType<typeof seedBasics>>;
let fx: Fx;

beforeEach(async () => {
  await resetDb();
  fx = await seedBasics();
});

const variant = async (id = fx.variantId) => (await db.select().from(productVariants).where(eq(productVariants.id, id)))[0];
const order = async (id: number) => (await db.select().from(orders).where(eq(orders.id, id)))[0];
const items = (id: number) => db.select().from(orderItems).where(eq(orderItems.orderId, id));
const batches = () => db.select().from(stockBatches).where(eq(stockBatches.variantId, fx.variantId)).orderBy(asc(stockBatches.receivedAt), asc(stockBatches.id));

const newOrder = (qty: number, extra: Partial<Parameters<typeof createOrderForCustomer>[0]> = {}) =>
  createOrderForCustomer({ customerId: fx.customerId, lines: [{ variantId: fx.variantId, qty, unitPrice: 100 }], ...extra });

describe("createOrderForCustomer", () => {
  it("creates a pending order with a sequential number and touches no stock", async () => {
    const o = await newOrder(5, { discount: 20, note: "  first  " });
    expect(o.orderNo).toBe("#1001");
    const row = await order(o.id);
    expect(row).toMatchObject({ status: "pending", paymentStatus: "unpaid", subtotal: 500, discount: 20, total: 480, note: "first", source: "storefront" });
    expect(await variant()).toMatchObject({ stockOnHand: 20, stockReserved: 0 });
    expect((await newOrder(1)).orderNo).toBe("#1002");
  });

  it("merges duplicate lines", async () => {
    const o = await createOrderForCustomer({
      customerId: fx.customerId,
      lines: [
        { variantId: fx.variantId, qty: 2, unitPrice: 100 },
        { variantId: fx.variantId, qty: 3, unitPrice: 100 },
      ],
    });
    const lines = await items(o.id);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ qty: 5, lineTotal: 500 });
  });

  it("rejects blocked customers, inactive variants, empty orders and oversized discounts", async () => {
    await expect(newOrder(1, { customerId: fx.blockedCustomerId })).rejects.toThrow(OrderError);
    await expect(createOrderForCustomer({ customerId: fx.customerId, lines: [{ variantId: fx.inactiveVariantId, qty: 1, unitPrice: 100 }] })).rejects.toThrow(/no longer available/);
    await expect(createOrderForCustomer({ customerId: fx.customerId, lines: [] })).rejects.toThrow(OrderError);
    await expect(newOrder(1, { discount: 500 })).rejects.toThrow(/Discount/);
    await expect(newOrder(1.5)).rejects.toThrow(/whole numbers/);
  });
});

describe("confirmOrder", () => {
  it("reserves stock and refuses when available (on hand − reserved) is short", async () => {
    const a = await newOrder(5);
    await confirmOrder(a.id, fx.userId);
    expect(await variant()).toMatchObject({ stockOnHand: 20, stockReserved: 5 });
    expect(await order(a.id)).toMatchObject({ status: "confirmed", handledBy: fx.userId });

    const b = await newOrder(16); // only 15 available now
    await expect(confirmOrder(b.id, fx.userId)).rejects.toThrow(/only 15 available/);
    expect(await variant()).toMatchObject({ stockReserved: 5 });

    await expect(confirmOrder(a.id, fx.userId)).rejects.toThrow(/Only pending/);
  });
});

describe("packOrder", () => {
  it("deducts stock, logs a sale movement and snapshots the FIFO blended cost", async () => {
    const o = await newOrder(15);
    await expect(packOrder(o.id, fx.userId)).rejects.toThrow(/Only confirmed/);
    await confirmOrder(o.id, fx.userId);
    await packOrder(o.id, fx.userId);

    expect(await variant()).toMatchObject({ stockOnHand: 5, stockReserved: 0 });
    expect((await batches()).map((b) => b.qtyRemaining)).toEqual([0, 5]);

    // 10 @ 50 + 5 @ 70 = 850 / 15 = 56.67 per piece
    const [line] = await items(o.id);
    expect(line.unitCost).toBe(56.67);
    expect(line.lineProfit).toBe(649.95);

    const moves = await db.select().from(stockMovements).where(eq(stockMovements.variantId, fx.variantId));
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ type: "sale", qty: -15, referenceId: o.id, createdBy: fx.userId });
    expect(await order(o.id)).toMatchObject({ status: "packed" });
  });

  it("costs the remainder at the last batch cost when batches run short", async () => {
    // stock adjusted upward without a batch: 25 on hand, batches only cover 20
    await db.update(productVariants).set({ stockOnHand: 25 }).where(eq(productVariants.id, fx.variantId));
    const o = await newOrder(25);
    await confirmOrder(o.id, fx.userId);
    await packOrder(o.id, fx.userId);
    const [line] = await items(o.id);
    // (10×50 + 10×70 + 5×70) / 25 = 62
    expect(line.unitCost).toBe(62);
  });

  it("goes straight to paid when the order was already paid in full", async () => {
    const o = await newOrder(5);
    await confirmOrder(o.id, fx.userId);
    await recordPayment(o.id, { amount: 500, method: "cash" });
    await packOrder(o.id, fx.userId);
    expect(await order(o.id)).toMatchObject({ status: "paid", paymentStatus: "paid" });
  });
});

describe("payments and delivery", () => {
  it("tracks partial → paid, blocks overpayment, and only delivers fully paid orders", async () => {
    const o = await newOrder(5);
    await confirmOrder(o.id, fx.userId);
    await packOrder(o.id, fx.userId);

    await expect(deliverOrder(o.id, fx.userId)).rejects.toThrow(/Payment must be received/);
    await expect(recordPayment(o.id, { amount: 600, method: "bank" })).rejects.toThrow(/more than the balance/);
    await expect(recordPayment(o.id, { amount: 0, method: "bank" })).rejects.toThrow(/above zero/);

    const partial = await recordPayment(o.id, { amount: 200, method: "ewallet", reference: "GC-1" });
    expect(partial).toMatchObject({ paymentStatus: "partial", balance: 300 });
    expect(await order(o.id)).toMatchObject({ status: "packed", paymentStatus: "partial" });

    const full = await recordPayment(o.id, { amount: 300, method: "cash" });
    expect(full).toMatchObject({ paymentStatus: "paid", balance: 0 });
    expect(await order(o.id)).toMatchObject({ status: "paid" });

    await deliverOrder(o.id, fx.userId);
    const delivered = await order(o.id);
    expect(delivered.status).toBe("delivered");
    expect(delivered.deliveredAt).toBeInstanceOf(Date);
    await expect(recordPayment(o.id, { amount: 1, method: "cash" })).rejects.toThrow(/already delivered/);
  });
});

describe("cancelOrder", () => {
  it("releases a confirmed reservation and refuses once packed", async () => {
    const o = await newOrder(5);
    await confirmOrder(o.id, fx.userId);
    expect(await variant()).toMatchObject({ stockReserved: 5 });
    await cancelOrder(o.id, fx.userId);
    expect(await variant()).toMatchObject({ stockOnHand: 20, stockReserved: 0 });
    expect(await order(o.id)).toMatchObject({ status: "cancelled" });

    const p = await newOrder(5);
    await confirmOrder(p.id, fx.userId);
    await packOrder(p.id, fx.userId);
    await expect(cancelOrder(p.id, fx.userId)).rejects.toThrow(/Only pending or confirmed/);
  });
});

describe("deleteOrder", () => {
  it("returns packed stock to the shelf with a restore batch and a return movement", async () => {
    const o = await newOrder(15);
    await confirmOrder(o.id, fx.userId);
    await packOrder(o.id, fx.userId);
    expect(await variant()).toMatchObject({ stockOnHand: 5 });

    await deleteOrder(o.id);
    expect(await order(o.id)).toBeUndefined();
    expect(await variant()).toMatchObject({ stockOnHand: 20, stockReserved: 0 });

    const restore = (await batches()).find((b) => b.reference?.startsWith("RESTORE"));
    expect(restore).toMatchObject({ qtyReceived: 15, qtyRemaining: 15, unitCost: 56.67 });
    const moves = await db.select().from(stockMovements).where(eq(stockMovements.variantId, fx.variantId));
    expect(moves.map((m) => m.type).sort()).toEqual(["return", "sale"]);
  });

  it("releases a confirmed reservation", async () => {
    const o = await newOrder(5);
    await confirmOrder(o.id, fx.userId);
    await deleteOrder(o.id);
    expect(await variant()).toMatchObject({ stockOnHand: 20, stockReserved: 0 });
  });
});
