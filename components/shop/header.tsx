import Link from "next/link";
import { Search, PackageSearch, ArrowLeftRight } from "lucide-react";
import type { Shopper } from "@/lib/shopper";
import { CHANNELS, otherChannel, type Channel } from "@/lib/channel";
import { BRAND } from "@/lib/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { CartButton } from "./cart-button";

export function ShopHeader({ channel, shopper, cartCount }: { channel: Channel; shopper: Shopper | null; cartCount: number }) {
  const { base } = CHANNELS[channel];
  const other = otherChannel(channel);
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" className="shrink-0 font-extrabold">
          {BRAND.name}
        </Link>

        <form action={base} className="hidden h-10 w-96 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 md:flex">
          <Search className="size-4 text-zinc-500" />
          <input name="q" placeholder="Search tees, caps, bags…" className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-zinc-400" />
        </form>

        <div className="flex-1" />

        <div className="flex items-center gap-3 text-sm font-semibold text-zinc-600 sm:gap-5">
          <Link href={other.base} title={`Switch to the ${other.label.toLowerCase()} store`} className="hidden items-center gap-1.5 whitespace-nowrap hover:text-zinc-900 lg:flex">
            <ArrowLeftRight className="size-4" />
            {other.label}
          </Link>
          <Link href={`${base}/orders`} className="flex items-center gap-1.5 whitespace-nowrap hover:text-zinc-900">
            <PackageSearch className="size-4 sm:hidden" />
            <span className="hidden sm:inline">My orders</span>
          </Link>
          {shopper && (
            <span className="hidden items-center gap-2 lg:flex" title="Remembered from your last order">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-50 text-[11px] font-extrabold text-brand-800">
                {shopper.shopName.slice(0, 2).toUpperCase()}
              </span>
              <span className="max-w-40 truncate">{shopper.shopName}</span>
            </span>
          )}
          <ThemeToggle className="hidden sm:flex" />
          <CartButton count={cartCount} />
        </div>
      </div>
    </header>
  );
}
