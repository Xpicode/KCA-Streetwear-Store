import Link from "next/link";
import { Download } from "lucide-react";
import {
  getProfitByCustomer,
  getProfitByDay,
  getProfitByProduct,
  getProfitSummary,
  getSlowMovers,
  getStockValue,
  resolveRange,
  type Range,
  type ReportKey,
} from "@/lib/queries/reports";
import { peso } from "@/lib/format";
import { marginPercent } from "@/lib/profit";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import {
  CustomerProfitTable,
  DayProfitTable,
  ProductProfitTable,
  SlowMoversTable,
  StockValueTable,
} from "@/components/admin/report-sections";
import { fmtDate } from "@/components/admin/order-bits";
import { RangePicker } from "./range-picker";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ from?: string; to?: string; preset?: string }>;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;
  const range = resolveRange(params);

  const [summary, byProduct, byCustomer, byDay, stockValue, slow] = await Promise.all([
    getProfitSummary(range),
    getProfitByProduct(range),
    getProfitByCustomer(range),
    getProfitByDay(range),
    getStockValue(),
    getSlowMovers(range),
  ]);
  const margin = marginPercent(summary.profit, summary.revenue);
  const stockTotal = stockValue.reduce((a, r) => a + r.value, 0);
  const stockQty = stockValue.reduce((a, r) => a + r.qty, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
          <p className="text-sm font-medium text-zinc-500">
            {fmtDate(range.from)} – {fmtDate(range.to)} · profit counts on the delivered date
          </p>
        </div>
        <RangePicker range={range} />
      </div>

      {/* Profit summary */}
      <section className="flex flex-col gap-3">
        <SectionHead title="Profit summary" report="summary" range={range} />
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Tile label="Gross profit" value={peso(summary.profit)} sub={`${margin.toFixed(1)}% margin`} accent />
          <Tile label="Revenue" value={peso(summary.revenue)} sub="delivered + paid" />
          <Tile label="Cost of goods" value={peso(summary.cost)} sub="snapshot at packing" />
          <Tile label="Margin" value={`${margin.toFixed(1)}%`} sub="profit ÷ revenue" />
          <Tile label="Orders" value={summary.orders.toLocaleString("en-PH")} sub="delivered in range" />
          <Tile label="Units" value={summary.units.toLocaleString("en-PH")} sub={summary.orders ? `${Math.round(summary.units / summary.orders)} pcs avg` : "no orders"} />
        </div>
      </section>

      <Card>
        <CardHeader title="Profit by product" action={<ExportLink report="products" range={range} />} />
        <ProductProfitTable rows={byProduct} />
      </Card>

      <Card>
        <CardHeader title="Profit by customer" action={<ExportLink report="customers" range={range} />} />
        <CustomerProfitTable rows={byCustomer} />
      </Card>

      <Card>
        <CardHeader title="Profit by day" action={<ExportLink report="days" range={range} />} />
        <DayProfitTable rows={byDay} />
      </Card>

      <Card>
        <CardHeader
          title={
            <>
              Stock value on hand{" "}
              <span className="ml-2 text-sm font-bold text-zinc-500">
                {peso(stockTotal)} · {stockQty.toLocaleString("en-PH")} pcs
              </span>
            </>
          }
          action={<ExportLink report="stock-value" range={range} />}
        />
        <StockValueTable rows={stockValue} />
      </Card>

      <Card>
        <CardHeader
          title={
            <>
              Slow movers <span className="ml-2 text-sm font-bold text-zinc-500">{slow.length} active products with no sales in range</span>
            </>
          }
          action={<ExportLink report="slow-movers" range={range} />}
        />
        <SlowMoversTable rows={slow} />
      </Card>
    </div>
  );
}

function SectionHead({ title, report, range }: { title: string; report: ReportKey; range: Range }) {
  return (
    <div className="flex items-center justify-between px-1">
      <h2 className="text-[15px] font-extrabold">{title}</h2>
      <ExportLink report={report} range={range} />
    </div>
  );
}

function ExportLink({ report, range }: { report: ReportKey; range: Range }) {
  return (
    <Link
      href={`/api/reports/${report}?from=${range.fromKey}&to=${range.toKey}`}
      prefetch={false}
      className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
    >
      <Download className="size-3.5" />
      Export CSV
    </Link>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl border p-4", accent ? "border-brand-700 bg-brand-700 text-white" : "border-zinc-200 bg-white")}>
      <div className={cn("text-[11px] font-bold uppercase tracking-wider", accent ? "text-brand-100" : "text-zinc-500")}>{label}</div>
      <div className="text-2xl font-extrabold tabular-nums tracking-tight">{value}</div>
      <div className={cn("text-xs font-semibold", accent ? "text-brand-100" : "text-zinc-500")}>{sub}</div>
    </div>
  );
}
