/** Wholesale price for a quantity: highest matching tier wins, else base price (or variant override). */
export type Tier = { minQty: number; price: number; priceGroup: string | null };

export function unitPriceFor(opts: {
  basePrice: number;
  priceOverride?: number | null;
  tiers: Tier[];
  qty: number;
  priceGroup?: string;
}) {
  const base = opts.priceOverride ?? opts.basePrice;
  const eligible = opts.tiers
    .filter((t) => t.minQty <= opts.qty && (t.priceGroup == null || t.priceGroup === opts.priceGroup))
    .sort((a, b) => b.minQty - a.minQty);
  return eligible.length ? Math.min(base, eligible[0].price) : base;
}

/** Next tier the buyer could unlock by adding more, or null. */
export function nextTier(tiers: Tier[], qty: number, priceGroup?: string) {
  return (
    tiers
      .filter((t) => t.minQty > qty && (t.priceGroup == null || t.priceGroup === priceGroup))
      .sort((a, b) => a.minQty - b.minQty)[0] ?? null
  );
}
