import Link from "next/link";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { peso } from "@/lib/format";

/** Sticky bottom bar on phones: what's in the cart and a jump to it. Hidden on md+ (header cart button covers it). */
export function MobileCartBar({ base, lines, units, subtotal }: { base: string; lines: number; units: number; subtotal: number }) {
  if (lines === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      <Link href={`${base}/cart`} className="flex h-12 items-center gap-3 rounded-xl bg-zinc-900 px-4 text-white">
        <ShoppingCart className="size-5" />
        <span className="text-sm font-bold">
          {lines} {lines === 1 ? "line" : "lines"} · {units} pcs
        </span>
        <span className="ml-auto text-sm font-extrabold tabular-nums">{peso(subtotal)}</span>
        <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
