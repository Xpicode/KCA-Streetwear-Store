/**
 * Storefront order creation. Re-validates the cart against live catalog data (active,
 * MOQ, stock), then hands the lines to the shared order engine (lib/orders.ts) so the
 * storefront and the admin "New order" form create orders the same way.
 * unit_cost / line_profit stay NULL until the admin packs the order.
 */
import "server-only";
import { createOrderForCustomer } from "@/lib/orders";
import { getCartLines } from "@/lib/queries/catalog";
import type { Cart } from "@/lib/cart";

export class CartProblem extends Error {
  constructor(public problems: string[]) {
    super(problems[0] ?? "Your cart needs attention.");
  }
}

export async function createStorefrontOrder(opts: { customerId: number; priceGroup: string; cart: Cart; note: string | null }) {
  // getCartLines drops inactive variants and flags MOQ / stock problems using live stock.
  const summary = await getCartLines(opts.cart, opts.priceGroup);
  if (summary.lines.length === 0) throw new CartProblem(["Your cart is empty."]);
  if (!summary.ok) throw new CartProblem(summary.problems);

  return createOrderForCustomer({
    customerId: opts.customerId,
    lines: summary.lines.map((l) => ({ variantId: l.variantId, qty: l.qty, unitPrice: l.unitPrice })),
    note: opts.note,
    source: "storefront",
  });
}
