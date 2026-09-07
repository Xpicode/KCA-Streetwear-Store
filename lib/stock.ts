/**
 * Stock rules: stock-in creates a batch + movement, packing deducts and snapshots cost.
 * Implement against db in phase 2; keep the pure helpers here.
 */

export type Batch = { qtyRemaining: number; unitCost: number };

/** Weighted-average unit cost across open batches. */
export function weightedAverageCost(batches: Batch[]) {
  const qty = batches.reduce((a, b) => a + b.qtyRemaining, 0);
  if (qty === 0) return 0;
  const value = batches.reduce((a, b) => a + b.qtyRemaining * b.unitCost, 0);
  return value / qty;
}
