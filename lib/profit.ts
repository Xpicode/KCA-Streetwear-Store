/**
 * Profit rules. Keep every calculation here so pages and server actions stay thin.
 * Money is handled in centavos-free pesos as numbers; switch to a decimal
 * library if you ever need sub-peso precision.
 */

export function lineProfit(unitPrice: number, unitCost: number, qty: number) {
  return (unitPrice - unitCost) * qty;
}

export function marginPercent(profit: number, revenue: number) {
  return revenue === 0 ? 0 : (profit / revenue) * 100;
}

export type Period = "day" | "week" | "month";

/** Start/end of the requested period, used by report queries. */
export function periodRange(period: Period, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === "week") start.setDate(start.getDate() - 6);
  if (period === "month") start.setDate(1);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
