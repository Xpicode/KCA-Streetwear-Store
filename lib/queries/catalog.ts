/**
 * Storefront reads: catalog cards, product detail, and the cart joined to live catalog data.
 * Prices are always computed here from the catalog (never from the cookie).
 */
import "server-only";
import { and, eq, ilike, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { categories, priceTiers, productVariants, products } from "@/db/schema";
import { unitPriceFor, type Tier } from "@/lib/pricing";
import type { Cart } from "@/lib/cart";
import { variantLabel, variantSummary } from "@/components/shop/variant-label";

export type CatalogVariant = {
  id: number;
  size: string | null;
  color: string | null;
  priceOverride: number | null;
  available: number; // on_hand − reserved, never below 0
};

export type CatalogProduct = {
  id: number;
  slug: string;
  name: string;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  categorySlug: string | null;
  basePrice: number;
  moq: number;
  unit: string;
  tiers: Tier[]; // only tiers this customer's price group can use
  variants: CatalogVariant[]; // active only
  available: number; // sum over variants
};

export { variantLabel, variantSummary };

function tiersFor(rows: { minQty: number; price: number; priceGroup: string | null }[], priceGroup: string): Tier[] {
  return rows
    .filter((t) => t.priceGroup == null || t.priceGroup === priceGroup)
    .map((t) => ({ minQty: t.minQty, price: t.price, priceGroup: t.priceGroup }))
    .sort((a, b) => a.minQty - b.minQty);
}

type RawProduct = {
  id: number;
  slug: string;
  name: string;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  moq: number;
  unit: string;
  category: { name: string; slug: string } | null;
  variants: { id: number; size: string | null; color: string | null; priceOverride: number | null; stockOnHand: number; stockReserved: number; isActive: boolean }[];
  tiers: { minQty: number; price: number; priceGroup: string | null }[];
};

function shape(p: RawProduct, priceGroup: string): CatalogProduct | null {
  const variants = p.variants
    .filter((v) => v.isActive)
    .map((v) => ({
      id: v.id,
      size: v.size,
      color: v.color,
      priceOverride: v.priceOverride,
      available: Math.max(0, v.stockOnHand - v.stockReserved),
    }))
    .sort((a, b) => a.id - b.id);
  if (variants.length === 0) return null;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    sku: p.sku,
    description: p.description,
    imageUrl: p.imageUrl,
    category: p.category?.name ?? null,
    categorySlug: p.category?.slug ?? null,
    basePrice: p.basePrice,
    moq: p.moq,
    unit: p.unit,
    tiers: tiersFor(p.tiers, priceGroup),
    variants,
    available: variants.reduce((a, v) => a + v.available, 0),
  };
}

export type CatalogFilters = { q?: string; category?: string; priceGroup: string };

/** Active products that have at least one active variant, for the catalog grid. */
export async function getCatalog(f: CatalogFilters): Promise<CatalogProduct[]> {
  const where = [eq(products.isActive, true)];
  if (f.q?.trim()) {
    const like = `%${f.q.trim()}%`;
    where.push(or(ilike(products.name, like), ilike(products.sku, like), ilike(products.description, like))!);
  }
  if (f.category) {
    const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, f.category)).limit(1);
    if (!cat) return [];
    where.push(eq(products.categoryId, cat.id));
  }
  const rows = await db.query.products.findMany({
    where: and(...where),
    with: { category: true, variants: true, tiers: true },
    orderBy: (p, { asc }) => [asc(p.name)],
  });
  return rows.map((r) => shape(r, f.priceGroup)).filter((p): p is CatalogProduct => p !== null);
}

export async function getProductBySlug(slug: string, priceGroup: string): Promise<CatalogProduct | null> {
  const row = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.isActive, true)),
    with: { category: true, variants: true, tiers: true },
  });
  return row ? shape(row, priceGroup) : null;
}

export async function getShopCategories() {
  return db.select({ id: categories.id, name: categories.name, slug: categories.slug }).from(categories).orderBy(categories.sortOrder, categories.name);
}

// ---- cart joined to the catalog ---------------------------------------------

