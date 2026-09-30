import { and, eq, gte, ilike, inArray, or, sql, countDistinct, sum } from "drizzle-orm";
import { db } from "@/db";
import { categories, orderItems, orders, productVariants, products, stockBatches } from "@/db/schema";

export type ProductRow = {
  id: number;
  sku: string;
  slug: string;
  name: string;
  category: string | null;
  categoryId: number | null;
  price: number;
  retailPrice: number | null;
  cost: number; // weighted-average cost of open stock
  stock: number;
  reorderLevel: number;
  sizes: number;
  colors: number;
  sold: number; // units sold in the window (delivered or paid orders)
  profit: number; // profit in the window
};

export type ProductFilters = { q?: string; categoryId?: number; days?: number };

export async function getProductsWithStats(filters: ProductFilters = {}): Promise<ProductRow[]> {
  const days = filters.days ?? 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  // stock + option counts per product
  const stock = db
    .select({
      productId: productVariants.productId,
      stock: sum(productVariants.stockOnHand).mapWith(Number).as("stock"),
      sizes: countDistinct(productVariants.size).as("sizes"),
      colors: countDistinct(productVariants.color).as("colors"),
    })
    .from(productVariants)
    .groupBy(productVariants.productId)
    .as("stock");

  // sales in the window per product
  const sales = db
    .select({
      productId: productVariants.productId,
      sold: sum(orderItems.qty).mapWith(Number).as("sold"),
      profit: sum(orderItems.lineProfit).mapWith(Number).as("profit"),
    })
    .from(orderItems)
    .innerJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(inArray(orders.status, ["delivered", "paid"]), gte(orders.deliveredAt, since)))
    .groupBy(productVariants.productId)
    .as("sales");

  // weighted-average cost of open batches per product
  const cost = db
    .select({
      productId: productVariants.productId,
      avgCost: sql<number>`sum(${stockBatches.qtyRemaining} * ${stockBatches.unitCost}) / nullif(sum(${stockBatches.qtyRemaining}), 0)`
        .mapWith(Number)
        .as("avg_cost"),
    })
    .from(stockBatches)
    .innerJoin(productVariants, eq(stockBatches.variantId, productVariants.id))
    .groupBy(productVariants.productId)
    .as("cost");

  const where = [eq(products.isActive, true)];
  if (filters.q) {
    const like = `%${filters.q}%`;
    where.push(or(ilike(products.name, like), ilike(products.sku, like))!);
  }
  if (filters.categoryId) where.push(eq(products.categoryId, filters.categoryId));

  const rows = await db
    .select({
      id: products.id,
      sku: products.sku,
      slug: products.slug,
      name: products.name,
      category: categories.name,
      categoryId: products.categoryId,
      price: products.basePrice,
      retailPrice: products.retailPrice,
      reorderLevel: products.reorderLevel,
      cost: sql<number>`coalesce(${cost.avgCost}, 0)`.mapWith(Number),
      stock: sql<number>`coalesce(${stock.stock}, 0)`.mapWith(Number),
      sizes: sql<number>`coalesce(${stock.sizes}, 0)`.mapWith(Number),
      colors: sql<number>`coalesce(${stock.colors}, 0)`.mapWith(Number),
      sold: sql<number>`coalesce(${sales.sold}, 0)`.mapWith(Number),
      profit: sql<number>`coalesce(${sales.profit}, 0)`.mapWith(Number),
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(stock, eq(stock.productId, products.id))
    .leftJoin(sales, eq(sales.productId, products.id))
    .leftJoin(cost, eq(cost.productId, products.id))
    .where(and(...where))
    .orderBy(products.name);

  return rows;
}

export async function getCategories() {
  return db.select().from(categories).orderBy(categories.sortOrder, categories.name);
}
