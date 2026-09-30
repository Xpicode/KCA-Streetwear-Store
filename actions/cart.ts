"use server";

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { productVariants, products } from "@/db/schema";
import { CHANNELS, isChannel, type Channel } from "@/lib/channel";
import { getShopper } from "@/lib/shopper";
import { readCart, writeCart } from "@/lib/cart";
import { getCustomerOrderLines } from "@/lib/queries/shop-orders";
import type { ActionState } from "@/components/ui/form-message";

const qtySchema = z.number().int().min(0).max(9999);
const idSchema = z.number().int().positive();

/** The channel comes from the client, so it is validated like any other input. */
function parseChannel(value: unknown): Channel {
  if (!isChannel(value)) throw new Error("Unknown storefront channel.");
  return value;
}

function revalidateShop(channel: Channel) {
  // header cart count lives in the channel layout, so refresh the whole subtree
  revalidatePath(CHANNELS[channel].base, "layout");
}

/** Only variants that are active, belong to an active product, and (retail) have a retail price may enter the cart. */
async function activeVariantIds(channel: Channel, ids: number[]) {
  if (ids.length === 0) return new Set<number>();
  const rows = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      and(
        inArray(productVariants.id, ids),
        eq(productVariants.isActive, true),
        eq(products.isActive, true),
        ...(channel === "retail" ? [isNotNull(products.retailPrice)] : [])
      )
    );
  return new Set(rows.map((r) => r.id));
}

/** Merge qty into the cookie cart (adds to what is already there). */
export async function addToCart(channelInput: string, variantId: number, qty: number): Promise<ActionState> {
  const channel = parseChannel(channelInput);
  const id = idSchema.safeParse(variantId);
  const q = qtySchema.safeParse(qty);
  if (!id.success || !q.success || q.data === 0) return { error: "Enter a quantity of at least 1." };
  const ok = await activeVariantIds(channel, [id.data]);
  if (!ok.has(id.data)) return { error: "That option is no longer available." };
  const cart = await readCart(channel);
  cart[String(id.data)] = Math.min(9999, (cart[String(id.data)] ?? 0) + q.data);
  await writeCart(channel, cart);
  revalidateShop(channel);
  return { ok: true };
}

/** Set an exact qty (0 removes the line). */
export async function setCartQty(channelInput: string, variantId: number, qty: number): Promise<ActionState> {
  const channel = parseChannel(channelInput);
  const id = idSchema.safeParse(variantId);
  const q = qtySchema.safeParse(qty);
  if (!id.success || !q.success) return { error: "Invalid quantity." };
  const cart = await readCart(channel);
  if (q.data === 0) delete cart[String(id.data)];
  else cart[String(id.data)] = q.data;
  await writeCart(channel, cart);
  revalidateShop(channel);
  return { ok: true };
}

export async function removeFromCart(channelInput: string, variantId: number): Promise<ActionState> {
  return setCartQty(channelInput, variantId, 0);
}

/** Form-action wrapper so a plain <form> button can remove a line without JS. */
export async function removeFromCartForm(formData: FormData) {
  await removeFromCart(String(formData.get("channel")), Number(formData.get("variantId")));
}

/** Put every line of one of the customer's past orders back into the cart (same quantities), then open the cart. */
export async function reorder(channelInput: string, orderId: number) {
  const channel = parseChannel(channelInput);
  const base = CHANNELS[channel].base;
  const customer = await getShopper(channel);
  const id = idSchema.safeParse(orderId);
  if (!customer || !id.success) redirect(`${base}/orders`);
  const lines = await getCustomerOrderLines(customer.id, id.data);
  const ok = await activeVariantIds(channel, lines.map((l) => l.variantId));
  const cart = await readCart(channel);
  let added = 0;
  for (const l of lines) {
    if (!ok.has(l.variantId)) continue;
    cart[String(l.variantId)] = Math.min(9999, l.qty);
    added++;
  }
  await writeCart(channel, cart);
  revalidateShop(channel);
  redirect(added > 0 ? `${base}/cart?reordered=1` : `${base}/orders/${id.data}?reorder=none`);
}

export async function reorderForm(formData: FormData) {
  await reorder(String(formData.get("channel")), Number(formData.get("orderId")));
}
