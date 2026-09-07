import { describe, expect, it } from "vitest";
import { nextTier, unitPriceFor, type Tier } from "@/lib/pricing";
import { lineProfit, marginPercent } from "@/lib/profit";

const tiers: Tier[] = [
  { minQty: 12, price: 90, priceGroup: null },
  { minQty: 24, price: 85, priceGroup: null },
  { minQty: 6, price: 80, priceGroup: "vip" },
];

describe("unitPriceFor", () => {
  it("uses the base price below every tier", () => {
    expect(unitPriceFor({ basePrice: 100, tiers, qty: 5 })).toBe(100);
  });

  it("picks the highest tier the quantity reaches", () => {
    expect(unitPriceFor({ basePrice: 100, tiers, qty: 12 })).toBe(90);
    expect(unitPriceFor({ basePrice: 100, tiers, qty: 30 })).toBe(85);
  });

  it("only applies group tiers to that price group", () => {
    expect(unitPriceFor({ basePrice: 100, tiers, qty: 6 })).toBe(100);
    expect(unitPriceFor({ basePrice: 100, tiers, qty: 6, priceGroup: "vip" })).toBe(80);
  });

  it("never charges more than the base/override price", () => {
    expect(unitPriceFor({ basePrice: 100, priceOverride: 70, tiers, qty: 12 })).toBe(70);
  });
});

describe("nextTier", () => {
  it("returns the nearest tier above the quantity for the buyer's group", () => {
    expect(nextTier(tiers, 5)).toMatchObject({ minQty: 12 });
    expect(nextTier(tiers, 5, "vip")).toMatchObject({ minQty: 6 });
    expect(nextTier(tiers, 30)).toBeNull();
  });
});

describe("profit", () => {
  it("computes line profit and margin", () => {
    expect(lineProfit(100, 60, 5)).toBe(200);
    expect(marginPercent(200, 500)).toBe(40);
    expect(marginPercent(0, 0)).toBe(0);
  });
});
