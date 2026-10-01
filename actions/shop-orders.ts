"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, orders } from "@/db/schema";
import { CHANNELS, CHANNEL_KEYS, type Channel } from "@/lib/channel";
import { getShopper, normalizePhone, rememberShopper } from "@/lib/shopper";
import { signPayload } from "@/lib/auth";
import { readCart, writeCart } from "@/lib/cart";
import { CartProblem, createStorefrontOrder } from "@/lib/shop-orders";
import { OrderError } from "@/lib/orders";
import type { ActionState } from "@/components/ui/form-message";
import { PAYMENT_OPTIONS } from "@/components/shop/payment-options";
import { formatAddress, type AddressParts } from "@/lib/address";

const channelSchema = z.enum(CHANNEL_KEYS as [Channel, ...Channel[]]);

const schema = z.object({
  channel: channelSchema,
  shopName: z.string().trim().min(2, "Enter your name"),
  // retail buyers give one name; wholesale asks for the shop and the person receiving
  contactName: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().min(7, "Enter a contact number"),
  email: z.string().trim().toLowerCase().email("Enter a valid email").optional().or(z.literal("")),
  addrStreet: z.string().trim().min(3, "Enter the house / unit number and street").max(200),
  addrSubdivision: z.string().trim().max(120).optional().default(""),
  addrBarangay: z.string().trim().min(2, "Enter the barangay").max(120),
  addrCity: z.string().trim().min(2, "Enter the city or municipality").max(120),
  addrProvince: z.string().trim().max(120).optional().default(""),
  addrZip: z.string().trim().regex(/^[0-9]{4}$/, "ZIP code is 4 digits").optional().or(z.literal("")),
  payment: z.enum(PAYMENT_OPTIONS.map((p) => p.value) as [string, ...string[]], { message: "Pick a preferred payment" }),
  note: z.string().trim().max(1000, "Note is too long").optional().default(""),
});

type ContactDetails = { shopName: string; contactName: string; phone: string; email?: string; address: string; addressParts: AddressParts };

type ResolvedCustomer = {
  id: number;
  priceGroup: string;
  /**
   * true  — this device already placed orders for the customer, or the customer is brand new:
   *         profile updated from the form, device remembered, customer's price group applies.
   * false — an existing customer matched by phone number only. A phone number is not proof of
   *         identity, so the profile on file is left alone, standard pricing applies and the
   *         device is NOT given access to that customer's order history.
   */
  verified: boolean;
  /** Fields the buyer typed that differ from the profile on file (unverified matches only). */
  differences: string[];
};

/** Which of the typed details disagree with what's on file, as "shop name "X" (on file "Y")". */
function diffDetails(typed: ContactDetails, onFile: { shopName: string; contactName: string | null; address: string | null; email: string | null }) {
  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const out: string[] = [];
  const check = (label: string, a: string | undefined, b: string | null) => {
    if (a && norm(a) !== norm(b)) out.push(`${label} "${a}" (on file "${b ?? "—"}")`);
  };
  check("name", typed.shopName, onFile.shopName);
  check("contact", typed.contactName, onFile.contactName);
  check("address", typed.address, onFile.address);
  check("email", typed.email, onFile.email);
  return out;
}

/**
 * Finds the customer this order belongs to, without any account:
 *   1. the customer remembered on this device (cookie), if the phone still matches → verified
 *   2. an existing customer with the same phone number (digits compared)         → unverified
 *   3. otherwise a new, auto-approved customer row                                → verified
 */
async function resolveCustomer(channel: Channel, d: ContactDetails): Promise<ResolvedCustomer> {
  const digits = normalizePhone(d.phone);
  const details = {
    shopName: d.shopName,
    contactName: d.contactName,
    phone: d.phone,
    address: d.address,
    addressParts: d.addressParts,
    ...(d.email ? { email: d.email } : {}),
  };

  const remembered = await getShopper(channel);
  if (remembered && remembered.status !== "blocked" && (!remembered.phone || normalizePhone(remembered.phone) === digits)) {
    await db.update(customers).set(details).where(eq(customers.id, remembered.id));
    return { id: remembered.id, priceGroup: remembered.priceGroup, verified: true, differences: [] };
  }

  if (digits.length >= 7) {
    const [match] = await db
      .select({
        id: customers.id,
        shopName: customers.shopName,
        contactName: customers.contactName,
        address: customers.address,
        email: customers.email,
      })
      .from(customers)
      .where(and(sql`regexp_replace(coalesce(${customers.phone}, ''), '\\D', '', 'g') = ${digits}`, sql`${customers.status} <> 'blocked'`))
      .limit(1);
    if (match) return { id: match.id, priceGroup: "standard", verified: false, differences: diffDetails(d, match) };
  }

  const [created] = await db
    .insert(customers)
    .values({ ...details, status: "approved" })
    .returning({ id: customers.id, priceGroup: customers.priceGroup });
  return { id: created.id, priceGroup: created.priceGroup, verified: true, differences: [] };
}

/** Signed link that opens exactly one order for 7 days (same mechanism as "Track an order"). */
function orderToken(orderId: number) {
  return signPayload({ oid: orderId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 });
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
  const channel = d.channel;
  const base = CHANNELS[channel].base;
  const contactName = d.contactName || d.shopName;
  const addressParts: AddressParts = {
    street: d.addrStreet,
    subdivision: d.addrSubdivision,
    barangay: d.addrBarangay,
    city: d.addrCity,
    province: d.addrProvince,
    zip: d.addrZip ?? "",
  };
  const address = formatAddress(addressParts);
  let customer: ResolvedCustomer;
  try {
    customer = await resolveCustomer(channel, { shopName: d.shopName, contactName, phone: d.phone, email: d.email, address, addressParts });
  } catch {
    return { error: "We couldn't save your details — if you used an email, it may already belong to another customer. Try leaving email blank." };
  }
  const payment = PAYMENT_OPTIONS.find((p) => p.value === d.payment)?.label ?? d.payment;

  const note = [
    contactName !== d.shopName ? `Shop: ${d.shopName}` : null,
    `Receiver Name: ${contactName}`,
    `Contact Number: ${d.phone}`,
    `Address: ${address}`,
    `Preferred payment: ${payment}`,
    d.note ? `Note: ${d.note}` : null,
    customer.verified
      ? null
      : `Review: matched an existing customer by phone number from a new device — profile not updated, standard pricing applied.` +
        (customer.differences.length ? ` Typed details differ: ${customer.differences.join("; ")}.` : ""),
  ]
    .filter(Boolean)
    .join("\n");

  const cart = await readCart(channel);
  let order: { id: number; orderNo: string };
  try {
    order = await createStorefrontOrder({ channel, customerId: customer.id, priceGroup: customer.priceGroup, cart, note });
  } catch (e) {
    if (e instanceof CartProblem) return { error: e.problems.join(" · ") };
    if (e instanceof OrderError) return { error: e.message };
    throw e;
  }

  await writeCart(channel, {});
  revalidatePath(base, "layout");
  revalidatePath("/admin", "layout");
  if (customer.verified) {
    await rememberShopper(channel, customer.id);
    redirect(`${base}/orders/${order.id}?placed=1`);
  }
  // unverified: this device may follow this one order, not the matched customer's history
  redirect(`${base}/orders/${order.id}?placed=1&t=${encodeURIComponent(orderToken(order.id))}`);
}

const trackSchema = z.object({
  channel: channelSchema,
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
  redirect(`${CHANNELS[parsed.data.channel].base}/orders/${row.id}?t=${encodeURIComponent(orderToken(row.id))}`);
}
