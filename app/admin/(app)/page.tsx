import Link from "next/link";
import { Plus } from "lucide-react";
import { getDashboard } from "@/lib/queries/dashboard";
import { peso } from "@/lib/format";
import { marginPercent, type Period } from "@/lib/profit";
import { cn } from "@/lib/utils";
import { ProfitChart } from "@/components/admin/profit-chart";
import { LinkRow } from "@/components/admin/link-row";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  confirmed: "bg-indigo-50 text-indigo-700",
  packed: "bg-blue-50 text-blue-700",
  paid: "bg-emerald-50 text-emerald-700",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "To pack",
  packed: "Awaiting payment",
  paid: "To deliver",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const { period: raw } = await searchParams;
  const period: Period = raw === "day" || raw === "month" ? raw : "week";
  const d = await getDashboard(period);
  const margin = marginPercent(d.kpis.profit, d.kpis.revenue);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Profit overview</h1>
          <p className="text-sm font-medium text-zinc-500">{rangeLabel(period, d.start, d.end)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-9 items-center gap-0.5 rounded-lg bg-zinc-200/70 p-0.5">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={p.key === "week" ? "/admin" : `/admin?period=${p.key}`}
                className={cn(
                  "h-8 rounded-md px-3 text-sm font-bold leading-8",
                  p.key === period ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                {p.label}
              </Link>
            ))}
          </div>
          <Link
            href="/admin/orders/new"
            className="flex h-9 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white"
          >
            <Plus className="size-4" />
            New order
          </Link>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-4 gap-4">
        <Tile
          label="Gross profit"
          value={peso(d.kpis.profit)}
          sub={`${Math.round(margin)}% margin`}
          accent
        />
        <Tile label="Revenue" value={peso(d.kpis.revenue)} sub={`${d.kpis.orders} orders delivered`} />
        <Tile label="Cost of goods" value={peso(d.kpis.cost)} sub="cost snapshot at packing" />
        <Tile
          label="Units sold"
          value={d.kpis.units.toLocaleString("en-PH")}
          sub={d.kpis.orders ? `avg ${Math.round(d.kpis.units / d.kpis.orders)} pcs per order` : "no orders yet"}
        />
      </div>

      {/* Chart + top products */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-4">
        <Card title={`Profit by ${period === "day" ? "hour" : "day"}`}>
          <ProfitChart data={d.series} />
        </Card>

        <Card title="Top products by profit" action={<Link href="/admin/products" className="text-xs font-bold text-emerald-700">All products</Link>}>
          {d.top.length === 0 ? (
            <Empty>No delivered orders in this period.</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {d.top.map((t) => {
                const w = Math.round((t.profit / d.top[0].profit) * 100);
                return (
                  <li key={t.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <Link href={`/admin/products/${t.id}`} className="font-bold hover:underline">
                        {t.name}
                      </Link>
                      <span className="font-extrabold tabular-nums">{peso(t.profit)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        <div className="h-full rounded-full bg-emerald-700" style={{ width: `${w}%` }} />
                      </div>
                      <span className="w-24 text-right text-[11px] font-semibold tabular-nums text-zinc-500">
                        {t.units} pcs · {Math.round(marginPercent(t.profit, t.revenue))}%
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Orders needing action + low stock */}
      <div className="grid grid-cols-[1.6fr_1fr] gap-4">
        <Card
          title="Orders needing action"
          action={
            <div className="flex gap-1.5">
              <Pill className={STATUS_STYLE.pending}>{d.actionCounts.pending} pending</Pill>
              <Pill className={STATUS_STYLE.confirmed}>{d.actionCounts.confirmed} to pack</Pill>
              <Pill className={STATUS_STYLE.packed}>{d.actionCounts.packed} awaiting payment</Pill>
              <Pill className={STATUS_STYLE.paid}>{d.actionCounts.paid} to deliver</Pill>
            </div>
          }
          flush
        >
          {d.action.length === 0 ? (
            <Empty>Nothing waiting. New storefront requests will show up here.</Empty>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-5 py-2">Order</th>
                  <th className="px-5 py-2">Customer</th>
                  <th className="px-5 py-2">Items</th>
                  <th className="px-5 py-2 text-right">Total</th>
                  <th className="px-5 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 tabular-nums">
                {d.action.map((o) => (
                  <LinkRow key={o.id} href={`/admin/orders/${o.id}`}>
                    <td className="px-5 py-2.5 font-bold">
                      <span className="hover:underline">{o.orderNo}</span>
                    </td>
                    <td className="px-5 py-2.5">{o.customer}</td>
                    <td className="px-5 py-2.5 text-zinc-500">
                      {o.units} pcs · {o.lines} lines
                    </td>
                    <td className="px-5 py-2.5 text-right font-bold">{peso(o.total)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <Pill className={STATUS_STYLE[o.status]}>{STATUS_LABEL[o.status]}</Pill>
                    </td>
                  </LinkRow>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card
          title="Low stock"
          action={<Link href="/admin/stock-in" className="text-xs font-bold text-emerald-700">Create stock-in</Link>}
          flush
        >
          {d.low.length === 0 ? (
            <Empty>Every product is above its reorder level.</Empty>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm">
              {d.low.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-zinc-50"
                  >
                    <div>
                      <div className="font-bold">{p.name}</div>
                      <div className="text-[11px] font-semibold text-zinc-500">{p.sku}</div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className={cn("font-extrabold", p.stock <= p.reorderLevel / 2 ? "text-red-600" : "text-amber-700")}>
                        {p.stock} left
                      </div>
                      <div className="text-[11px] font-semibold text-zinc-500">reorder at {p.reorderLevel}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// ---- small presentational pieces -------------------------------------------

function Tile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border p-5",
        accent ? "border-emerald-700 bg-emerald-700 text-white" : "border-zinc-200 bg-white"
      )}
    >
      <div className={cn("text-[11px] font-bold uppercase tracking-wider", accent ? "text-emerald-100" : "text-zinc-500")}>
        {label}
      </div>
      <div className="text-3xl font-extrabold tabular-nums tracking-tight">{value}</div>
      <div className={cn("text-xs font-semibold", accent ? "text-emerald-100" : "text-zinc-500")}>{sub}</div>
    </div>
  );
}

function Card({
  title,
  action,
  flush,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-extrabold">{title}</h2>
        {action}
      </div>
      <div className={flush ? "" : "px-5 pb-5"}>{children}</div>
    </section>
  );
}

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", className)}>
      {children}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm font-medium text-zinc-500">{children}</p>;
}

function rangeLabel(period: Period, start: Date, end: Date) {
  const f = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-PH", opts);
  if (period === "day") return `Today · ${f(end, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}`;
  if (period === "week") return `Last 7 days · ${f(start, { day: "numeric", month: "short" })} – ${f(end, { day: "numeric", month: "short", year: "numeric" })}`;
  return `This month · ${f(start, { day: "numeric", month: "short" })} – ${f(end, { day: "numeric", month: "short", year: "numeric" })}`;
}
