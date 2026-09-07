import Link from "next/link";
import { Plus } from "lucide-react";
import {
  ORDER_SORTS,
  getOrderCounts,
  getOrders,
  type OrderSort,
  type OrderTab,
  type OrderView,
} from "@/lib/queries/orders";
import { getAdminUser, requireAdmin } from "@/lib/auth";
import { OrderFilters } from "./order-filters";
import { OrdersTable } from "./orders-table";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ view?: string; status?: string; q?: string; sort?: string }>;

const ACTIVE_TABS: OrderTab[] = ["all", "pending", "confirmed", "packed", "paid", "unpaid"];
const HISTORY_TABS: OrderTab[] = ["all", "delivered", "cancelled"];

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const view: OrderView = sp.view === "history" ? "history" : "active";
  const validTabs = view === "history" ? HISTORY_TABS : ACTIVE_TABS;
  const tab: OrderTab = (validTabs as string[]).includes(sp.status ?? "") ? (sp.status as OrderTab) : "all";
  const sort: OrderSort = (ORDER_SORTS as readonly string[]).includes(sp.sort ?? "")
    ? (sp.sort as OrderSort)
    : view === "active"
      ? "status"
      : "newest";

  const [rows, counts, user] = await Promise.all([getOrders({ view, tab, q: sp.q, sort }), getOrderCounts(), getAdminUser()]);
  const canDelete = user?.role === "owner";
  counts.byTab.all = view === "history" ? counts.historyTotal : counts.activeTotal;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Orders</h1>
          <p className="text-sm font-medium text-zinc-500">
            {view === "active" ? "In progress — finished orders move to History" : "Delivered and cancelled orders"}
            {sp.q ? ` · matching “${sp.q}”` : ""}
          </p>
        </div>
        <Link href="/admin/orders/new" className="flex h-9 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white">
          <Plus className="size-4" />
          New order
        </Link>
      </div>

      <OrderFilters view={view} active={tab} sort={sort} counts={counts} tabs={validTabs} />

      <OrdersTable
        rows={rows}
        canDelete={canDelete}
        emptyText={
          sp.q || tab !== "all"
            ? "No orders match this filter."
            : view === "history"
              ? "Nothing here yet. Orders land in History once they are Delivered or Cancelled."
              : "No orders in progress. Storefront requests and manual orders will show up here."
        }
      />

      {canDelete && rows.length > 0 && (
        <p className="text-xs font-medium text-zinc-500">
          Deleting is permanent. In-progress orders return their stock first; delivered orders disappear from profit reports — use it for
          test orders and mistakes, not bookkeeping.
        </p>
      )}
    </div>
  );
}
