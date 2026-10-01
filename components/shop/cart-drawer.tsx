"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight, AlertTriangle, ShoppingBag, X } from "lucide-react";
import type { CartSummary } from "@/lib/queries/catalog";
import { CHANNELS, type Channel } from "@/lib/channel";
import { cartDrawer, useCartDrawer } from "@/lib/cart-drawer";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CartLineRow } from "./cart-line";

/** Slide-in cart on the right. Opens from the header button, the phone cart bar and after "add to cart". */
export function CartDrawer({ channel, summary }: { channel: Channel; summary: CartSummary }) {
  const open = useCartDrawer();
  const pathname = usePathname();
  const { base } = CHANNELS[channel];
  const { lines, subtotal, units, ok, problems } = summary;

  // close on navigation, Escape, and lock page scroll while open
  useEffect(() => cartDrawer.close(), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cartDrawer.close();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className={cn("fixed inset-0 z-40", open ? "" : "pointer-events-none")} aria-hidden={!open}>
      <button
        type="button"
        aria-label="Close cart"
        onClick={cartDrawer.close}
        className={cn("absolute inset-0 bg-zinc-950/40 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
      />
      <aside
        role="dialog"
        aria-label="Your cart"
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-5">
          <h2 className="text-[15px] font-extrabold">
            Your cart{" "}
            <span className="font-medium text-zinc-500">
              · {lines.length} {lines.length === 1 ? "line" : "lines"} · {units} pcs
            </span>
          </h2>
          <button type="button" onClick={cartDrawer.close} aria-label="Hide cart" className="flex size-9 items-center justify-center rounded-lg hover:bg-zinc-100">
            <X className="size-5" />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
              <ShoppingBag className="size-6" />
            </div>
            <p className="text-sm font-bold">Your cart is empty</p>
            <p className="text-sm font-medium text-zinc-500">Add something from the store and it shows up here.</p>
            <button type="button" onClick={cartDrawer.close} className="mt-2 h-10 rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white">
              Keep browsing
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-zinc-100 overflow-y-auto">
              {lines.map((l) => (
                <CartLineRow key={l.variantId} channel={channel} line={l} />
              ))}
            </ul>
            <div className="flex flex-col gap-3 border-t border-zinc-200 p-5">
              {!ok && (
                <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
                  <p className="mb-1 flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="size-3.5" /> Fix these before sending
                  </p>
                  <ul className="list-disc pl-4">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex items-baseline justify-between tabular-nums">
                <span className="text-sm font-medium text-zinc-600">Estimated · delivery confirmed later</span>
                <span className="text-lg font-extrabold">{peso(subtotal)}</span>
              </div>
              <Link
                href={`${base}/checkout`}
                aria-disabled={!ok}
                tabIndex={ok ? 0 : -1}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-bold text-white",
                  ok ? "bg-brand-700 hover:bg-brand-800" : "pointer-events-none bg-zinc-300"
                )}
              >
                Send order request <ArrowRight className="size-4" />
              </Link>
              <div className="flex items-center justify-between text-sm font-bold text-zinc-600">
                <button type="button" onClick={cartDrawer.close} className="hover:text-zinc-900">
                  Keep browsing
                </button>
                <Link href={`${base}/cart`} className="hover:text-zinc-900">
                  Open full cart
                </Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
