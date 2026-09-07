"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Check, ShoppingCart } from "lucide-react";
import { addToCart } from "@/actions/cart";
import type { CatalogProduct } from "@/lib/queries/catalog";
import { variantLabel, variantSummary } from "./variant-label";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { bestTier } from "./tiers";
import { ProductImage, StockBadge } from "./product-image";
import { QtyStepper } from "./qty-stepper";

export function ProductCard({ product: p, inCart }: { product: CatalogProduct; inCart: Record<string, number> }) {
  const firstInStock = p.variants.reduce((best, v) => (v.available > best.available ? v : best), p.variants[0]);
  const [variantId, setVariantId] = useState(firstInStock.id);
  const [qty, setQty] = useState(p.moq);
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<"added" | string | null>(null);

  const variant = p.variants.find((v) => v.id === variantId) ?? firstInStock;
  const base = variant.priceOverride ?? p.basePrice;
  const tier = bestTier(base, p.tiers);
  const cartQty = inCart[String(variant.id)] ?? 0;
  const out = variant.available <= 0;

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(t);
  }, [flash]);

  function add() {
    startTransition(async () => {
      const r = await addToCart(variant.id, qty);
      setFlash(r?.error ? r.error : "added");
    });
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-md">
      <Link href={`/shop/product/${p.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-zinc-100">
        <ProductImage name={p.name} imageUrl={p.imageUrl} categorySlug={p.categorySlug} textClass="text-4xl" />
        <StockBadge available={p.available} moq={p.moq} className="absolute top-2 left-2" />
        {cartQty > 0 && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
            <Check className="size-3" /> {cartQty} in cart
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
        <div>
          <Link href={`/shop/product/${p.slug}`} className="line-clamp-2 text-sm font-extrabold leading-snug hover:underline sm:text-[15px]">
            {p.name}
          </Link>
          <p className="mt-0.5 text-xs font-medium text-zinc-500">{variantSummary(p.variants)}</p>
        </div>

        <div className="flex items-baseline gap-1.5 tabular-nums">
          <span className="text-lg font-extrabold">{peso(base)}</span>
          <span className="text-xs font-medium text-zinc-500">/{p.unit}</span>
          {tier && (
            <span className="ml-auto rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
              {peso(tier.price)} at {tier.minQty}+
            </span>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          {p.variants.length > 1 && (
            <select
              aria-label="Option"
              value={variantId}
              onChange={(e) => setVariantId(Number(e.target.value))}
              className="h-9 w-full rounded-lg border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            >
              {p.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {variantLabel(v)} {v.available > 0 ? `· ${v.available} pcs` : "· out of stock"}
                  {inCart[String(v.id)] ? ` · ${inCart[String(v.id)]} in cart` : ""}
                </option>
              ))}
            </select>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <QtyStepper value={qty} onChange={setQty} min={p.moq} size="sm" disabled={out} className="w-full sm:w-auto" />
            <button
              type="button"
              onClick={add}
              disabled={pending || out}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold text-white transition-colors disabled:opacity-50 sm:flex-1 sm:text-sm",
                flash === "added" ? "bg-emerald-600" : "bg-emerald-700 hover:bg-emerald-800"
              )}
            >
              {flash === "added" ? (
                <>
                  <Check className="size-4" /> Added
                </>
              ) : (
                <>
                  <ShoppingCart className="size-4" />
                  {pending ? "Adding…" : out ? "Out of stock" : "Add to cart"}
                </>
              )}
            </button>
          </div>
          {flash && flash !== "added" && <p className="text-xs font-semibold text-red-600">{flash}</p>}
          {!out && qty > variant.available && <p className="text-xs font-semibold text-amber-700">Only {variant.available} available for this option</p>}
        </div>
      </div>
    </article>
  );
}
