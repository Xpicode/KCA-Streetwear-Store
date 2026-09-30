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
import { insertSampleProduct, SAMPLE_CATEGORIES, SAMPLE_PRODUCTS, SAMPLE_SUPPLIERS } from "./sample-data";

loadEnvLocal();
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing — create .env.local first");

// Seeding wipes every table and installs well-known sample passwords, so it refuses to run
// against anything that doesn't look like a local database unless you override on purpose.
const dbHost = (() => {
  try {
    return new URL(url).hostname;
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

const client = postgres(url, { max: 1 });
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
  const cats = await db.insert(s.categories).values(SAMPLE_CATEGORIES).returning();
  const cat = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  // --- suppliers ---------------------------------------------------------------
  const [supA, supB] = await db.insert(s.suppliers).values(SAMPLE_SUPPLIERS).returning();

  // --- products + variants + tiers -------------------------------------------
  const defs = SAMPLE_PRODUCTS;
  const variantIds: Record<string, number[]> = {};
  for (const d of defs) {
    // one stock-in batch per variant, dated 20 days ago
    const supplierId = d.cat === "caps" ? supB.id : supA.id;
    variantIds[d.sku] = await insertSampleProduct(db, d, { categoryId: cat[d.cat], supplierId }, daysAgo(20));
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
