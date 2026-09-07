import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { marginPercent } from "@/lib/profit";
import {
  REPORT_KEYS,
  getProfitByCustomer,
  getProfitByDay,
  getProfitByProduct,
  getProfitSummary,
  getSlowMovers,
  getStockValue,
  resolveRange,
  type ReportKey,
} from "@/lib/queries/reports";

export const dynamic = "force-dynamic";

type Cell = string | number | null | undefined;

function csv(rows: Cell[][]) {
  const esc = (c: Cell) => {
    if (c == null) return "";
    const s = typeof c === "number" ? String(Math.round(c * 100) / 100) : String(c);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}

const pct = (profit: number, revenue: number) => Math.round(marginPercent(profit, revenue) * 10) / 10;
const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** GET /api/reports/<report>?from=YYYY-MM-DD&to=YYYY-MM-DD → text/csv attachment. Admin session required. */
export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  await requireAdmin();
  const { report } = await params;
  if (!(REPORT_KEYS as string[]).includes(report)) {
    return NextResponse.json({ error: `Unknown report. Use one of: ${REPORT_KEYS.join(", ")}` }, { status: 404 });
  }
  const url = new URL(request.url);
  const range = resolveRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    preset: url.searchParams.get("preset") ?? undefined,
  });

  let rows: Cell[][];
  switch (report as ReportKey) {
    case "summary": {
      const s = await getProfitSummary(range);
      rows = [
        ["from", "to", "revenue", "cost", "profit", "margin_pct", "orders", "units"],
        [range.fromKey, range.toKey, s.revenue, s.cost, s.profit, pct(s.profit, s.revenue), s.orders, s.units],
      ];
      break;
    }
    case "products": {
      const r = await getProfitByProduct(range);
      rows = [
        ["product", "sku", "units", "revenue", "cost", "profit", "margin_pct"],
        ...r.map((x) => [x.name, x.sku, x.units, x.revenue, x.cost, x.profit, pct(x.profit, x.revenue)]),
      ];
      break;
    }
    case "customers": {
      const r = await getProfitByCustomer(range);
      rows = [
        ["customer", "orders", "units", "revenue", "cost", "profit", "margin_pct"],
        ...r.map((x) => [x.shopName, x.orders, x.units, x.revenue, x.cost, x.profit, pct(x.profit, x.revenue)]),
      ];
      break;
    }
    case "days": {
      const r = await getProfitByDay(range);
      rows = [
        ["day", "orders", "units", "revenue", "cost", "profit", "margin_pct"],
        ...r.map((x) => [x.day, x.orders, x.units, x.revenue, x.cost, x.profit, pct(x.profit, x.revenue)]),
      ];
      break;
    }
    case "stock-value": {
      const r = await getStockValue();
      rows = [["product", "sku", "qty_on_hand", "avg_unit_cost", "stock_value"], ...r.map((x) => [x.name, x.sku, x.qty, x.avgCost, x.value])];
      break;
    }
    case "slow-movers": {
      const r = await getSlowMovers(range);
      rows = [["product", "sku", "stock_on_hand", "last_delivered"], ...r.map((x) => [x.name, x.sku, x.stock, dateOnly(x.lastSoldAt)])];
      break;
    }
    default:
      return NextResponse.json({ error: `Unknown report. Use one of: ${REPORT_KEYS.join(", ")}` }, { status: 404 });
  }

  const filename = `${report}-${range.fromKey}-to-${range.toKey}.csv`;
  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
