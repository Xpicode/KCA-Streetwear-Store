import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getCustomer, getCustomerBalance, getCustomerOrders, getPriceGroups } from "@/lib/queries/customers";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader, Empty } from "@/components/ui/card";
import { LinkRow } from "@/components/admin/link-row";
import { CustomerStatusBadge, PaymentBadge, StatusBadge, fmtDate } from "@/components/admin/order-bits";
import { StatusButtons } from "../status-buttons";
import { CustomerForm } from "./customer-form";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) notFound();

  await requireAdmin();
  const [customer, orders, balance, priceGroups] = await Promise.all([
    getCustomer(customerId),
    getCustomerOrders(customerId),
    getCustomerBalance(customerId),
    getPriceGroups(),
  ]);
  if (!customer) notFound();

  const live = orders.filter((o) => o.status !== "cancelled");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <Link href="/admin/customers" className="mb-1 flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-800">
            <ArrowLeft className="size-3.5" />
            All customers
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight">{customer.shopName}</h1>
            <CustomerStatusBadge status={customer.status} />
          </div>
          <p className="text-sm font-medium text-zinc-500">
            Customer since {fmtDate(customer.createdAt)} · {live.length} {live.length === 1 ? "order" : "orders"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusButtons id={customer.id} status={customer.status} size="md" />
          <Link
            href="/admin/orders/new"
            className="flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white"
          >
            <Plus className="size-4" />
            New order
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Tile label="Total spent" value={peso(balance.spent)} sub="delivered and paid orders" />
        <Tile
          label="Unpaid balance"
          value={peso(Math.max(balance.unpaid, 0))}
          sub={balance.unpaid > 0 ? "on delivered orders" : "nothing outstanding"}
          tone={balance.unpaid > 0 ? "red" : "green"}
        />
        <Tile label="Price group" value={customer.priceGroup} sub="wholesale tier pricing" capitalize />
      </div>

      <div className="grid grid-cols-[1.6fr_1fr] items-start gap-4">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Order history" />
            {orders.length === 0 ? (
              <Empty>No orders yet.</Empty>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-5 py-2.5">Order</th>
                    <th className="px-4 py-2.5">Items</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                    <th className="px-4 py-2.5 text-right">Balance</th>
                    <th className="px-4 py-2.5">Payment</th>
                    <th className="px-5 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 tabular-nums">
                  {orders.map((o) => {
                    const due = o.status === "cancelled" ? 0 : Math.max(o.total - o.paid, 0);
                    return (
                      <LinkRow key={o.id} href={`/admin/orders/${o.id}`}>
                        <td className="px-5 py-3">
                          <Link href={`/admin/orders/${o.id}`} className="font-bold hover:underline">
                            {o.orderNo}
                          </Link>
                          <div className="text-xs font-medium text-zinc-500">{fmtDate(o.requestedAt)}</div>
                        </td>
                        <td className="px-4 py-3 text-zinc-600">
                          {o.units} pcs · {o.lines} {o.lines === 1 ? "line" : "lines"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold">{peso(o.total)}</td>
                        <td className={cn("px-4 py-3 text-right font-semibold", due > 0 ? "text-red-700" : "text-zinc-400")}>
                          {due > 0 ? peso(due) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <PaymentBadge status={o.paymentStatus} />
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={o.status} />
                        </td>
                      </LinkRow>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Profile" />
            <CardBody>
              <CustomerForm customer={customer} priceGroups={priceGroups} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
  capitalize,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "red" | "green";
  capitalize?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div
        className={cn(
          "text-2xl font-extrabold tabular-nums tracking-tight",
          tone === "red" && "text-red-700",
          tone === "green" && "text-emerald-700",
          capitalize && "capitalize"
        )}
      >
        {value}
      </div>
      <div className="text-xs font-semibold text-zinc-500">{sub}</div>
    </div>
  );
}
