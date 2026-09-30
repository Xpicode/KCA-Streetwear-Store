import { notFound } from "next/navigation";
import { channelFromSlug } from "@/lib/channel";
import { getShopper } from "@/lib/shopper";
import { readCart, cartCount } from "@/lib/cart";
import { ShopHeader } from "@/components/shop/header";

/** /shop (wholesale) and /retail share every storefront page; anything else under [channel] is a 404. */
export default async function ShopLayout({ children, params }: { children: React.ReactNode; params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const channel = channelFromSlug(slug);
  if (!channel) notFound();
  const [shopper, cart] = await Promise.all([getShopper(channel.key), readCart(channel.key)]);
  return (
    <div className="theme-zone min-h-screen bg-white text-zinc-900">
      <ShopHeader channel={channel.key} shopper={shopper} cartCount={cartCount(cart)} />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
