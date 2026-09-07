/**
 * Guest shopper identity — no account needed.
 * After the first order request we remember the customer id in a signed cookie so
 * "My orders" works on that device and checkout is prefilled next time.
 * Anyone can also look an order up with order number + phone (see /shop/track).
 */
import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { signPayload, verifyPayload } from "@/lib/auth";

const COOKIE = "ws_shopper";
const MAX_AGE = 60 * 60 * 24 * 365;

export type Shopper = {
  id: number;
  shopName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  priceGroup: string;
  status: "pending" | "approved" | "blocked";
};

export const getShopper = cache(async (): Promise<Shopper | null> => {
  const jar = await cookies();
  const p = verifyPayload<{ cid: number; exp: number }>(jar.get(COOKIE)?.value);
  if (!p?.cid) return null;
  const [c] = await db
    .select({
      id: customers.id,
      shopName: customers.shopName,
      contactName: customers.contactName,
      email: customers.email,
      phone: customers.phone,
      address: customers.address,
      priceGroup: customers.priceGroup,
      status: customers.status,
    })
    .from(customers)
    .where(eq(customers.id, p.cid))
    .limit(1);
  return c ?? null;
});

export async function rememberShopper(customerId: number) {
  const jar = await cookies();
  jar.set(COOKIE, signPayload({ cid: customerId, exp: Math.floor(Date.now() / 1000) + MAX_AGE }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function forgetShopper() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Price group used for catalog prices: the remembered customer's, else standard. */
export async function getShopperPriceGroup() {
  return (await getShopper())?.priceGroup ?? "standard";
}

/** Digits only, so "0917-000-0003" and "0917 000 0003" match. */
export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}
