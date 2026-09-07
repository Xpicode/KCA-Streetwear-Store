import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getShopperPriceGroup } from "@/lib/shopper";
import { readCart } from "@/lib/cart";
import { getProductBySlug } from "@/lib/queries/catalog";
import { ProductImage, StockBadge } from "@/components/shop/product-image";
import { variantSummary } from "@/components/shop/variant-label";
import { peso } from "@/lib/format";
import { tierRanges } from "@/components/shop/tiers";
import { PurchasePanel } from "./purchase-panel";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const priceGroup = await getShopperPriceGroup();
  const [product, cart] = await Promise.all([getProductBySlug(slug, priceGroup), readCart()]);
  if (!product) notFound();
  const ranges = tierRanges(product.basePrice, product.tiers);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={product.categorySlug ? `/shop?category=${product.categorySlug}` : "/shop"}
        className="inline-flex items-center gap-1 text-sm font-bold text-zinc-500 hover:text-zinc-900"
      >
        <ChevronLeft className="size-4" /> {product.category ?? "Catalog"}
      </Link>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] lg:gap-10">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 lg:aspect-square">
          <ProductImage name={product.name} imageUrl={product.imageUrl} categorySlug={product.categorySlug} textClass="text-7xl" />
          <StockBadge available={product.available} moq={product.moq} className="absolute top-3 left-3" />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase">
              {product.category ?? "Product"} · {product.sku}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{product.name}</h1>
            <p className="mt-1 text-sm font-medium text-zinc-500">
              {variantSummary(product.variants)} · {product.available} pcs available · min {product.moq} per style
            </p>
            {product.description && <p className="mt-3 text-sm leading-relaxed font-medium text-zinc-700">{product.description}</p>}
          </div>

          <PurchasePanel product={product} priceGroup={priceGroup} inCart={cart} />

          <div className="rounded-xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-4 py-2.5 text-[11px] font-bold tracking-wider text-zinc-500 uppercase">Wholesale pricing</div>
            <table className="w-full text-sm tabular-nums">
              <tbody className="divide-y divide-zinc-100">
                {ranges.map((r) => (
                  <tr key={r.from}>
                    <td className="px-4 py-2 font-semibold text-zinc-700">{r.label}</td>
                    <td className="px-4 py-2 text-right font-extrabold">
                      {peso(r.price)} <span className="text-xs font-medium text-zinc-500">/{product.unit}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-2.5 text-xs font-medium text-zinc-500">
              Tier price counts every size and color of this style together. Prices are confirmed when we check stock.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
