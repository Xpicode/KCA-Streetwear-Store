"use client";

import { ShoppingCart } from "lucide-react";
import { cartDrawer } from "@/lib/cart-drawer";

/** Header cart button: opens the slide-in cart instead of changing page. */
export function CartButton({ count }: { count: number }) {
  return (
    <button
      type="button"
      onClick={cartDrawer.toggle}
      aria-label="Open cart"
      className="flex h-10 items-center gap-2 rounded-lg bg-zinc-900 px-3 text-sm font-bold text-white sm:px-4"
    >
      <ShoppingCart className="size-4" />
      <span className="hidden sm:inline">Cart</span>
      {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px]">{count}</span>}
    </button>
  );
}
