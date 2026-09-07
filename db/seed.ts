/**
 * Sample data so the admin pages have something to show.
 *   npm run db:push   (create tables)
 *   npm run db:seed   (this file)
 * Safe to re-run: it wipes and refills every table.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { loadEnvLocal } from "./env";
import * as s from "./schema";
import { hashPassword } from "../lib/auth-hash";

loadEnvLocal();
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing — create .env.local first");

// Seeding wipes every table and installs well-known sample passwords, so it refuses to run
// against anything that doesn't look like a local database unless you override on purpose.
const dbHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL).hostname;
  } catch {
    return "";
  }
})();
const isLocalDb = ["localhost", "127.0.0.1", "::1", "db"].includes(dbHost);
if ((process.env.NODE_ENV === "production" || !isLocalDb) && process.env.ALLOW_SEED !== "yes") {
  console.error(
    `Refusing to seed "${dbHost || "this database"}": seeding WIPES every table and installs the public sample logins.\n` +
      "It only runs against a local database. To do this on purpose:  ALLOW_SEED=yes npm run db:seed"
  );
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema: s });

const daysAgo = (n: number, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  console.log("Clearing tables…");
  await db.execute(sql`
    truncate table payments, order_items, orders, stock_movements, stock_batches,
      price_tiers, product_variants, products, categories, suppliers, customers, users
    restart identity cascade
  `);

  // --- users -----------------------------------------------------------------
  await db.insert(s.users).values([
    { name: "Owner", email: "owner@example.com", passwordHash: hashPassword("admin123"), role: "owner" },
    { name: "Staff", email: "staff@example.com", passwordHash: hashPassword("staff123"), role: "staff" },
  ]);

  // --- categories --------------------------------------------------------------
  const cats = await db
    .insert(s.categories)
    .values([
      { name: "Tees", slug: "tees", sortOrder: 1 },
      { name: "Caps", slug: "caps", sortOrder: 2 },
      { name: "Outerwear", slug: "outerwear", sortOrder: 3 },
      { name: "Bottoms", slug: "bottoms", sortOrder: 4 },
      { name: "Accessories", slug: "accessories", sortOrder: 5 },
    ])
    .returning();
  const cat = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  // --- suppliers ---------------------------------------------------------------
  const [supA, supB] = await db
    .insert(s.suppliers)
    .values([
      { name: "Divisoria Garments Trading", phone: "[0917 000 0001]" },
      { name: "Metro Caps Supply", phone: "[0917 000 0002]" },
    ])
    .returning();

  // --- products + variants + tiers -------------------------------------------
  type P = {
    sku: string; name: string; cat: string; price: number; tier: number; cost: number;
    reorder: number; sizes: (string | null)[]; colors: (string | null)[]; perVariant: number;
  };
  const defs: P[] = [
    { sku: "TEE-001", name: "Plain Cotton Tee", cat: "tees", price: 150, tier: 140, cost: 95, reorder: 60, sizes: ["S", "M", "L", "XL", "XXL"], colors: ["White", "Black", "Grey", "Navy"], perVariant: 60 },
    { sku: "TEE-002", name: "Oversized Tee", cat: "tees", price: 220, tier: 205, cost: 140, reorder: 40, sizes: ["M", "L", "XL", "XXL"], colors: ["Sand", "Black", "Olive"], perVariant: 40 },
    { sku: "CAP-001", name: "Snapback Cap", cat: "caps", price: 195, tier: 180, cost: 120, reorder: 24, sizes: [null], colors: ["Black", "Navy", "Grey", "White", "Red"], perVariant: 60 },
    { sku: "CAP-002", name: "Trucker Cap Mesh", cat: "caps", price: 140, tier: 130, cost: 85, reorder: 24, sizes: [null], colors: ["Black", "Khaki", "Red", "Navy"], perVariant: 52 },
    { sku: "CAP-003", name: "Bucket Hat Canvas", cat: "caps", price: 175, tier: 165, cost: 110, reorder: 20, sizes: [null], colors: ["Beige", "Black", "Olive"], perVariant: 30 },
    { sku: "HOD-001", name: "Zip Hoodie", cat: "outerwear", price: 560, tier: 530, cost: 380, reorder: 20, sizes: ["M", "L", "XL", "XXL"], colors: ["Grey", "Black", "Navy"], perVariant: 12 },
    { sku: "JOG-001", name: "Jogger Pants", cat: "bottoms", price: 390, tier: 370, cost: 260, reorder: 20, sizes: ["M", "L", "XL", "XXL"], colors: ["Black", "Grey"], perVariant: 30 },
    { sku: "JKT-001", name: "Denim Jacket", cat: "outerwear", price: 890, tier: 850, cost: 620, reorder: 8, sizes: ["S", "M", "L", "XL"], colors: [null], perVariant: 13 },
    { sku: "BAG-001", name: "Canvas Tote Bag", cat: "accessories", price: 110, tier: 100, cost: 60, reorder: 40, sizes: [null], colors: ["Natural", "Black", "Printed"], perVariant: 86 },
    { sku: "SOC-001", name: "Crew Socks 3-pack", cat: "accessories", price: 95, tier: 88, cost: 55, reorder: 50, sizes: [null], colors: ["Mixed"], perVariant: 22 },
    { sku: "BLT-001", name: "Leather-look Belt", cat: "accessories", price: 210, tier: 195, cost: 130, reorder: 12, sizes: ["S", "M", "L"], colors: ["Black", "Brown"], perVariant: 16 },
    { sku: "ACC-001", name: "Beaded Bracelet Set", cat: "accessories", price: 75, tier: 68, cost: 35, reorder: 60, sizes: [null], colors: ["Assorted"], perVariant: 410 },
  ];

  const variantIds: Record<string, number[]> = {};
  for (const d of defs) {
    const [p] = await db
      .insert(s.products)
      .values({
        sku: d.sku,
        slug: d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        name: d.name,
        categoryId: cat[d.cat],
        basePrice: d.price,
        baseCost: d.cost,
        moq: 12,
        reorderLevel: d.reorder,
      })
      .returning();

    await db.insert(s.priceTiers).values({ productId: p.id, minQty: 12, price: d.tier });

    const rows = [];
    for (const size of d.sizes) for (const color of d.colors) rows.push({ productId: p.id, size, color, stockOnHand: 0 });
    const vs = await db.insert(s.productVariants).values(rows).returning();
    variantIds[d.sku] = vs.map((v) => v.id);

    // one stock-in batch per variant, dated 20 days ago
    const supplier = d.cat === "caps" ? supB.id : supA.id;
    for (const v of vs) {
      await db.insert(s.stockBatches).values({
        variantId: v.id, supplierId: supplier, qtyReceived: d.perVariant, qtyRemaining: d.perVariant,
        unitCost: d.cost, receivedAt: daysAgo(20), reference: "SEED",
      });
      await db.insert(s.stockMovements).values({ variantId: v.id, type: "in", qty: d.perVariant, note: "Opening stock" });
      await db.update(s.productVariants).set({ stockOnHand: d.perVariant }).where(sql`${s.productVariants.id} = ${v.id}`);
    }
  }

  // --- customers ---------------------------------------------------------------
  const custs = await db
    .insert(s.customers)
    .values([
      { shopName: "Rina's Boutique", contactName: "Rina", phone: "[0917 000 0003]", email: "rina@example.com", address: "Stall 14, Baclaran Market, Parañaque", status: "approved" },
      { shopName: "JM Caps Trading", contactName: "JM", phone: "[0917 000 0004]", address: "Divisoria, Manila", status: "approved" },
      { shopName: "Kuya Ben Sportswear", contactName: "Ben", phone: "[0917 000 0005]", address: "Cebu City", status: "approved" },
      { shopName: "Manong Ed Ukay", contactName: "Ed", phone: "[0917 000 0006]", address: "Dagupan City", status: "approved" },
      { shopName: "Kaye's Closet", contactName: "Kaye", phone: "[0917 000 0007]", address: "Quezon City", status: "pending" },
    ])
    .returning();

  // --- orders ------------------------------------------------------------------
  // [customer index, days ago, status, lines: [sku, variant index, qty]]
  type Line = [string, number, number];
  const orderDefs: { c: number; days: number; status: "pending" | "confirmed" | "packed" | "delivered" | "paid"; lines: Line[] }[] = [
    { c: 0, days: 0, status: "pending", lines: [["TEE-001", 1, 24], ["CAP-001", 0, 12], ["BAG-001", 0, 12]] },
    { c: 1, days: 0, status: "pending", lines: [["CAP-001", 1, 60], ["CAP-002", 0, 60]] },
    { c: 2, days: 1, status: "confirmed", lines: [["JOG-001", 1, 20], ["HOD-001", 0, 10]] },
    { c: 3, days: 1, status: "packed", lines: [["TEE-002", 1, 12], ["TEE-001", 6, 12], ["SOC-001", 0, 6]] },
    { c: 0, days: 2, status: "paid", lines: [["TEE-001", 0, 36], ["TEE-002", 4, 24], ["CAP-001", 2, 12]] },
    { c: 1, days: 3, status: "delivered", lines: [["CAP-001", 0, 48], ["CAP-003", 1, 24]] },
    { c: 2, days: 5, status: "delivered", lines: [["HOD-001", 4, 12], ["JOG-001", 0, 24]] },
    { c: 3, days: 6, status: "delivered", lines: [["BAG-001", 2, 36], ["ACC-001", 0, 48]] },
    { c: 0, days: 9, status: "delivered", lines: [["TEE-001", 2, 48], ["BLT-001", 1, 12]] },
    { c: 1, days: 12, status: "delivered", lines: [["CAP-002", 1, 36], ["CAP-001", 3, 24]] },
    { c: 3, days: 15, status: "delivered", lines: [["JKT-001", 1, 6], ["JKT-001", 2, 6]] },
    { c: 2, days: 18, status: "delivered", lines: [["TEE-002", 0, 36], ["TEE-001", 8, 36], ["ACC-001", 0, 60]] },
  ];

  let orderSeq = 1030;
  for (const o of orderDefs) {
    orderSeq += 1;
    const lines = o.lines.map(([sku, vi, qty]) => {
      const d = defs.find((x) => x.sku === sku)!;
      const unitPrice = qty >= 12 ? d.tier : d.price;
      return { variantId: variantIds[sku][vi], qty, unitPrice, unitCost: d.cost, lineTotal: unitPrice * qty, lineProfit: (unitPrice - d.cost) * qty };
    });
    const total = lines.reduce((a, l) => a + l.lineTotal, 0);
    const packedOrLater = ["packed", "paid", "delivered"].includes(o.status);
    const paidOrLater = ["paid", "delivered"].includes(o.status);
    const deliveredOrLater = o.status === "delivered";

    const [order] = await db
      .insert(s.orders)
      .values({
        orderNo: `#${orderSeq}`,
        customerId: custs[o.c].id,
        status: o.status,
        paymentStatus: paidOrLater ? "paid" : "unpaid",
        subtotal: total,
        total,
        source: "storefront",
        requestedAt: daysAgo(o.days, 9),
        confirmedAt: o.status === "pending" ? null : daysAgo(o.days, 10),
        packedAt: packedOrLater ? daysAgo(o.days, 13) : null,
        deliveredAt: deliveredOrLater ? daysAgo(o.days, 16) : null, // payment always precedes delivery
      })
      .returning();

    await db.insert(s.orderItems).values(
      lines.map((l) => ({
        orderId: order.id,
        variantId: l.variantId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
        // cost + profit are only known once packed
        unitCost: packedOrLater ? l.unitCost : null,
        lineProfit: packedOrLater ? l.lineProfit : null,
      }))
    );

    if (packedOrLater) {
      for (const l of lines) {
        await db.insert(s.stockMovements).values({ variantId: l.variantId, type: "sale", qty: -l.qty, referenceId: order.id, note: order.orderNo });
        await db.update(s.productVariants).set({ stockOnHand: sql`${s.productVariants.stockOnHand} - ${l.qty}` }).where(sql`${s.productVariants.id} = ${l.variantId}`);
        await db.update(s.stockBatches).set({ qtyRemaining: sql`greatest(${s.stockBatches.qtyRemaining} - ${l.qty}, 0)` }).where(sql`${s.stockBatches.variantId} = ${l.variantId}`);
      }
    } else if (o.status === "confirmed") {
      for (const l of lines) {
        await db.update(s.productVariants).set({ stockReserved: sql`${s.productVariants.stockReserved} + ${l.qty}` }).where(sql`${s.productVariants.id} = ${l.variantId}`);
      }
    }
    if (paidOrLater) {
      await db.insert(s.payments).values({ orderId: order.id, amount: total, method: "bank", paidAt: daysAgo(o.days, 14) });
    }
  }

  console.log(`Seeded ${defs.length} products, ${custs.length} customers, ${orderDefs.length} orders.`);
  console.log("Logins — owner@example.com / admin123 · staff@example.com / staff123");
  console.log("WARNING: these sample passwords are public. Change them in Settings before going live.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.end());
