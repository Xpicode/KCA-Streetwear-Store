import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, PackagePlus, Pencil } from "lucide-react";
import { getProductDetail, getProductProfit } from "@/lib/queries/product-detail";
import { ProfitChart } from "@/components/admin/profit-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Empty } from "@/components/ui/card";
import { peso } from "@/lib/format";
import { marginPercent, type Period } from "@/lib/profit";
import { cn } from "@/lib/utils";
import { AdjustForm } from "./adjust-form";

export const dynamic = "force-dynamic";

const PERIODS: { key: Period; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

const MOVEMENT: Record<string, { label: string; tone: "green" | "blue" | "amber" | "indigo" }> = {
  in: { label: "Stock-in", tone: "green" },
  sale: { label: "Sale", tone: "blue" },
  adjust: { label: "Adjust", tone: "amber" },
  return: { label: "Return", tone: "indigo" },
};

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const [{ id: raw }, { period: rawPeriod }] = await Promise.all([params, searchParams]);
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();
  const period: Period = rawPeriod === "day" || rawPeriod === "month" ? rawPeriod : "week";

  const [p, profit] = await Promise.all([getProductDetail(id), getProductProfit(id, period)]);
  if (!p) notFound();

  const margin = marginPercent(p.basePrice - p.avgCost, p.basePrice);
  const low = p.stockOnHand <= p.reorderLevel;
  const periodMargin = marginPercent(profit.profit, profit.revenue);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin/products" className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-800">
            <ChevronLeft className="size-3.5" />
            Products
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-extrabold tracking-tight">{p.name}</h1>
            <Badge tone={p.isActive ? "green" : "red"}>{p.isActive ? "Active" : "Inactive"}</Badge>
          </div>
          <p className="text-sm font-medium text-zinc-500">
            {p.sku} · {p.category ?? "No category"} · per {p.unit} · MOQ {p.moq}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/products/${p.id}/edit`}
            className="flex h-9 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-bold hover:bg-zinc-50"
          >
            <Pencil className="size-4" />
            Edit
          </Link>
          <Link
            href={`/admin/stock-in?product=${p.id}`}
            className="flex h-9 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-bold text-white hover:bg-emerald-800"
          >
            <PackagePlus className="size-4" />
            Stock-in
          </Link>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-5 gap-4">
        <Tile label="Cost" value={p.avgCost ? peso(p.avgCost) : "—"} sub="weighted avg of open batches" />
        <Tile label="Price" value={peso(p.basePrice)} sub={p.tiers.length ? `${p.tiers.length} quantity tier${p.tiers.length > 1 ? "s" : ""}` : "no tiers"} />
        <Tile
          label="Margin"
          value={p.avgCost ? `${Math.round(margin)}%` : "—"}
          sub={p.avgCost ? `${peso(p.basePrice - p.avgCost)} per ${p.unit}` : "no cost yet"}
          accent
        />
        <Tile
          label="Stock on hand"
          value={p.stockOnHand.toLocaleString("en-PH")}
          sub={low ? `below reorder level ${p.reorderLevel}` : `reorder at ${p.reorderLevel}`}
          warn={low}
        />
        <Tile
          label="Reserved"
          value={p.stockReserved.toLocaleString("en-PH")}
          sub={`${Math.max(0, p.stockOnHand - p.stockReserved).toLocaleString("en-PH")} available to sell`}
        />
      </div>

      {/* Profit earned */}
      <Card>
        <CardHeader
          title="Profit earned"
          action={
            <div className="flex h-9 items-center gap-0.5 rounded-lg bg-zinc-200/70 p-0.5">
              {PERIODS.map((x) => (
                <Link
                  key={x.key}
                  href={x.key === "week" ? `/admin/products/${p.id}` : `/admin/products/${p.id}?period=${x.key}`}
                  className={cn(
                    "h-8 rounded-md px-3 text-sm font-bold leading-8",
                    x.key === period ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  {x.label}
                </Link>
              ))}
            </div>
          }
        />
        <CardBody className="grid grid-cols-[220px_1fr] gap-6">
          <div className="flex flex-col gap-4">
            <Stat label="Profit" value={peso(profit.profit)} sub={`${Math.round(periodMargin)}% margin`} big />
            <Stat label="Units sold" value={profit.units.toLocaleString("en-PH")} sub={`${profit.orders} order${profit.orders === 1 ? "" : "s"} delivered`} />
            <Stat label="Revenue" value={peso(profit.revenue)} sub={`${peso(profit.cost)} cost of goods`} />
            <p className="text-[11px] font-medium text-zinc-500">{rangeLabel(period, profit.start, profit.end)}</p>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">Profit per day · last 14 days</div>
            <ProfitChart data={profit.series} />
          </div>
        </CardBody>
      </Card>

      {/* Stock by variant */}
      <Card>
        <CardHeader
          title="Stock by variant"
          action={<span className="text-xs font-semibold text-zinc-500">Adjust: pick − or +, a qty and a reason</span>}
        />
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-5 py-2.5">Size</th>
              <th className="px-5 py-2.5">Color</th>
              <th className="px-5 py-2.5 text-right">On hand</th>
              <th className="px-5 py-2.5 text-right">Reserved</th>
              <th className="px-5 py-2.5 text-right">Available</th>
              <th className="px-5 py-2.5">Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 tabular-nums">
            {p.variants.map((v) => {
              const available = v.stockOnHand - v.stockReserved;
              return (
                <tr key={v.id} className={cn("hover:bg-zinc-50", !v.isActive && "text-zinc-400")}>
                  <td className="px-5 py-2.5 font-bold">
                    {v.size ?? (v.color ? "—" : "Default")}
                    {!v.isActive && <Badge tone="neutral" className="ml-2">Inactive</Badge>}
                  </td>
                  <td className="px-5 py-2.5 font-medium">
                    {v.color ?? "—"}
                    {v.priceOverride != null && <span className="ml-2 text-xs text-zinc-500">{peso(v.priceOverride)} override</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right font-bold">{v.stockOnHand}</td>
                  <td className="px-5 py-2.5 text-right text-zinc-600">{v.stockReserved}</td>
                  <td className={cn("px-5 py-2.5 text-right font-extrabold", available <= 0 ? "text-red-600" : "text-emerald-700")}>{available}</td>
                  <td className="px-5 py-2">
                    <AdjustForm variantId={v.id} onHand={v.stockOnHand} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-[1fr_1.6fr] gap-4">
        {/* Price tiers */}
        <Card>
          <CardHeader title="Price tiers" action={<Link href={`/admin/products/${p.id}/edit`} className="text-xs font-bold text-emerald-700">Edit</Link>} />
          {p.tiers.length === 0 ? (
            <Empty>No quantity discounts. Every order pays {peso(p.basePrice)} per {p.unit}.</Empty>
          ) : (
            <ul className="divide-y divide-zinc-100 text-sm tabular-nums">
              <li className="flex items-center justify-between px-5 py-2.5">
                <span className="font-medium text-zinc-600">1 – {Math.min(...p.tiers.map((t) => t.minQty)) - 1} pcs</span>
                <span className="font-bold">{peso(p.basePrice)}</span>
              </li>
              {p.tiers.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-5 py-2.5">
                  <span className="font-medium text-zinc-600">
                    {t.minQty}+ pcs
                    {t.priceGroup && <Badge tone="indigo" className="ml-2">{t.priceGroup}</Badge>}
                  </span>
                  <span className="font-bold">
                    {peso(t.price)}
                    <span className="ml-2 text-xs font-semibold text-emerald-700">
                      {p.basePrice ? `−${Math.round((1 - t.price / p.basePrice) * 100)}%` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Stock batches */}
        <Card>
          <CardHeader title="Stock batches" action={<span className="text-xs font-semibold text-zinc-500">{p.batches.length} batches</span>} />
          {p.batches.length === 0 ? (
            <Empty>No stock received yet. Use Stock-in to record a purchase.</Empty>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-5 py-2">Received</th>
                    <th className="px-5 py-2">Variant</th>
                    <th className="px-5 py-2">Supplier</th>
                    <th className="px-5 py-2 text-right">Received</th>
                    <th className="px-5 py-2 text-right">Left</th>
                    <th className="px-5 py-2 text-right whitespace-nowrap">Unit cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 tabular-nums">
                  {p.batches.map((b) => (
                    <tr key={b.id} className={cn(b.qtyRemaining === 0 && "text-zinc-400")}>
                      <td className="px-5 py-2 whitespace-nowrap">{fmtDate(b.receivedAt)}</td>
                      <td className="px-5 py-2 font-medium whitespace-nowrap">{b.variantLabel}</td>
                      <td className="px-5 py-2">
                        {b.supplier ?? "—"}
                        {b.reference && <div className="text-xs font-medium text-zinc-500">{b.reference}</div>}
                      </td>
                      <td className="px-5 py-2 text-right">{b.qtyReceived}</td>
                      <td className="px-5 py-2 text-right font-bold">{b.qtyRemaining}</td>
                      <td className="px-5 py-2 text-right">{peso(b.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Recent movements */}
      <Card>
        <CardHeader title="Recent movements" action={<span className="text-xs font-semibold text-zinc-500">last 20</span>} />
        {p.movements.length === 0 ? (
          <Empty>No stock movements yet.</Empty>
        ) : (
          <ul className="divide-y divide-zinc-100 text-sm">
            {p.movements.map((m) => {
              const mv = MOVEMENT[m.type];
              return (
                <li key={m.id} className="flex items-center gap-4 px-5 py-2.5">
                  <Badge tone={mv.tone} className="w-20 text-center">
                    {mv.label}
                  </Badge>
                  <span className={cn("w-14 text-right font-extrabold tabular-nums", m.qty < 0 ? "text-red-600" : "text-emerald-700")}>
                    {m.qty > 0 ? `+${m.qty}` : m.qty}
                  </span>
                  <span className="w-32 font-medium">{m.variantLabel}</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-600">{m.note ?? "—"}</span>
                  <span className="whitespace-nowrap text-xs font-semibold text-zinc-500">
                    {fmtDateTime(m.createdAt)}
                    {m.by ? ` · ${m.by}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ---- small presentational pieces -------------------------------------------

function Tile({ label, value, sub, accent, warn }: { label: string; value: string; sub: string; accent?: boolean; warn?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border p-5",
        accent ? "border-emerald-700 bg-emerald-700 text-white" : warn ? "border-red-200 bg-red-50" : "border-zinc-200 bg-white"
      )}
    >
      <div className={cn("text-[11px] font-bold uppercase tracking-wider", accent ? "text-emerald-100" : warn ? "text-red-700" : "text-zinc-500")}>{label}</div>
      <div className={cn("text-3xl font-extrabold tabular-nums tracking-tight", warn && "text-red-700")}>{value}</div>
      <div className={cn("text-xs font-semibold", accent ? "text-emerald-100" : warn ? "text-red-700" : "text-zinc-500")}>{sub}</div>
    </div>
  );
}

function Stat({ label, value, sub, big }: { label: string; value: string; sub: string; big?: boolean }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={cn("font-extrabold tabular-nums tracking-tight", big ? "text-3xl" : "text-xl")}>{value}</div>
      <div className="text-xs font-semibold text-zinc-500">{sub}</div>
    </div>
  );
}

const fmtDate = (d: Date) => d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });
const fmtDateTime = (d: Date) =>
  d.toLocaleString("en-PH", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function rangeLabel(period: Period, start: Date, end: Date) {
  const f = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-PH", opts);
  if (period === "day") return `Today · ${f(end, { weekday: "short", day: "numeric", month: "short" })}`;
  if (period === "week") return `Last 7 days · ${f(start, { day: "numeric", month: "short" })} – ${f(end, { day: "numeric", month: "short" })}`;
  return `This month · ${f(start, { day: "numeric", month: "short" })} – ${f(end, { day: "numeric", month: "short" })}`;
}
