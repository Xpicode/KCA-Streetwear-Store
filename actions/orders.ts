"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import * as pipeline from "@/lib/orders";
import { OrderError } from "@/lib/orders";
import type { ActionState } from "@/components/ui/form-message";

/** Pages whose numbers change when an order moves. */
function revalidateOrder(orderId: number) {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/products");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/reports");
}

async function run(orderId: number, fn: () => Promise<unknown>): Promise<ActionState> {
  try {
    await fn();
    revalidateOrder(orderId);
    return { ok: true };
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    console.error(e);
    return { error: "Something went wrong. Please try again." };
  }
}

export async function confirmOrder(orderId: number): Promise<ActionState> {
  const user = await requireAdmin();
  return run(orderId, () => pipeline.confirmOrder(orderId, user.id));
}

export async function packOrder(orderId: number): Promise<ActionState> {
  const user = await requireAdmin();
  return run(orderId, () => pipeline.packOrder(orderId, user.id));
}

export async function deliverOrder(orderId: number): Promise<ActionState> {
  const user = await requireAdmin();
  return run(orderId, () => pipeline.deliverOrder(orderId, user.id));
}

export async function cancelOrder(orderId: number): Promise<ActionState> {
  const user = await requireAdmin();
  return run(orderId, () => pipeline.cancelOrder(orderId, user.id));
}

const paymentSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive("Enter an amount above zero"),
  method: z.enum(["cash", "bank", "ewallet"]),
  reference: z.string().trim().max(120).optional(),
  paidAt: z.string().trim().optional(),
});

export async function recordPayment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { orderId, amount, method, reference, paidAt } = parsed.data;
  // A back-dated payment lands at noon on that day; today's uses the current time.
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const when = paidAt && paidAt !== todayKey ? new Date(`${paidAt}T12:00:00`) : undefined;
  if (when && Number.isNaN(when.getTime())) return { error: "Enter a valid payment date." };
  return run(orderId, () => pipeline.recordPayment(orderId, { amount, method, reference, paidAt: when }));
}

const noteSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  note: z.string().max(2000).default(""),
});

export async function updateOrderNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = noteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return run(parsed.data.orderId, () => pipeline.updateOrderNote(parsed.data.orderId, parsed.data.note));
}

const lineSchema = z.object({
  variantId: z.number().int().positive(),
  qty: z.number().int().positive(),
  unitPrice: z.number().min(0),
});

const createSchema = z.object({
  customerId: z.coerce.number().int().positive("Choose a customer"),
  source: z.enum(["manual", "storefront"]).default("manual"),
  discount: z.coerce.number().min(0).default(0),
  note: z.string().trim().max(2000).optional(),
  lines: z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Lines are not valid" });
        return z.NEVER;
      }
    })
    .pipe(z.array(lineSchema).min(1, "Add at least one line")),
});

/** Admin "New order" form: creates a pending order and jumps to it. */
export async function createOrder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAdmin();
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { customerId, source, discount, note, lines } = parsed.data;

  let created: { id: number; orderNo: string };
  try {
    created = await pipeline.createOrderForCustomer({ customerId, lines, note, source, discount, handledBy: user.id });
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    console.error(e);
    return { error: "Could not create the order. Please try again." };
  }
  revalidateOrder(created.id);
  redirect(`/admin/orders/${created.id}`);
}

/** Owner-only permanent delete of one order. Stock is put right per status (see lib/orders.ts). */
export async function deleteOrder(orderId: number): Promise<ActionState> {
  await requireAdmin({ owner: true });
  try {
    await pipeline.deleteOrder(orderId);
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/reports");
  return { ok: true };
}

/** Same delete, as a form action for the order detail page — redirects back to History. */
export async function deleteOrderForm(formData: FormData) {
  await requireAdmin({ owner: true });
  const orderId = Number(formData.get("orderId"));
  if (!Number.isInteger(orderId)) redirect("/admin/orders?view=history");
  try {
    await pipeline.deleteOrder(orderId);
  } catch {
    redirect(`/admin/orders/${orderId}`);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/reports");
  redirect("/admin/orders?view=history");
}

/** Owner-only bulk delete for the orders list (works on any status; stock is put right per order). */
export async function deleteOrders(orderIds: number[]): Promise<ActionState & { deleted?: number }> {
  await requireAdmin({ owner: true });
  const ids = orderIds.filter((n) => Number.isInteger(n)).slice(0, 200);
  if (ids.length === 0) return { error: "Nothing selected." };
  const res = await pipeline.deleteOrders(ids);
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/products");
  if (res.deleted.length === 0) return { error: "Could not delete the selected orders." };
  return { ok: true, deleted: res.deleted.length, ...(res.failed.length ? { error: `${res.failed.length} could not be deleted.` } : {}) };
}
