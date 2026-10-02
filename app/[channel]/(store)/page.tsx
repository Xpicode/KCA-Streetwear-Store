import { notFound } from "next/navigation";
import { channelFromSlug } from "@/lib/channel";
import { getShopperPriceGroup } from "@/lib/shopper";
import { readCart } from "@/lib/cart";
import { getCartLines, getCatalog, getShopCategories } from "@/lib/queries/catalog";
import { MobileCartBar } from "@/components/shop/mobile-cart-bar";
import { StoreCatalog } from "@/components/shop/store-catalog";

export const dynamic = "force-dynamic";

type Params = Promise<{ channel: string }>;
type SearchParams = Promise<{ q?: string; category?: string }>;

export default async function CatalogPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ channel: slug }, { q, category }] = await Promise.all([params, searchParams]);
  const channel = channelFromSlug(slug);
  if (!channel) notFound();
  const priceGroup = await getShopperPriceGroup(channel.key);
  const cart = await readCart(channel.key);
  const [products, categories, cartSummary] = await Promise.all([
    getCatalog({ q, category, priceGroup, channel: channel.key }),
    getShopCategories(channel.key),
    getCartLines(cart, priceGroup, channel.key),
  ]);

  return (
    <>
      <StoreCatalog channel={channel.key} products={products} categories={categories} active={category} q={q} />
      <MobileCartBar lines={cartSummary.lines.length} units={cartSummary.units} subtotal={cartSummary.subtotal} />
    </>
  );
}
