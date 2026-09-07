/** Pure helpers for showing tier pricing (safe in client components). */
import type { Tier } from "@/lib/pricing";

export type TierRange = { from: number; to: number | null; price: number; label: string };

/** "1–11 pcs ₱150 · 12+ ₱140" rows: base price first, then each tier that actually lowers the price. */
export function tierRanges(basePrice: number, tiers: Tier[]): TierRange[] {
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty).filter((t) => t.price < basePrice);
  const rows: TierRange[] = [];
  let from = 1;
  let price = basePrice;
  for (const t of sorted) {
    if (t.minQty > from) rows.push({ from, to: t.minQty - 1, price, label: `${from}–${t.minQty - 1} pcs` });
    from = t.minQty;
    price = Math.min(price, t.price);
  }
  rows.push({ from, to: null, price, label: `${from}+ pcs` });
  return rows;
}

/** Best tier for the hint under the price: { minQty: 12, price: 140 } or null when tiers don't beat base. */
export function bestTier(basePrice: number, tiers: Tier[]) {
  const better = tiers.filter((t) => t.price < basePrice).sort((a, b) => a.price - b.price || a.minQty - b.minQty);
  return better[0] ?? null;
}
