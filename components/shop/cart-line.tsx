"use client";

/* eslint-disable @next/next/no-img-element -- photos are plain uploads; placeholder art is local */
import Link from "next/link";
import { useState, useTransition } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { removeFromCart, setCartQty } from "@/actions/cart";
import type { CartLine as Line } from "@/lib/queries/catalog";
import { CHANNELS, type Channel } from "@/lib/channel";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { QtyStepper } from "./qty-stepper";
import { artFor } from "@/components/landing/site";

export function CartLineRow({ channel, line }: { channel: Channel; line: Line }) {
  const { base } = CHANNELS[channel];
  const [qty, setQty] = useState(line.qty);
  const [pending, startTransition] = useTransition();
  // when the server's quantity changes (e.g. clamped to stock), drop the local edit and follow it
  const [serverQty, setServerQty] = useState(line.qty);
  if (serverQty !== line.qty) {
    setServerQty(line.qty);
    setQty(line.qty);
  }

  function commit(next: number) {
    setQty(next);
    startTransition(async () => {
      await setCartQty(channel, line.variantId, next);
    });
  }

  return (
    <li className={cn("flex gap-3 p-4 sm:gap-4", pending && "opacity-70")}>
      <Link href={`${base}/product/${line.slug}`} className="size-16 shrink-0 overflow-hidden bg-zinc-100 sm:size-20">
        {line.imageUrl ? (
          <img src={line.imageUrl} alt={line.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <img src={artFor(line.categorySlug)} alt="" className="size-1/2 opacity-60 grayscale" />
          </div>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`${base}/product/${line.slug}`} className="block truncate text-sm font-bold uppercase hover:underline sm:text-[15px]">
              {line.name}
            </Link>
            <p className="text-xs font-medium text-zinc-500">{line.variant}</p>
          </div>
          <div className="shrink-0 text-right tabular-nums">
            <div className="text-sm font-extrabold sm:text-base">{peso(line.lineTotal)}</div>
            <div className="text-xs font-medium text-zinc-500">
              {peso(line.unitPrice)} × {line.qty}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <QtyStepper value={qty} onChange={commit} min={1} size="sm" ariaLabel={`Quantity for ${line.name} ${line.variant}`} />
          <button
            type="button"
            onClick={() => startTransition(async () => void (await removeFromCart(channel, line.variantId)))}
            className="flex h-9 items-center gap-1 px-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 hover:text-red-700"
          >
            <Trash2 className="size-4" /> Remove
          </button>
          <span className="text-xs font-semibold text-zinc-500">
            {line.tierApplied ? (
              <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-brand-700">
                Tier price {peso(line.unitPrice)} · was {peso(line.basePrice)}
              </span>
            ) : line.nextTier ? (
              <>
                Add {line.nextTier.minQty - line.styleQty} more of this style for {peso(line.nextTier.price)}/pc
              </>
            ) : null}
          </span>
        </div>

        {line.problems.map((p) => (
          <p key={p} className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
            <AlertTriangle className="size-3.5" /> {p}
          </p>
        ))}
      </div>
    </li>
  );
}
