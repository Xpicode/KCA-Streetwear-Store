import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, PackageOpen } from "lucide-react";
import { channelFromSlug, type ChannelInfo } from "@/lib/channel";
import { getShopper } from "@/lib/shopper";
import { TrackOrderForm } from "./track-form";
import { listCustomerOrders } from "@/lib/queries/shop-orders";
import { peso } from "@/lib/format";
import { fmtDate, OrderStatusBadge, PaymentBadge } from "@/components/shop/order-bits";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ params }: { params: Promise<{ channel: string }> }) {
  const { channel: slug } = await params;
  const channel = channelFromSlug(slug);
  if (!channel) notFound();
  const { base } = channel;
  const customer = await getShopper(channel.key);
  if (!customer) return <TrackOnly channel={channel} />;
  const rows = await listCustomerOrders(customer.id);
  const open = rows.filter((r) => !["paid", "cancelled"].includes(r.status));
  const owed = rows.filter((r) => r.status !== "cancelled").reduce((a, r) => a + r.balance, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">My orders</h1>
          <p className="text-sm font-medium text-zinc-500">
            {rows.length} {rows.length === 1 ? "order" : "orders"} · {open.length} in progress
            {owed > 0 ? ` · ${peso(owed)} unpaid` : ""}
          </p>
        </div>
        <Link href={base} className="hidden h-9 items-center rounded-lg border border-zinc-300 bg-white px-3 text-sm font-bold sm:flex">
          Shop again
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
          <PackageOpen className="mx-auto mb-3 size-8 text-zinc-400" />
          <p className="text-sm font-bold">No orders yet.</p>
          <p className="mt-1 text-sm font-medium text-zinc-500">Your order requests and their status will show here.</p>
          <Link href={base} className="mt-5 inline-flex h-10 items-center rounded-lg bg-brand-700 px-4 text-sm font-bold text-white">
            Browse the catalog
          </Link>
        </div>
      ) : (
        <>
          {/* desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-zinc-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-[11px] font-bold tracking-wider text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5">Order</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Items</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Payment</th>
                  <th className="px-4 py-2.5 text-right">Balance</th>
                  <th className="w-10 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 tabular-nums">
                {rows.map((o) => (
                  <tr key={o.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <Link href={`${base}/orders/${o.id}`} className="font-extrabold hover:underline">
                        {o.orderNo}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-700">{fmtDate(o.requestedAt)}</td>
                    <td className="max-w-xs px-4 py-3">
                      <div className="truncate font-medium text-zinc-800">{o.itemSummary}</div>
                      <div className="text-xs font-medium text-zinc-500">{o.units} pcs</div>
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold">{peso(o.total)}</td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-3">{o.status === "cancelled" ? <span className="text-zinc-400">—</span> : <PaymentBadge status={o.paymentStatus} />}</td>
                    <td className="px-4 py-3 text-right font-bold">{o.status === "cancelled" ? "—" : o.balance > 0 ? peso(o.balance) : <span className="text-zinc-400">₱0</span>}</td>
                    <td className="px-2 py-3 text-zinc-400">
                      <Link href={`${base}/orders/${o.id}`} aria-label={`Open ${o.orderNo}`} className="flex size-9 items-center justify-center rounded-lg hover:bg-zinc-100 hover:text-zinc-900">
                        <ChevronRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* phone cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((o) => (
              <li key={o.id}>
                <Link href={`${base}/orders/${o.id}`} className="block rounded-xl border border-zinc-200 bg-white p-4 active:bg-zinc-50">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-base font-extrabold">{o.orderNo}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-zinc-500">{fmtDate(o.requestedAt)}</p>
                  <p className="mt-2 truncate text-sm font-medium text-zinc-800">{o.itemSummary}</p>
                  <div className="mt-3 flex items-center justify-between tabular-nums">
                    <span className="text-xs font-medium text-zinc-500">{o.units} pcs</span>
                    <span className="flex items-center gap-2 text-sm">
                      {o.status !== "cancelled" && <PaymentBadge status={o.paymentStatus} />}
                      <span className="font-extrabold">{peso(o.total)}</span>
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function TrackOnly({ channel }: { channel: ChannelInfo }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 py-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Find your order</h1>
        <p className="text-sm font-medium text-zinc-500">
          Orders placed from this device show up here automatically. From another phone, enter an order number and its contact number — that opens that one order only.
        </p>
      </div>
      <TrackOrderForm channel={channel.key} />
      <Link href={channel.base} className="text-sm font-bold text-brand-700">
        ← Back to catalog
      </Link>
    </div>
  );
}
