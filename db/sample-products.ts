/**
 * Adds the sample catalog (categories, suppliers, products with stock) to whatever database
 * .env.local points at, WITHOUT touching anything already there:
 *   npm run db:sample-products
 * Categories and suppliers are matched by slug / name; a product whose SKU already exists is
 * skipped. Delete the sample products in the admin when you have your real catalog.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, inArray } from "drizzle-orm";
import { loadEnvLocal } from "./env";
import * as s from "./schema";
import { insertSampleProduct, SAMPLE_CATEGORIES, SAMPLE_PRODUCTS, SAMPLE_SUPPLIERS } from "./sample-data";

loadEnvLocal();
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing — create .env.local first");

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema: s });

async function main() {
  console.log("Connecting to", url!.replace(/:\/\/([^:]+):[^@]*@/, "://$1:***@"));

  await db.insert(s.categories).values(SAMPLE_CATEGORIES).onConflictDoNothing({ target: s.categories.slug });
  const cats = await db.select().from(s.categories).where(inArray(s.categories.slug, SAMPLE_CATEGORIES.map((c) => c.slug)));
  const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  const supplierId: Record<string, number> = {};
  for (const sup of SAMPLE_SUPPLIERS) {
    const [found] = await db.select({ id: s.suppliers.id }).from(s.suppliers).where(eq(s.suppliers.name, sup.name));
    supplierId[sup.name] = found?.id ?? (await db.insert(s.suppliers).values(sup).returning())[0].id;
  }

  const existing = new Set(
    (await db.select({ sku: s.products.sku }).from(s.products).where(inArray(s.products.sku, SAMPLE_PRODUCTS.map((p) => p.sku)))).map((p) => p.sku)
  );
  let added = 0;
  for (const d of SAMPLE_PRODUCTS) {
    if (existing.has(d.sku)) {
      console.log(`skip ${d.sku} (already exists)`);
      continue;
    }
    const supplier = d.cat === "caps" ? SAMPLE_SUPPLIERS[1].name : SAMPLE_SUPPLIERS[0].name;
    await insertSampleProduct(db, d, { categoryId: catId[d.cat], supplierId: supplierId[supplier] }, new Date());
    console.log(`added ${d.sku} ${d.name}`);
    added++;
  }
  console.log(`Done: ${added} sample products added, ${existing.size} skipped.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => client.end());
