"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";
import { deleteOrders } from "@/actions/orders";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PaymentBadge, StatusBadge, fmtDate, sourceLabel } from "@/components/admin/order-bits";
import type { OrderListRow } from "@/lib/queries/orders";

/**
 * Orders table with checkbox selection (header box = select all on this filter)
 * and a bulk-delete bar. Delete is owner-only and works on both views; the
 * engine releases reservations / returns packed stock before removing an order.
 */
export function OrdersTable({ rows, canDelete, emptyText }: { rows: OrderListRow[]; canDelete: boolean; emptyText: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const picked = ids.filter((id) => selected.has(id));
  const allPicked = ids.length > 0 && picked.length === ids.length;

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () => setSelected(allPicked ? new Set() : new Set(ids));

  const onDelete = () => {
    const hasDelivered = rows.some((r) => selected.has(r.id) && r.status === "delivered");
    const hasLive = rows.some((r) => selected.has(r.id) && ["confirmed", "packed", "paid"].includes(r.status));
    const lines = [
      `Delete ${picked.length} ${picked.length === 1 ? "order" : "orders"} permanently?`,
      hasDelivered ? "Delivered orders lose their numbers in the profit reports." : null,
      hasLive ? "In-progress orders return their stock to the shelf first." : null,
      "This cannot be undone.",
    ].filter(Boolean);
    if (!window.confirm(lines.join("\n\n"))) return;
    setError(null);
    start(async () => {
      const res = await deleteOrders(picked);
      if (res?.error && !res.ok) setError(res.error);
      else {
        if (res?.error) setError(res.error);
        setSelected(new Set());
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {canDelete && picked.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-900">
          <span className="font-extrabold tabular-nums">
            {picked.length} of {ids.length} selected
          </span>
          <button onClick={toggleAll} className="font-bold text-emerald-700 underline-offset-2 hover:underline">
            {allPicked ? "Clear all" : "Select all"}
          </button>
          <span className="flex-1" />
          <button
            onClick={onDelete}
            disabled={busy}
            className="flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            <Trash2 className="size-4" />
            {busy ? "Deleting…" : `Delete ${picked.length}`}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            title="Clear selection"
            className="rounded-md p-1.5 text-emerald-700/60 hover:bg-emerald-100 hover:text-emerald-900"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            <tr>
              {canDelete && (
                <th className="w-11 px-3 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Select all orders in this list"
                    checked={allPicked}
                    onChange={toggleAll}
                    className="size-4 accent-emerald-700"
                  />
                </th>
              )}
              <th className="px-4 py-2.5">Order</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Items</th>
              <th className="px-4 py-2.5 text-right">Total</th>
              <th className="px-4 py-2.5">Payment</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 tabular-nums">
            {rows.length === 0 && (
              <tr>
                <td colSpan={canDelete ? 7 : 6} className="px-4 py-12 text-center text-zinc-500">
                  {emptyText}
                </td>
              </tr>
            )}
            {rows.map((o) => (
              <tr
                key={o.id}
                className={cn("cursor-pointer hover:bg-zinc-50", selected.has(o.id) && "bg-emerald-50/60 hover:bg-emerald-50")}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("a, button, input, select, textarea, label")) return;
                  router.push(`/admin/orders/${o.id}`);
                }}
              >
                {canDelete && (
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${o.orderNo}`}
                      checked={selected.has(o.id)}
                      onChange={() => toggle(o.id)}
                      className="size-4 accent-emerald-700"
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-bold hover:underline">
                    {o.orderNo}
                  </Link>
                  <div className="text-xs font-medium text-zinc-500">{fmtDate(o.requestedAt)}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold">{o.customer}</div>
                  <div className="text-xs font-medium text-zinc-500">{sourceLabel(o.source)}</div>
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {o.units} pcs · {o.lines} {o.lines === 1 ? "line" : "lines"}
                </td>
                <td className="px-4 py-3 text-right font-bold">{peso(o.total)}</td>
                <td className="px-4 py-3">
                  <PaymentBadge status={o.paymentStatus} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
