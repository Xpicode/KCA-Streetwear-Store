import { and, count, desc, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, orderItems, orders, productVariants, products } from "@/db/schema";
import { onShelf } from "@/lib/queries/catalog";

/** The main page shows everything a customer can buy, in either store. */
const inAnyStore = () => or(onShelf("wholesale"), onShelf("retail"))!;
/** Not in the wholesale store, so its links and price are the retail ones. */
const retailOnly = sql<boolean>`${products.showIn} = 'retail'`;

/** Live numbers for the landing page. Every query is safe on an empty database. */
export async function getLandingData() {
  const [cats, featured, [stats]] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        products: count(products.id),
        // a category with nothing in the wholesale store opens in the retail store
        retailOnly: sql<boolean>`coalesce(bool_and(${retailOnly}), false)`,
      })
      .from(categories)
      .leftJoin(products, and(eq(products.categoryId, categories.id), inAnyStore()))
      .groupBy(categories.id)
      .orderBy(categories.sortOrder, categories.name),
    // best sellers by units in delivered/paid orders, falling back to newest products
    db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        category: categories.name,
        price: sql<number>`case when ${retailOnly} then ${products.retailPrice} else ${products.basePrice} end`.mapWith(Number),
        retailOnly,
        imageUrl: products.imageUrl,
        stock: sql<number>`(select coalesce(sum(v.stock_on_hand - v.stock_reserved), 0) from product_variants v where v.product_id = ${products.id})`.mapWith(Number),
        sold: sql<number>`coalesce(sum(case when ${orders.status} in ('delivered','paid') then ${orderItems.qty} end), 0)`.mapWith(Number),
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(productVariants, eq(productVariants.productId, products.id))
      .leftJoin(orderItems, eq(orderItems.variantId, productVariants.id))
      .leftJoin(orders, eq(orderItems.orderId, orders.id))
      .where(inAnyStore())
      .groupBy(products.id, categories.name)
      .orderBy(desc(sql`coalesce(sum(case when ${orders.status} in ('delivered','paid') then ${orderItems.qty} end), 0)`), desc(products.createdAt))
      .limit(8),
    db
      .select({
        styles: count(products.id),
        // MOQ is a wholesale rule: retail-only products (always 1 pc) don't count
        minMoq: sql<number>`coalesce(min(${products.moq}) filter (where not ${retailOnly}), 12)`.mapWith(Number),
      })
      .from(products)
      .where(eq(products.isActive, true)),
  ]);
  return { cats, featured, stats };
}
