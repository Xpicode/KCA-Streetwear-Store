/** Minimal rows for integration tests. Every test starts from an empty database. */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, priceTiers, productVariants, products, stockBatches, users } from "@/db/schema";

export async function resetDb() {
  await db.execute(sql`
    truncate table payments, order_items, orders, stock_movements, stock_batches,
      price_tiers, product_variants, products, categories, suppliers, customers, users,
      login_attempts
    restart identity cascade
  `);
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

/**
 * One staff user, an approved + a blocked customer, and a product "Tee" (base ₱100, MOQ 5)
 * with two variants:
 *   - tee.id        active, 20 on hand from two batches: 10 @ ₱50 (older) then 10 @ ₱70
 *   - tee.inactive  inactive
 * Price tiers: 10+ pcs → ₱90 for everyone; 5+ pcs → ₱80 for the "vip" price group.
 */
export async function seedBasics() {
  const [user] = await db.insert(users).values({ name: "Staff", email: "staff@test.local", passwordHash: "x", role: "staff" }).returning({ id: users.id });
  const [customer] = await db.insert(customers).values({ shopName: "Test Shop", status: "approved" }).returning({ id: customers.id });
  const [vip] = await db.insert(customers).values({ shopName: "VIP Shop", status: "approved", priceGroup: "vip" }).returning({ id: customers.id });
  const [blocked] = await db.insert(customers).values({ shopName: "Blocked Shop", status: "blocked" }).returning({ id: customers.id });

  const [tee] = await db
    .insert(products)
    .values({ sku: "TEE", slug: "tee", name: "Tee", basePrice: 100, baseCost: 50, unit: "pc", moq: 5, reorderLevel: 0, isActive: true })
    .returning({ id: products.id });
  const [active] = await db
    .insert(productVariants)
    .values({ productId: tee.id, size: "M", color: null, stockOnHand: 20, stockReserved: 0, isActive: true })
    .returning({ id: productVariants.id });
  const [inactive] = await db
    .insert(productVariants)
    .values({ productId: tee.id, size: "XL", color: null, stockOnHand: 0, stockReserved: 0, isActive: false })
    .returning({ id: productVariants.id });
  await db.insert(stockBatches).values([
    { variantId: active.id, qtyReceived: 10, qtyRemaining: 10, unitCost: 50, receivedAt: daysAgo(10) },
    { variantId: active.id, qtyReceived: 10, qtyRemaining: 10, unitCost: 70, receivedAt: daysAgo(2) },
  ]);
  await db.insert(priceTiers).values([
    { productId: tee.id, minQty: 10, price: 90, priceGroup: null },
    { productId: tee.id, minQty: 5, price: 80, priceGroup: "vip" },
  ]);

  return {
    userId: user.id,
    customerId: customer.id,
    vipCustomerId: vip.id,
    blockedCustomerId: blocked.id,
    productId: tee.id,
    variantId: active.id,
    inactiveVariantId: inactive.id,
  };
}
