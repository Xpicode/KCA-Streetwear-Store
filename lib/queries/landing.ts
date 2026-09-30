import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, orderItems, orders, productVariants, products } from "@/db/schema";

/** Live numbers for the landing page. Every query is safe on an empty database. */
export async function getLandingData() {
  const [cats, featured, [stats]] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        products: count(products.id),
      })
      .from(categories)
      .leftJoin(products, and(eq(products.categoryId, categories.id), eq(products.isActive, true)))
      .groupBy(categories.id)
      .orderBy(categories.sortOrder, categories.name),
    // best sellers by units in delivered/paid orders, falling back to newest products
    db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        category: categories.name,
        price: products.basePrice,
        imageUrl: products.imageUrl,
        sold: sql<number>`coalesce(sum(case when ${orders.status} in ('delivered','paid') then ${orderItems.qty} end), 0)`.mapWith(Number),
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(productVariants, eq(productVariants.productId, products.id))
      .leftJoin(orderItems, eq(orderItems.variantId, productVariants.id))
      .leftJoin(orders, eq(orderItems.orderId, orders.id))
      .where(eq(products.isActive, true))
      .groupBy(products.id, categories.name)
      .orderBy(desc(sql`coalesce(sum(case when ${orders.status} in ('delivered','paid') then ${orderItems.qty} end), 0)`), desc(products.createdAt))
      .limit(8),
    db
      .select({
        styles: count(products.id),
        minMoq: sql<number>`coalesce(min(${products.moq}), 12)`.mapWith(Number),
      })
      .from(products)
      .where(eq(products.isActive, true)),
  ]);
  return { cats, featured, stats };
}
