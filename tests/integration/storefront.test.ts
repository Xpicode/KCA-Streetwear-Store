/** Storefront checkout rules: the cart is re-validated against live stock, MOQ and tier pricing. */
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems } from "@/db/schema";
import { getCartLines } from "@/lib/queries/catalog";
import { CartProblem, createStorefrontOrder } from "@/lib/shop-orders";
import { resetDb, seedBasics } from "../helpers/fixtures";

type Fx = Awaited<ReturnType<typeof seedBasics>>;
let fx: Fx;

beforeEach(async () => {
  await resetDb();
  fx = await seedBasics();
});

describe("getCartLines", () => {
  it("flags MOQ and stock problems", async () => {
    const short = await getCartLines({ [fx.variantId]: 3 }, "standard");
    expect(short.ok).toBe(false);
    expect(short.problems.join(" ")).toMatch(/Minimum 5 pcs/);

    const tooMany = await getCartLines({ [fx.variantId]: 25 }, "standard");
    expect(tooMany.ok).toBe(false);
    expect(tooMany.problems.join(" ")).toMatch(/Only 20 available/);
  });

  it("drops inactive variants and prices by tier and price group", async () => {
    const mixed = await getCartLines({ [fx.variantId]: 5, [fx.inactiveVariantId]: 5 }, "standard");
    expect(mixed.lines.map((l) => l.variantId)).toEqual([fx.variantId]);
    expect(mixed.lines[0].unitPrice).toBe(100);

    const ten = await getCartLines({ [fx.variantId]: 10 }, "standard");
    expect(ten.lines[0].unitPrice).toBe(90);

    const vip = await getCartLines({ [fx.variantId]: 5 }, "vip");
    expect(vip.lines[0].unitPrice).toBe(80);
  });
});

describe("createStorefrontOrder", () => {
  it("refuses a cart with problems and an empty cart", async () => {
    await expect(createStorefrontOrder({ customerId: fx.customerId, priceGroup: "standard", cart: { [fx.variantId]: 3 }, note: null })).rejects.toThrow(CartProblem);
    await expect(createStorefrontOrder({ customerId: fx.customerId, priceGroup: "standard", cart: {}, note: null })).rejects.toThrow(/empty/);
  });

  it("creates the order at the live tier price for the customer's group", async () => {
    const o = await createStorefrontOrder({ customerId: fx.vipCustomerId, priceGroup: "vip", cart: { [fx.variantId]: 5 }, note: "Deliver to: X" });
    const [line] = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    expect(line).toMatchObject({ qty: 5, unitPrice: 80, lineTotal: 400, unitCost: null, lineProfit: null });
  });
});
