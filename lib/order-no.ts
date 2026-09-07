import { sql } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";

/** Sequential order numbers like "#1043". Call inside the transaction that inserts the order. */
export async function nextOrderNo(tx: Pick<typeof db, "select"> = db) {
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(cast(ltrim(${orders.orderNo}, '#') as integer)), 1000)`.mapWith(Number) })
    .from(orders);
  return `#${row.max + 1}`;
}
