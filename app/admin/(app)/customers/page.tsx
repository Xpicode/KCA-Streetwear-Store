import Link from "next/link";
import { getCustomerStatusCounts, getCustomers } from "@/lib/queries/customers";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LinkRow } from "@/components/admin/link-row";
import { CustomerStatusBadge } from "@/components/admin/order-bits";
import { StatusButtons } from "./status-buttons";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "blocked", label: "Blocked" },
] as const;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status } = await searchParams;
  const filter = status === "pending" || status === "approved" || status === "blocked" ? status : undefined;
  const [rows, counts] = await Promise.all([getCustomers({ status: filter }), getCustomerStatusCounts()]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Customers</h1>
          <p className="text-sm font-medium text-zinc-500">
            {counts.pending > 0 ? `${counts.pending} waiting for approval · ` : ""}
            {counts.approved} approved · spent and unpaid count delivered orders only
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = (filter ?? "") === f.key;
          const n = f.key ? counts[f.key] : counts.all;
          return (
            <Link
              key={f.key}
              href={f.key ? `/admin/customers?status=${f.key}` : "/admin/customers"}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold",
                active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              )}
            >
              {f.label}
              <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", active ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500")}>{n}</span>
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2.5">Shop</th>
              <th className="px-4 py-2.5">Contact</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Price group</th>
              <th className="px-4 py-2.5 text-right">Orders</th>
              <th className="px-4 py-2.5 text-right">Total spent</th>
              <th className="px-4 py-2.5 text-right">Unpaid</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 tabular-nums">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                  {filter ? `No ${filter} customers.` : "No customers yet. Buyers are added automatically when they send their first order request."}
                </td>
              </tr>
            )}
            {rows.map((c) => {
              return (
                <LinkRow key={c.id} href={`/admin/customers/${c.id}`}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${c.id}`} className="font-bold hover:underline">
                      {c.shopName}
                    </Link>
                    {c.email && <div className="text-xs font-medium text-zinc-500">{c.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.contactName ?? "—"}</div>
                    <div className="text-xs font-medium text-zinc-500">{c.phone ?? ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <CustomerStatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 capitalize text-zinc-700">{c.priceGroup}</td>
                  <td className="px-4 py-3 text-right text-zinc-700">{c.orders}</td>
                  <td className="px-4 py-3 text-right font-bold">{peso(c.spent)}</td>
                  <td className={cn("px-4 py-3 text-right font-bold", c.unpaid > 0 ? "text-red-700" : "text-zinc-400")}>
                    {c.unpaid > 0 ? peso(c.unpaid) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusButtons id={c.id} status={c.status} />
                  </td>
                </LinkRow>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