export type CartLine = {
  variantId: number;
  productId: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  category: string | null;
  categorySlug: string | null;
  variant: string; // "Black · M"
  qty: number;
  moq: number;
  available: number;
  unitPrice: number;
  basePrice: number;
  tierApplied: boolean; // unit price is below base thanks to a tier
  nextTier: { minQty: number; price: number } | null;
  lineTotal: number;
  /** Total qty for this product across all cart lines (MOQ is per style). */
  styleQty: number;
  problems: string[];
};

export type CartSummary = {
  lines: CartLine[];
  subtotal: number;
  units: number;
  problems: string[]; // distinct, human readable
  ok: boolean;
};

/** Join the cookie cart to live data. Lines whose variant/product vanished or went inactive are dropped. */
export async function getCartLines(cart: Cart, priceGroup: string): Promise<CartSummary> {
  const ids = Object.keys(cart).map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return { lines: [], subtotal: 0, units: 0, problems: [], ok: true };

  const rows = await db
    .select({
      variantId: productVariants.id,
      size: productVariants.size,
      color: productVariants.color,
      priceOverride: productVariants.priceOverride,
      stockOnHand: productVariants.stockOnHand,
      stockReserved: productVariants.stockReserved,
      productId: products.id,
      slug: products.slug,
      name: products.name,
      imageUrl: products.imageUrl,
      basePrice: products.basePrice,
      moq: products.moq,
      category: categories.name,
      categorySlug: categories.slug,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(inArray(productVariants.id, ids), eq(productVariants.isActive, true), eq(products.isActive, true)));

  const productIds = [...new Set(rows.map((r) => r.productId))];
  const tierRows = productIds.length
    ? await db.select().from(priceTiers).where(inArray(priceTiers.productId, productIds))
    : [];
  const tiersByProduct = new Map<number, Tier[]>();
  for (const pid of productIds) tiersByProduct.set(pid, tiersFor(tierRows.filter((t) => t.productId === pid), priceGroup));

  // qty per style (product) — MOQ is per style, mixed sizes/colours allowed
  const styleQty = new Map<number, number>();
  for (const r of rows) styleQty.set(r.productId, (styleQty.get(r.productId) ?? 0) + cart[String(r.variantId)]);

  const lines: CartLine[] = rows
    .map((r) => {
      const qty = cart[String(r.variantId)];
      const tiers = tiersByProduct.get(r.productId) ?? [];
      const sQty = styleQty.get(r.productId) ?? qty;
      // tier is judged on the style total, so 6 black + 6 white tees still unlock the 12+ price
      const unitPrice = unitPriceFor({ basePrice: r.basePrice, priceOverride: r.priceOverride, tiers, qty: sQty, priceGroup });
      const base = r.priceOverride ?? r.basePrice;
      const available = Math.max(0, r.stockOnHand - r.stockReserved);
      const next = tiers.filter((t) => t.minQty > sQty && t.price < unitPrice).sort((a, b) => a.minQty - b.minQty)[0] ?? null;
      const problems: string[] = [];
      if (sQty < r.moq) problems.push(`Minimum ${r.moq} pcs for this style (you have ${sQty})`);
      if (qty > available) problems.push(available === 0 ? "Out of stock right now" : `Only ${available} available`);
      return {
        variantId: r.variantId,
        productId: r.productId,
        slug: r.slug,
        name: r.name,
        imageUrl: r.imageUrl,
        category: r.category,
        categorySlug: r.categorySlug,
        variant: variantLabel(r),
        qty,
        moq: r.moq,
        available,
        unitPrice,
        basePrice: base,
        tierApplied: unitPrice < base,
        nextTier: next ? { minQty: next.minQty, price: next.price } : null,
        lineTotal: unitPrice * qty,
        styleQty: sQty,
        problems,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.variantId - b.variantId);

  const problems = [...new Set(lines.flatMap((l) => l.problems.map((p) => `${l.name}: ${p}`)))];
  return {
    lines,
    subtotal: lines.reduce((a, l) => a + l.lineTotal, 0),
    units: lines.reduce((a, l) => a + l.qty, 0),
    problems,
    ok: problems.length === 0,
  };
}
