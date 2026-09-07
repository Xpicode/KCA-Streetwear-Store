import { asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, orders, products, stockMovements, users } from "@/db/schema";

export async function getCategoriesWithCounts() {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      sortOrder: categories.sortOrder,
      products: count(products.id),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

export async function getStaffUsers() {
  const handled = db
    .select({ userId: orders.handledBy, handledN: count().as("handled_n") })
    .from(orders)
    .groupBy(orders.handledBy)
    .as("handled");
  const moved = db
    .select({ userId: stockMovements.createdBy, movedN: count().as("moved_n") })
    .from(stockMovements)
    .groupBy(stockMovements.createdBy)
    .as("moved");
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      ordersHandled: sql<number>`coalesce(${handled.handledN}, 0)`.mapWith(Number),
      movements: sql<number>`coalesce(${moved.movedN}, 0)`.mapWith(Number),
    })
    .from(users)
    .leftJoin(handled, eq(handled.userId, users.id))
    .leftJoin(moved, eq(moved.userId, users.id))
    .orderBy(sql`case ${users.role} when 'owner' then 0 else 1 end`, asc(users.name));
}
