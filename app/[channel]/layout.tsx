import { notFound } from "next/navigation";
import { Anton } from "next/font/google";
import { channelFromSlug } from "@/lib/channel";
import { getShopper, getShopperPriceGroup } from "@/lib/shopper";
import { readCart, cartCount } from "@/lib/cart";
import { ShopHeader } from "@/components/shop/header";
import { CartDrawer } from "@/components/shop/cart-drawer";
import { getCartLines } from "@/lib/queries/catalog";

// display face for the retail catalog (see --font-display in globals.css)
const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton" });

/** /shop (wholesale) and /retail share every storefront page; anything else under [channel] is a 404. */
export default async function ShopLayout({ children, params }: { children: React.ReactNode; params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const channel = channelFromSlug(slug);
  if (!channel) notFound();
  const [shopper, cart, priceGroup] = await Promise.all([getShopper(channel.key), readCart(channel.key), getShopperPriceGroup(channel.key)]);
  const summary = await getCartLines(cart, priceGroup, channel.key);
  return (
    <div className={`${display.variable} theme-zone min-h-screen bg-white text-zinc-900`}>
      <ShopHeader channel={channel.key} shopper={shopper} cartCount={cartCount(cart)} />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      <CartDrawer channel={channel.key} summary={summary} />
    </div>
  );
}
