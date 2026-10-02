/** Storefront rules per channel: the cart is re-validated against live stock, MOQ and channel pricing. */
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, orderItems, orders, products } from "@/db/schema";
import { getCartLines, getCatalog, getProductBySlug, getShopCategories } from "@/lib/queries/catalog";
import { CartProblem, createStorefrontOrder } from "@/lib/shop-orders";
import { resetDb, seedBasics } from "../helpers/fixtures";

type Fx = Awaited<ReturnType<typeof seedBasics>>;
let fx: Fx;

beforeEach(async () => {
  await resetDb();
  fx = await seedBasics();
});

describe("wholesale channel", () => {
  it("flags MOQ and stock problems", async () => {
    const short = await getCartLines({ [fx.variantId]: 3 }, "standard", "wholesale");
    expect(short.ok).toBe(false);
    expect(short.problems.join(" ")).toMatch(/Minimum 5 pcs/);

    const tooMany = await getCartLines({ [fx.variantId]: 25 }, "standard", "wholesale");
    expect(tooMany.ok).toBe(false);
    expect(tooMany.problems.join(" ")).toMatch(/Only 20 available/);
  });

  it("drops inactive variants and prices by tier and price group", async () => {
    const mixed = await getCartLines({ [fx.variantId]: 5, [fx.inactiveVariantId]: 5 }, "standard", "wholesale");
    expect(mixed.lines.map((l) => l.variantId)).toEqual([fx.variantId]);
    expect(mixed.lines[0].unitPrice).toBe(100);

    const ten = await getCartLines({ [fx.variantId]: 10 }, "standard", "wholesale");
    expect(ten.lines[0].unitPrice).toBe(90);

    const vip = await getCartLines({ [fx.variantId]: 5 }, "vip", "wholesale");
    expect(vip.lines[0].unitPrice).toBe(80);
  });

  it("lists every active product, including ones without a retail price", async () => {
    const catalog = await getCatalog({ priceGroup: "standard", channel: "wholesale" });
    expect(catalog.map((p) => p.slug).sort()).toEqual(["cap", "tee"]);
    const tee = catalog.find((p) => p.slug === "tee")!;
    expect(tee).toMatchObject({ channel: "wholesale", basePrice: 100, moq: 5 });
    expect(tee.tiers.length).toBeGreaterThan(0);
  });

  it("creates the order at the live tier price for the customer's group, source storefront", async () => {
    const o = await createStorefrontOrder({ channel: "wholesale", customerId: fx.vipCustomerId, priceGroup: "vip", cart: { [fx.variantId]: 5 }, note: "Deliver to: X" });
    const [line] = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    expect(line).toMatchObject({ qty: 5, unitPrice: 80, lineTotal: 400, unitCost: null, lineProfit: null });
    const [row] = await db.select({ source: orders.source }).from(orders).where(eq(orders.id, o.id));
    expect(row.source).toBe("storefront");
  });

  it("refuses a cart with problems and an empty cart", async () => {
    await expect(createStorefrontOrder({ channel: "wholesale", customerId: fx.customerId, priceGroup: "standard", cart: { [fx.variantId]: 3 }, note: null })).rejects.toThrow(CartProblem);
    await expect(createStorefrontOrder({ channel: "wholesale", customerId: fx.customerId, priceGroup: "standard", cart: {}, note: null })).rejects.toThrow(/empty/);
  });
});

describe("retail channel", () => {
  it("only lists products with a retail price, at that flat price with no MOQ or tiers", async () => {
    const catalog = await getCatalog({ priceGroup: "vip", channel: "retail" });
    expect(catalog.map((p) => p.slug)).toEqual(["tee"]);
    expect(catalog[0]).toMatchObject({ channel: "retail", basePrice: 150, moq: 1, tiers: [] });

    expect(await getProductBySlug("cap", "standard", "retail")).toBeNull();
    expect(await getProductBySlug("tee", "standard", "retail")).toMatchObject({ basePrice: 150 });
  });

  it("accepts a single piece and ignores the customer's wholesale price group", async () => {
    const one = await getCartLines({ [fx.variantId]: 1 }, "vip", "retail");
    expect(one.ok).toBe(true);
    expect(one.lines[0]).toMatchObject({ qty: 1, moq: 1, unitPrice: 150, lineTotal: 150, tierApplied: false, nextTier: null });

    const twenty = await getCartLines({ [fx.variantId]: 20 }, "standard", "retail");
    expect(twenty.lines[0].unitPrice).toBe(150); // no quantity discount in retail
  });

  it("drops wholesale-only products from a retail cart", async () => {
    const summary = await getCartLines({ [fx.variantId]: 2, [fx.capVariantId]: 2 }, "standard", "retail");
    expect(summary.lines.map((l) => l.variantId)).toEqual([fx.variantId]);
  });

  it("still enforces live stock", async () => {
    const tooMany = await getCartLines({ [fx.variantId]: 21 }, "standard", "retail");
    expect(tooMany.ok).toBe(false);
    expect(tooMany.problems.join(" ")).toMatch(/Only 20 available/);
  });

  it("creates the order at the retail price with source retail", async () => {
    const o = await createStorefrontOrder({ channel: "retail", customerId: fx.customerId, priceGroup: "standard", cart: { [fx.variantId]: 2 }, note: null });
    const [line] = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
    expect(line).toMatchObject({ qty: 2, unitPrice: 150, lineTotal: 300 });
    const [row] = await db.select({ source: orders.source, total: orders.total }).from(orders).where(eq(orders.id, o.id));
    expect(row).toMatchObject({ source: "retail", total: 300 });
  });
});

describe("show on website", () => {
  it("a product limited to one store is not listed, opened or kept in the cart in the other", async () => {
    const slugs = async (channel: "wholesale" | "retail") => (await getCatalog({ priceGroup: "standard", channel })).map((p) => p.slug);

    await db.update(products).set({ showIn: "retail" }).where(eq(products.id, fx.productId));
    expect(await slugs("wholesale")).toEqual(["cap"]);
    expect(await slugs("retail")).toEqual(["tee"]);
    expect(await getProductBySlug("tee", "standard", "wholesale")).toBeNull();
    expect((await getCartLines({ [fx.variantId]: 5 }, "standard", "wholesale")).lines).toEqual([]);

    await db.update(products).set({ showIn: "wholesale" }).where(eq(products.id, fx.productId));
    expect(await slugs("wholesale")).toEqual(["cap", "tee"]);
    expect(await slugs("retail")).toEqual([]);
    expect(await getProductBySlug("tee", "standard", "retail")).toBeNull();
  });

  it("a store's category tabs leave out categories with nothing in that store", async () => {
    const [cat] = await db.insert(categories).values({ name: "Jackets", slug: "jackets" }).returning({ id: categories.id });
    await db.update(products).set({ categoryId: cat.id, showIn: "retail" }).where(eq(products.id, fx.productId));
    expect((await getShopCategories("retail")).map((c) => c.slug)).toEqual(["jackets"]);
    expect(await getShopCategories("wholesale")).toEqual([]);
  });
});
