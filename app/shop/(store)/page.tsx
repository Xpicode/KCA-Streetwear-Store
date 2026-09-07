import { getShopperPriceGroup } from "@/lib/shopper";
import { readCart } from "@/lib/cart";
import { getCartLines, getCatalog, getShopCategories } from "@/lib/queries/catalog";
import { CatalogFilters } from "@/components/shop/catalog-filters";
import { ProductCard } from "@/components/shop/product-card";
import { MobileCartBar } from "@/components/shop/mobile-cart-bar";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; category?: string }>;

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const { q, category } = await searchParams;
  const priceGroup = await getShopperPriceGroup();
  const cart = await readCart();
  const [products, categories, cartSummary] = await Promise.all([
    getCatalog({ q, category, priceGroup: priceGroup }),
    getShopCategories(),
    getCartLines(cart, priceGroup),
  ]);
  const activeCategory = categories.find((c) => c.slug === category);
  const moq = products[0]?.moq ?? 12;

  return (
    <div className="flex flex-col gap-5 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{activeCategory ? activeCategory.name : "Catalog"}</h1>
        <p className="text-sm font-medium text-zinc-500">
          {q ? (
            <>
              {products.length} {products.length === 1 ? "result" : "results"} for “{q}”
            </>
          ) : (
            <>Wholesale prices · minimum {moq} pcs per style, mix sizes and colors</>
          )}
        </p>
      </div>

      <CatalogFilters categories={categories} active={category} q={q} />

      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
          <p className="text-sm font-bold">Nothing matched.</p>
          <p className="mt-1 text-sm font-medium text-zinc-500">Try another word, or clear the filters to see everything.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} inCart={cart} />
          ))}
        </div>
      )}

      <MobileCartBar lines={cartSummary.lines.length} units={cartSummary.units} subtotal={cartSummary.subtotal} />
    </div>
  );
}
