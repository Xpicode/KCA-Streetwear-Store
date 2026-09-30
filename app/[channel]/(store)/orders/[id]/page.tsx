import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, RotateCcw } from "lucide-react";
import { redirect } from "next/navigation";
import { channelFromSlug } from "@/lib/channel";
import { getShopper } from "@/lib/shopper";
import { verifyPayload } from "@/lib/auth";
import { getShopOrder } from "@/lib/queries/shop-orders";
import { reorderForm } from "@/actions/cart";
import { peso } from "@/lib/format";
import { SubmitButton } from "@/components/ui/submit-button";
import { fmtDate, fmtDateTime, OrderStatusBadge, PaymentBadge, PAYMENT_METHOD, StatusTrack } from "@/components/shop/order-bits";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ channel: string; id: string }>;
  searchParams: Promise<{ placed?: string; reorder?: string; t?: string }>;
}) {
  const [{ channel: slug, id }, { placed, reorder, t }] = await Promise.all([params, searchParams]);
  const channel = channelFromSlug(slug);
  if (!channel) notFound();
  const { base } = channel;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();
  const order = await getShopOrder(orderId);
  if (!order) notFound();

  // Access: the device that placed orders for this customer, or a signed token for exactly this order.
  const shopper = await getShopper(channel.key);
  const isOwner = shopper?.id === order.customerId;
  const tracked = !isOwner && verifyPayload<{ oid: number; exp: number }>(t)?.oid === orderId;
  if (!isOwner && !tracked) redirect(`${base}/orders`);
  const customer = { address: order.address };

  const noteLines = order.note?.split("\n").filter(Boolean) ?? [];
  const canReorder = isOwner && order.lines.length > 0; // reorder needs the owning device, not a track link

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href={`${base}/orders`} className="inline-flex items-center gap-1 text-sm font-bold text-zinc-500 hover:text-zinc-900">
        <ChevronLeft className="size-4" /> My orders
      </Link>

      {placed && (
        <div className="flex gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 sm:p-5">
          <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-brand-700" />
          <div>
            <h2 className="text-base font-extrabold text-brand-900">Order request {order.orderNo} sent</h2>
            <p className="mt-1 text-sm font-medium text-brand-900/80">
              We&apos;ll check stock and message you the confirmed total and delivery fee. Once you pay by GCash, Maya or bank transfer, your
              order ships.
            </p>
          </div>
        </div>
      )}
      {reorder === "none" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          None of these items are available right now, so nothing was added to your cart.
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight">
            Order {order.orderNo}
            <OrderStatusBadge status={order.status} />
          </h1>
          <p className="text-sm font-medium text-zinc-500">Requested {fmtDateTime(order.requestedAt)}</p>
        </div>
        {canReorder && (
          <form action={reorderForm}>
            <input type="hidden" name="channel" value={channel.key} />
            <input type="hidden" name="orderId" value={order.id} />
            <SubmitButton variant="outline" pendingText="Adding…" className="h-9 px-3">
              <RotateCcw className="size-4" /> Reorder
            </SubmitButton>
          </form>
        )}
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white px-4 py-5 sm:px-6">
        <StatusTrack
          status={order.status}
          dates={{ pending: order.requestedAt, confirmed: order.confirmedAt, packed: order.packedAt, delivered: order.deliveredAt, paid: order.paidAt }}
        />
      </section>

      <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="text-[15px] font-extrabold">Items</h2>
          <span className="text-xs font-medium text-zinc-500">{order.lines.reduce((a, l) => a + l.qty, 0)} pcs</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] font-bold tracking-wider text-zinc-500 uppercase">
            <tr>
              <th className="px-5 py-2">Item</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="hidden px-3 py-2 text-right sm:table-cell">Price</th>
              <th className="px-5 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 tabular-nums">
            {order.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-5 py-3">
                  <Link href={`${base}/product/${l.slug}`} className="font-bold hover:underline">
                    {l.name}
                  </Link>
                  <div className="text-xs font-medium text-zinc-500">
                    {l.variant}
                    <span className="sm:hidden"> · {peso(l.unitPrice)}/pc</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-right font-medium">{l.qty}</td>
                <td className="hidden px-3 py-3 text-right font-medium sm:table-cell">{peso(l.unitPrice)}</td>
                <td className="px-5 py-3 text-right font-extrabold">{peso(l.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="flex flex-col gap-1.5 border-t border-zinc-200 px-5 py-4 text-sm tabular-nums">
          <div className="flex justify-between font-medium text-zinc-600">
            <dt>Subtotal</dt>
            <dd>{peso(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between font-medium text-zinc-600">
              <dt>Discount</dt>
              <dd className="text-brand-700">−{peso(order.discount)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-extrabold">
            <dt>Total{order.status === "pending" ? " (to be confirmed)" : ""}</dt>
            <dd>{peso(order.total)}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-extrabold">Payment</h2>
            {order.status !== "cancelled" && <PaymentBadge status={order.paymentStatus} />}
          </div>
          <dl className="mt-3 flex flex-col gap-1.5 text-sm tabular-nums">
            <div className="flex justify-between font-medium text-zinc-600">
              <dt>Paid</dt>
              <dd>{peso(order.paid)}</dd>
            </div>
            <div className="flex justify-between font-extrabold">
              <dt>Balance</dt>
              <dd className={order.balance > 0 && order.status !== "cancelled" ? "text-red-700" : ""}>{order.status === "cancelled" ? "—" : peso(order.balance)}</dd>
            </div>
          </dl>
          {order.payments.length > 0 ? (
            <ul className="mt-3 divide-y divide-zinc-100 border-t border-zinc-100 text-xs font-medium text-zinc-600">
              {order.payments.map((p) => (
                <li key={p.id} className="flex justify-between py-2 tabular-nums">
                  <span>
                    {fmtDate(p.paidAt)} · {PAYMENT_METHOD[p.method] ?? p.method}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </span>
                  <span className="font-bold text-zinc-900">{peso(p.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs font-medium text-zinc-500">
              {order.status === "pending" ? "Nothing to pay yet — wait for our confirmation." : "No payments recorded yet."}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-[15px] font-extrabold">Delivery &amp; notes</h2>
          {noteLines.length ? (
            <ul className="mt-3 flex flex-col gap-2 text-sm font-medium text-zinc-700">
              {noteLines.map((l, i) => {
                const idx = l.indexOf(":");
                const label = idx > 0 && idx < 24 ? l.slice(0, idx) : null;
                return (
                  <li key={i}>
                    {label ? (
                      <>
                        <span className="block text-[11px] font-bold tracking-wider text-zinc-500 uppercase">{label}</span>
                        {l.slice(idx + 1).trim()}
                      </>
                    ) : (
                      l
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-xs font-medium text-zinc-500">Delivering to {customer.address ?? "the address on your order"}.</p>
          )}
        </section>
      </div>
    </div>
  );
}
