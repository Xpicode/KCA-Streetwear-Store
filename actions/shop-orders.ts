"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { getShopper, normalizePhone, rememberShopper } from "@/lib/shopper";
import { signPayload } from "@/lib/auth";
import { readCart, writeCart } from "@/lib/cart";
import { CartProblem, createStorefrontOrder } from "@/lib/shop-orders";
import { OrderError } from "@/lib/orders";
import type { ActionState } from "@/components/ui/form-message";
import { PAYMENT_OPTIONS } from "@/components/shop/payment-options";

const schema = z.object({
  shopName: z.string().trim().min(2, "Enter your shop name"),
  contactName: z.string().trim().min(2, "Enter the person receiving the order"),
  phone: z.string().trim().min(7, "Enter a contact number"),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().trim().min(5, "Enter the delivery address"),
  payment: z.enum(PAYMENT_OPTIONS.map((p) => p.value) as [string, ...string[]], { message: "Pick a preferred payment" }),
  note: z.string().trim().max(1000, "Note is too long").optional().default(""),
});

/**
 * Finds the customer this order belongs to, without any account:
 *   1. the customer remembered on this device (cookie), if the phone still matches
 *   2. an existing customer with the same phone number (digits compared)
 *   3. otherwise a new, auto-approved customer row
 * Contact details are refreshed from the form each time.
 */
async function resolveCustomer(d: { shopName: string; contactName: string; phone: string; email?: string; address: string }) {
  const digits = normalizePhone(d.phone);
  const remembered = await getShopper();
  let id: number | null = null;

  if (remembered && remembered.status !== "blocked" && (!remembered.phone || normalizePhone(remembered.phone) === digits)) {
    id = remembered.id;
  } else if (digits.length >= 7) {
    const [match] = await db
      .select({ id: customers.id, status: customers.status })
      .from(customers)
      .where(and(sql`regexp_replace(coalesce(${customers.phone}, ''), '\\D', '', 'g') = ${digits}`, sql`${customers.status} <> 'blocked'`))
      .limit(1);
    if (match) id = match.id;
  }

  const details = {
    shopName: d.shopName,
    contactName: d.contactName,
    phone: d.phone,
    address: d.address,
    ...(d.email ? { email: d.email } : {}),
  };

  if (id) {
    await db.update(customers).set(details).where(eq(customers.id, id));
    const [c] = await db.select({ priceGroup: customers.priceGroup }).from(customers).where(eq(customers.id, id)).limit(1);
    return { id, priceGroup: c?.priceGroup ?? "standard" };
  }
  const [created] = await db
    .insert(customers)
    .values({ ...details, status: "approved" })
    .returning({ id: customers.id, priceGroup: customers.priceGroup });
  return created;
}

/**
 * "Send order request": re-validates the cart against live stock/MOQ, finds or creates the
 * customer from the contact details, inserts a pending order, clears the cart and opens the
 * confirmation page. Delivery details + payment preference also go into the order note.
 */
export async function placeOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  let customer: { id: number; priceGroup: string };
  try {
    customer = await resolveCustomer(d);
  } catch {
    return { error: "We couldn't save your details — if you used an email, it may already belong to another shop. Try leaving email blank." };
  }
  const payment = PAYMENT_OPTIONS.find((p) => p.value === d.payment)?.label ?? d.payment;

  const note = [
    `Deliver to: ${d.shopName} · ${d.contactName} · ${d.phone} · ${d.address.replace(/\s*\n\s*/g, ", ")}`,
    `Preferred payment: ${payment}`,
    d.note ? `Note: ${d.note}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const cart = await readCart();
  let order: { id: number; orderNo: string };
  try {
    order = await createStorefrontOrder({ customerId: customer.id, priceGroup: customer.priceGroup, cart, note });
  } catch (e) {
    if (e instanceof CartProblem) return { error: e.problems.join(" · ") };
    if (e instanceof OrderError) return { error: e.message };
    throw e;
  }

  await writeCart({});
  await rememberShopper(customer.id);
  revalidatePath("/shop", "layout");
  revalidatePath("/admin", "layout");
  redirect(`/shop/orders/${order.id}?placed=1`);
}

const trackSchema = z.object({
  orderNo: z.string().trim().min(1, "Enter your order number"),
  phone: z.string().trim().min(7, "Enter the contact number used on the order"),
});

/**
 * Order number + phone → open THAT ORDER ONLY, via a signed single-order token in the URL.
 * Deliberately does not remember the customer on this device and never exposes other
 * orders: knowing one order number + phone unlocks exactly that order for 7 days.
 */
export async function trackOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = trackSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const no = parsed.data.orderNo.replace(/^#?/, "#");
  const digits = normalizePhone(parsed.data.phone);
  const [row] = await db
    .select({ id: orders.id, customerId: orders.customerId })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(and(eq(orders.orderNo, no), sql`regexp_replace(coalesce(${customers.phone}, ''), '\\D', '', 'g') = ${digits}`))
    .limit(1);
  if (!row) return { error: "No order found with that number and contact number." };
  const token = signPayload({ oid: row.id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 });
  redirect(`/shop/orders/${row.id}?t=${encodeURIComponent(token)}`);
}
