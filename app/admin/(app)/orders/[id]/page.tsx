import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { getOrder } from "@/lib/queries/orders";
import { peso } from "@/lib/format";
import { marginPercent } from "@/lib/profit";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader, Empty } from "@/components/ui/card";
import { PaymentBadge, StatusBadge, fmtDate, fmtDateTime, pesoExact, sourceLabel } from "@/components/admin/order-bits";
import { ActionsBar } from "./actions-bar";
import { DeleteOrderButton } from "../delete-order-button";
import { getAdminUser, requireAdmin } from "@/lib/auth";
import { NoteForm } from "./note-form";

export const dynamic = "force-dynamic";

const STEPS = [
  { key: "pending", label: "Requested", at: "requestedAt" },
  { key: "confirmed", label: "Confirmed", at: "confirmedAt" },
  { key: "packed", label: "Packed", at: "packedAt" },
  { key: "paid", label: "Paid", at: null },
  { key: "delivered", label: "Delivered", at: "deliveredAt" },
] as const;

const METHOD_LABEL: Record<string, string> = { cash: "Cash", bank: "Bank transfer", ewallet: "E-wallet" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();
  const o = await getOrder(orderId);
  const user = await getAdminUser();
  if (!o) notFound();

  const stepIndex = STEPS.findIndex((s) => s.key === o.status);
  const cancelled = o.status === "cancelled";
  const margin = marginPercent(o.profit, o.total);
  const lastPayment = o.payments[0]?.paidAt ?? null;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/orders" className="mb-1 flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-800">
            <ArrowLeft className="size-3.5" />
            All orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight">Order {o.orderNo}</h1>
            <StatusBadge status={o.status} />
            <PaymentBadge status={o.paymentStatus} />
          </div>
          <p className="text-sm font-medium text-zinc-500">
            {sourceLabel(o.source)} · requested {fmtDateTime(o.requestedAt)}
            {o.handledBy ? ` · handled by ${o.handledBy}` : ""}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Order total</div>
          <div className="text-3xl font-extrabold tabular-nums tracking-tight">{peso(o.total)}</div>
          <div className="text-xs font-semibold text-zinc-500">
            {o.units} pcs · {o.items.length} {o.items.length === 1 ? "line" : "lines"}
          </div>
        </div>
      </div>

      {/* Status track */}
      <Card>
        <CardBody className="px-5 py-4">
          {cancelled ? (
            <div className="flex items-center gap-3 text-sm">
              <StatusBadge status="cancelled" />
              <span className="font-medium text-zinc-600">
                This order was cancelled{o.confirmedAt ? " after confirmation; the reserved stock was released" : ""}. It does not count toward sales or profit.
              </span>
            </div>
          ) : (
            <ol className="flex items-start">
              {STEPS.map((s, i) => {
                const done = i <= stepIndex;
                const current = i === stepIndex;
                const at = s.at ? o[s.at] : o.status === "paid" ? lastPayment : null;
                return (
                  <li key={s.key} className="relative flex flex-1 flex-col items-center gap-1.5 text-center">
                    {i > 0 && (
                      <div
                        className={cn("absolute top-3.5 right-1/2 left-[-50%] h-0.5", i <= stepIndex ? "bg-brand-600" : "bg-zinc-200")}
                      />
                    )}
                    <div
                      className={cn(
                        "relative z-10 flex size-7 items-center justify-center rounded-full border-2 text-xs font-extrabold",
                        done ? "border-brand-600 bg-brand-600 text-white" : "border-zinc-300 bg-white text-zinc-400",
                        current && "ring-4 ring-brand-100"
                      )}
                    >
                      {done ? <Check className="size-4" /> : i + 1}
                    </div>
                    <div className={cn("text-xs font-bold", done ? "text-zinc-900" : "text-zinc-400")}>{s.label}</div>
                    <div className="text-[11px] font-medium text-zinc-500">{done && at ? fmtDateTime(at) : done ? "" : "—"}</div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardBody>
      </Card>

      {/* Actions */}
      {!cancelled && (
        <Card>
          <CardBody className="px-5 py-4">
            <ActionsBar orderId={o.id} status={o.status} paymentStatus={o.paymentStatus} balance={Math.max(o.balance, 0)} />
          </CardBody>
        </Card>
      )}
      {(o.status === "delivered" || o.status === "cancelled") && user?.role === "owner" && (
        <Card>
          <CardBody className="flex items-center justify-between gap-4 px-5 py-4">
            <p className="text-sm font-medium text-zinc-500">
              This order is finished. Deleting it is permanent{o.status === "delivered" ? " and removes its profit from reports" : ""}.
            </p>
            <DeleteOrderButton orderId={o.id} orderNo={o.orderNo} status={o.status} redirectTo="/admin/orders?view=history" labeled />
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] items-start gap-4">
        {/* Left: lines + payments */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Lines"
              action={
                o.costed ? (
                  <span className="text-xs font-semibold text-zinc-500">Cost snapshot taken at packing</span>
                ) : (
                  <span className="text-xs font-semibold text-zinc-500">Cost and profit appear once packed</span>
                )
              }
            />
            <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
              <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-2.5">Product</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5 text-right">Unit price</th>
                  <th className="px-4 py-2.5 text-right">Line total</th>
                  <th className="px-4 py-2.5 text-right">Unit cost</th>
                  <th className="px-5 py-2.5 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 tabular-nums">
                {o.items.map((i) => {
                  const opt = [i.size, i.color].filter(Boolean).join(" / ");
                  const available = i.onHand - i.reserved;
                  return (
                    <tr key={i.id}>
                      <td className="px-5 py-3">
                        <Link href={`/admin/products/${i.productId}`} className="font-bold hover:underline">
                          {i.productName}
                        </Link>
                        <div className="text-xs font-medium text-zinc-500">
                          {i.sku}
                          {opt ? ` · ${opt}` : ""}
                          {(o.status === "pending" || o.status === "confirmed") && (
                            <span className={cn("ml-2", available < i.qty && o.status === "pending" ? "text-red-600" : "text-zinc-400")}>
                              {o.status === "pending" ? `${available} available` : `${i.onHand} on hand`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{i.qty}</td>
                      <td className="px-4 py-3 text-right">{pesoExact(i.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-bold">{pesoExact(i.lineTotal)}</td>
                      <td className="px-4 py-3 text-right text-zinc-600">{i.unitCost != null ? pesoExact(i.unitCost) : "—"}</td>
                      <td className="px-5 py-3 text-right font-extrabold text-brand-700">
                        {i.lineProfit != null ? pesoExact(i.lineProfit) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </Card>

          <Card>
            <CardHeader title="Payments" action={<span className="text-xs font-semibold text-zinc-500">{pesoExact(o.paid)} received</span>} />
            {o.payments.length === 0 ? (
              <Empty>No payments recorded yet.</Empty>
            ) : (
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
                <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-5 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Method</th>
                    <th className="px-4 py-2.5">Reference</th>
                    <th className="px-5 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 tabular-nums">
                  {o.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3 font-semibold">{fmtDate(p.paidAt)}</td>
                      <td className="px-4 py-3">{METHOD_LABEL[p.method] ?? p.method}</td>
                      <td className="px-4 py-3 text-zinc-600">{p.reference ?? "—"}</td>
                      <td className="px-5 py-3 text-right font-bold">{pesoExact(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </Card>
        </div>

        {/* Right: customer, totals, note */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Customer"
              action={
                <Link href={`/admin/customers/${o.customer.id}`} className="text-xs font-bold text-brand-700">
                  View customer
                </Link>
              }
            />
            <CardBody className="flex flex-col gap-1 text-sm">
              <div className="font-extrabold">{o.customer.shopName}</div>
              <div className="font-medium text-zinc-700">{o.customer.contactName ?? "—"}</div>
              <div className="font-medium text-zinc-700">{o.customer.phone ?? "—"}</div>
              {o.customer.email && <div className="font-medium text-zinc-700">{o.customer.email}</div>}
              <div className="mt-1 text-zinc-500">{o.customer.address ?? "No address on file"}</div>
              <div className="mt-2 text-xs font-semibold text-zinc-500">
                Price group: <span className="capitalize text-zinc-800">{o.customer.priceGroup}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Totals" />
            <CardBody className="flex flex-col gap-1.5 text-sm tabular-nums">
              <Row label="Subtotal" value={pesoExact(o.subtotal)} />
              <Row label="Discount" value={o.discount ? `− ${pesoExact(o.discount)}` : "—"} />
              <Row label="Total" value={pesoExact(o.total)} strong />
              <div className="my-1 border-t border-zinc-100" />
              {o.costed ? (
                <>
                  <Row label="Cost of goods" value={pesoExact(o.cost)} />
                  <Row label="Gross profit" value={pesoExact(o.profit)} strong accent sub={`${margin.toFixed(1)}% margin`} />
                </>
              ) : (
                <Row label="Profit" value="after packing" muted />
              )}
              <div className="my-1 border-t border-zinc-100" />
              <Row label="Payments received" value={pesoExact(o.paid)} />
              <Row
                label="Balance due"
                value={cancelled ? "—" : pesoExact(Math.max(o.balance, 0))}
                strong
                className={cancelled ? "text-zinc-400" : o.balance > 0 ? "text-red-700" : "text-brand-700"}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Internal note" />
            <CardBody>
              <NoteForm orderId={o.id} note={o.note} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  accent,
  muted,
  sub,
  className,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: boolean;
  muted?: boolean;
  sub?: string;
  className?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-medium text-zinc-500">{label}</span>
      <span className={cn("text-right", strong ? "text-base font-extrabold" : "font-semibold", accent && "text-brand-700", muted && "text-zinc-400", className)}>
        {value}
        {sub && <span className="ml-1.5 text-xs font-semibold text-zinc-500">{sub}</span>}
      </span>
    </div>
  );
}
