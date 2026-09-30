/**
 * Sample catalog shared by `db:seed` (local, wipes everything) and
 * `db:sample-products` (additive, safe on a real database).
 */
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "./schema";

export const SAMPLE_CATEGORIES = [
  { name: "Tees", slug: "tees", sortOrder: 1 },
  { name: "Caps", slug: "caps", sortOrder: 2 },
  { name: "Outerwear", slug: "outerwear", sortOrder: 3 },
  { name: "Bottoms", slug: "bottoms", sortOrder: 4 },
  { name: "Accessories", slug: "accessories", sortOrder: 5 },
];

export const SAMPLE_SUPPLIERS = [
  { name: "Divisoria Garments Trading", phone: "[0917 000 0001]" },
  { name: "Metro Caps Supply", phone: "[0917 000 0002]" },
];

export type SampleProduct = {
  sku: string; name: string; cat: string; price: number; tier: number; cost: number;
  reorder: number; sizes: (string | null)[]; colors: (string | null)[]; perVariant: number;
};

export const SAMPLE_PRODUCTS: SampleProduct[] = [
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

export const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

type Db = PostgresJsDatabase<typeof s>;

/**
 * Inserts one sample product with its tier, variants and opening stock.
 * Returns the variant ids in sizes × colors order.
 */
export async function insertSampleProduct(
  db: Db,
  d: SampleProduct,
  ids: { categoryId: number; supplierId: number },
  receivedAt: Date
): Promise<number[]> {
  const [p] = await db
    .insert(s.products)
    .values({
      sku: d.sku,
      slug: slugify(d.name),
      name: d.name,
      categoryId: ids.categoryId,
      basePrice: d.price,
      retailPrice: Math.round(d.price * 1.6), // sample retail price: wholesale + 60%
      baseCost: d.cost,
      moq: 12,
      reorderLevel: d.reorder,
    })
    .returning();

  await db.insert(s.priceTiers).values({ productId: p.id, minQty: 12, price: d.tier });

  const rows = [];
  for (const size of d.sizes) for (const color of d.colors) rows.push({ productId: p.id, size, color, stockOnHand: 0 });
  const vs = await db.insert(s.productVariants).values(rows).returning();

  for (const v of vs) {
    await db.insert(s.stockBatches).values({
      variantId: v.id, supplierId: ids.supplierId, qtyReceived: d.perVariant, qtyRemaining: d.perVariant,
      unitCost: d.cost, receivedAt, reference: "SAMPLE",
    });
    await db.insert(s.stockMovements).values({ variantId: v.id, type: "in", qty: d.perVariant, note: "Opening stock" });
    await db.update(s.productVariants).set({ stockOnHand: d.perVariant }).where(sql`${s.productVariants.id} = ${v.id}`);
  }
  return vs.map((v) => v.id);
}
