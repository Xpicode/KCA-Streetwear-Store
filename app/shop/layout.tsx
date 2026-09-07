import { getShopper } from "@/lib/shopper";
import { readCart, cartCount } from "@/lib/cart";
import { ShopHeader } from "@/components/shop/header";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [shopper, cart] = await Promise.all([getShopper(), readCart()]);
  return (
    <div className="theme-zone min-h-screen bg-white text-zinc-900">
      <ShopHeader shopper={shopper} cartCount={cartCount(cart)} />
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
