/**
 * Cart lives in a cookie as { [variantId]: qty }. Small, no DB rows for abandoned carts.
 * Prices are never stored here — always recomputed from the catalog on read.
 */
import "server-only";
import { cookies } from "next/headers";

const COOKIE = "ws_cart";
export type Cart = Record<string, number>;

export async function readCart(): Promise<Cart> {
  const jar = await cookies();
  try {
    const raw = jar.get(COOKIE)?.value;
    const parsed = raw ? (JSON.parse(raw) as Cart) : {};
    return Object.fromEntries(Object.entries(parsed).filter(([, q]) => Number.isFinite(q) && q > 0));
  } catch {
    return {};
  }
}

export async function writeCart(cart: Cart) {
  const jar = await cookies();
  const clean = Object.fromEntries(Object.entries(cart).filter(([, q]) => q > 0));
  if (Object.keys(clean).length === 0) {
    jar.delete(COOKIE);
    return;
  }
  jar.set(COOKIE, JSON.stringify(clean), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

export function cartCount(cart: Cart) {
  return Object.keys(cart).length;
}

export function cartUnits(cart: Cart) {
  return Object.values(cart).reduce((a, b) => a + b, 0);
}
