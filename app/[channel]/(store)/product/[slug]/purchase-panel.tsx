"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { addToCart } from "@/actions/cart";
import type { CatalogProduct, CatalogVariant } from "@/lib/queries/catalog";
import { CHANNELS } from "@/lib/channel";
import { unitPriceFor, nextTier } from "@/lib/pricing";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { QtyStepper } from "@/components/shop/qty-stepper";
import { tierRanges } from "@/components/shop/tiers";

function pickerButton(active: boolean, disabled: boolean) {
  return cn(
    "flex h-10 min-w-12 flex-col items-center justify-center rounded-lg border px-3 text-sm font-bold leading-none transition-colors",
    active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:border-zinc-500",
    disabled && !active && "border-dashed text-zinc-400 hover:border-zinc-300"
  );
}

export function PurchasePanel({ product: p, priceGroup, inCart }: { product: CatalogProduct; priceGroup: string; inCart: Record<string, number> }) {
  const { base: basePath, label } = CHANNELS[p.channel];
  const retail = p.channel === "retail";
  const sizes = useMemo(() => [...new Set(p.variants.map((v) => v.size).filter((s): s is string => !!s))], [p.variants]);
  const colors = useMemo(() => [...new Set(p.variants.map((v) => v.color).filter((c): c is string => !!c))], [p.variants]);
  const hasSizes = sizes.length > 0;
  const hasColors = colors.length > 0;

  const firstInStock = p.variants.reduce((best, v) => (v.available > best.available ? v : best), p.variants[0]);
  const [size, setSize] = useState<string | null>(firstInStock.size);
  const [color, setColor] = useState<string | null>(firstInStock.color);
  const [qty, setQty] = useState(p.moq);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  const variant: CatalogVariant | undefined = p.variants.find((v) => (!hasSizes || v.size === size) && (!hasColors || v.color === color));
  const base = variant?.priceOverride ?? p.basePrice;
  const unit = unitPriceFor({ basePrice: p.basePrice, priceOverride: variant?.priceOverride, tiers: p.tiers, qty, priceGroup });
  const next = nextTier(p.tiers, qty, priceGroup);
  const ranges = tierRanges(base, p.tiers);
  const cartQty = variant ? (inCart[String(variant.id)] ?? 0) : 0;
  const out = !variant || variant.available <= 0;

  // stock for a size/colour button = sum across the other dimension, so a buyer sees which options are really gone
  const stockForSize = (s: string) => p.variants.filter((v) => v.size === s && (!hasColors || v.color === color)).reduce((a, v) => a + v.available, 0);
  const stockForColor = (c: string) => p.variants.filter((v) => v.color === c && (!hasSizes || v.size === size)).reduce((a, v) => a + v.available, 0);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  function add() {
    if (!variant) return;
    startTransition(async () => {
      const r = await addToCart(p.channel, variant.id, qty);
      setFlash(r?.error ? r.error : "added");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* price that follows qty */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="text-3xl font-extrabold">{peso(unit)}</span>
          <span className="text-sm font-medium text-zinc-500">/{p.unit}</span>
          {unit < base && <span className="text-sm font-semibold text-zinc-400 line-through">{peso(base)}</span>}
          <span className="ml-auto text-sm font-bold text-zinc-700">
            {qty} pcs = {peso(unit * qty)}
          </span>
        </div>
        <p className="mt-1 text-xs font-semibold text-zinc-500">
          {unit < base ? (
            <span className="text-brand-700">Tier price applied for {qty} pcs</span>
          ) : next ? (
            <>
              Add {next.minQty - qty} more to get {peso(next.price)}/{p.unit}
            </>
          ) : (
            <>{label} price</>
          )}
        </p>
        {ranges.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-zinc-600 tabular-nums">
            {ranges.map((r) => (
              <span key={r.from} className={cn("rounded-md px-1.5 py-0.5", qty >= r.from && (r.to == null || qty <= r.to) && "bg-white ring-1 ring-zinc-300 text-zinc-900")}>
                {r.label} {peso(r.price)}
              </span>
            ))}
          </div>
        )}
      </div>

      {hasColors && (
        <div>
          <div className="mb-2 flex items-baseline justify-between text-xs font-bold text-zinc-700">
            <span>Color</span>
            <span className="font-medium text-zinc-500">{color}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => {
              const s = stockForColor(c);
              return (
                <button key={c} type="button" onClick={() => setColor(c)} className={pickerButton(color === c, s <= 0)}>
                  <span>{c}</span>
                  <span className={cn("mt-1 text-[10px] font-semibold", color === c ? "text-zinc-300" : "text-zinc-500")}>{s > 0 ? `${s} pcs` : "none"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hasSizes && (
        <div>
          <div className="mb-2 flex items-baseline justify-between text-xs font-bold text-zinc-700">
            <span>Size</span>
            <span className="font-medium text-zinc-500">{size}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const st = stockForSize(s);
              return (
                <button key={s} type="button" onClick={() => setSize(s)} className={pickerButton(size === s, st <= 0)}>
                  <span>{s}</span>
                  <span className={cn("mt-1 text-[10px] font-semibold", size === s ? "text-zinc-300" : "text-zinc-500")}>{st > 0 ? `${st} pcs` : "none"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-baseline justify-between text-xs font-bold text-zinc-700">
          <span>Quantity</span>
          <span className="font-medium text-zinc-500">
            {variant ? (variant.available > 0 ? `${variant.available} available` : "Out of stock") : "Pick an option"}
            {retail ? "" : ` · min ${p.moq} per style`}
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <QtyStepper value={qty} onChange={setQty} min={p.moq} disabled={out} className="w-full sm:w-auto" />
          <button
            type="button"
            onClick={add}
            disabled={pending || out}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold text-white disabled:opacity-50 sm:flex-1",
              flash === "added" ? "bg-brand-600" : "bg-brand-700 hover:bg-brand-800"
            )}
          >
            {flash === "added" ? (
              <>
                <Check className="size-4" /> Added to cart
              </>
            ) : (
              <>
                <ShoppingCart className="size-4" />
                {pending ? "Adding…" : out ? "Out of stock" : `Add ${qty} to cart`}
              </>
            )}
          </button>
        </div>
        {variant && qty > variant.available && variant.available > 0 && (
          <p className="mt-2 text-xs font-semibold text-amber-700">Only {variant.available} available for this option — we&apos;ll confirm what we can send.</p>
        )}
        {flash && flash !== "added" && <p className="mt-2 text-xs font-semibold text-red-600">{flash}</p>}
        {cartQty > 0 && (
          <p className="mt-2 text-xs font-semibold text-brand-700">
            <Check className="mr-1 inline size-3.5" />
            {cartQty} pcs of this option already in your cart ·{" "}
            <Link href={`${basePath}/cart`} className="underline">
              view cart
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
