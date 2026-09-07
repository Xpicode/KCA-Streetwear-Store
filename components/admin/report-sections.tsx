"use client";

import { peso } from "@/lib/format";
import { marginPercent } from "@/lib/profit";
import type { CustomerProfitRow, DayProfitRow, ProductProfitRow, SlowMoverRow, StockValueRow } from "@/lib/queries/reports";
import { ReportTable, type Column } from "./report-table";
import { fmtDate } from "./order-bits";

const pct = (profit: number, revenue: number) => `${marginPercent(profit, revenue).toFixed(1)}%`;
const num = (n: number) => n.toLocaleString("en-PH");

function Totals({ cells }: { cells: React.ReactNode[] }) {
  return (
    <tr>
      {cells.map((c, i) => (
        <td key={i} className={i === 0 ? "px-5 py-2.5" : "px-4 py-2.5 text-right last:pr-5"}>
          {c}
        </td>
      ))}
    </tr>
  );
}

export function ProductProfitTable({ rows }: { rows: ProductProfitRow[] }) {
  const columns: Column<ProductProfitRow>[] = [
    { key: "name", label: "Product", href: (r) => `/admin/products/${r.id}`, render: (r) => r.name },
    { key: "sku", label: "SKU", render: (r) => <span className="text-zinc-500">{r.sku}</span> },
    { key: "units", label: "Units", align: "right", render: (r) => num(r.units) },
    { key: "revenue", label: "Revenue", align: "right", render: (r) => peso(r.revenue) },
    { key: "cost", label: "Cost", align: "right", render: (r) => <span className="text-zinc-600">{peso(r.cost)}</span> },
    { key: "profit", label: "Profit", align: "right", strong: true, render: (r) => <span className="text-brand-700">{peso(r.profit)}</span> },
    { id: "margin", key: "profit", label: "Margin", align: "right", sortValue: (r) => marginPercent(r.profit, r.revenue), render: (r) => pct(r.profit, r.revenue) },
  ];
  const t = sum(rows);
  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      defaultSort="profit"
      empty="No products delivered in this range."
      footer={<Totals cells={["Total", "", num(t.units), peso(t.revenue), peso(t.cost), peso(t.profit), pct(t.profit, t.revenue)]} />}
    />
  );
}

export function CustomerProfitTable({ rows }: { rows: CustomerProfitRow[] }) {
  const columns: Column<CustomerProfitRow>[] = [
    { key: "shopName", label: "Customer", href: (r) => `/admin/customers/${r.id}`, render: (r) => r.shopName },
    { key: "orders", label: "Orders", align: "right", render: (r) => num(r.orders) },
    { key: "units", label: "Units", align: "right", render: (r) => num(r.units) },
    { key: "revenue", label: "Revenue", align: "right", render: (r) => peso(r.revenue) },
    { key: "cost", label: "Cost", align: "right", render: (r) => <span className="text-zinc-600">{peso(r.cost)}</span> },
    { key: "profit", label: "Profit", align: "right", strong: true, render: (r) => <span className="text-brand-700">{peso(r.profit)}</span> },
    { id: "margin", key: "profit", label: "Margin", align: "right", sortValue: (r) => marginPercent(r.profit, r.revenue), render: (r) => pct(r.profit, r.revenue) },
  ];
  const t = sum(rows);
  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      defaultSort="profit"
      empty="No customers took delivery in this range."
      footer={<Totals cells={["Total", num(t.orders), num(t.units), peso(t.revenue), peso(t.cost), peso(t.profit), pct(t.profit, t.revenue)]} />}
    />
  );
}

export function DayProfitTable({ rows }: { rows: DayProfitRow[] }) {
  const columns: Column<DayProfitRow>[] = [
    { key: "day", label: "Day", render: (r) => <span className="whitespace-nowrap font-semibold">{fmtDate(r.day + "T12:00:00")}</span> },
    { key: "orders", label: "Orders", align: "right", render: (r) => num(r.orders) },
    { key: "units", label: "Units", align: "right", render: (r) => num(r.units) },
    { key: "revenue", label: "Revenue", align: "right", render: (r) => peso(r.revenue) },
    { key: "cost", label: "Cost", align: "right", render: (r) => <span className="text-zinc-600">{peso(r.cost)}</span> },
    { key: "profit", label: "Profit", align: "right", strong: true, render: (r) => <span className="text-brand-700">{peso(r.profit)}</span> },
    { id: "margin", key: "profit", label: "Margin", align: "right", sortValue: (r) => marginPercent(r.profit, r.revenue), render: (r) => pct(r.profit, r.revenue) },
  ];
  const t = sum(rows);
  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.day}
      defaultSort="day"
      defaultDir="asc"
      empty="No deliveries in this range."
      footer={<Totals cells={["Total", num(t.orders), num(t.units), peso(t.revenue), peso(t.cost), peso(t.profit), pct(t.profit, t.revenue)]} />}
    />
  );
}

export function StockValueTable({ rows }: { rows: StockValueRow[] }) {
  const columns: Column<StockValueRow>[] = [
    { key: "name", label: "Product", href: (r) => `/admin/products/${r.id}`, render: (r) => r.name },
    { key: "sku", label: "SKU", render: (r) => <span className="text-zinc-500">{r.sku}</span> },
    { key: "qty", label: "Qty on hand", align: "right", render: (r) => num(r.qty) },
    { key: "avgCost", label: "Avg cost", align: "right", render: (r) => <span className="text-zinc-600">{r.qty ? peso(r.avgCost) : "—"}</span> },
    { key: "value", label: "Stock value", align: "right", strong: true, render: (r) => peso(r.value) },
  ];
  const qty = rows.reduce((a, r) => a + r.qty, 0);
  const value = rows.reduce((a, r) => a + r.value, 0);
  return (
    <ReportTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.id}
      defaultSort="value"
      empty="No stock batches yet."
      footer={<Totals cells={["Total", "", num(qty), "", peso(value)]} />}
    />
  );
}

export function SlowMoversTable({ rows }: { rows: SlowMoverRow[] }) {
  const columns: Column<SlowMoverRow>[] = [
    { key: "name", label: "Product", href: (r) => `/admin/products/${r.id}`, render: (r) => r.name },
    { key: "sku", label: "SKU", render: (r) => <span className="text-zinc-500">{r.sku}</span> },
    { key: "stock", label: "Stock on hand", align: "right", strong: true, render: (r) => num(r.stock) },
    {
      key: "lastSoldAt",
      label: "Last delivered",
      align: "right",
      sortValue: (r) => (r.lastSoldAt ? new Date(r.lastSoldAt).getTime() : 0),
      render: (r) => <span className="text-zinc-600">{r.lastSoldAt ? fmtDate(r.lastSoldAt) : "never"}</span>,
    },
  ];
  return <ReportTable rows={rows} columns={columns} rowKey={(r) => r.id} defaultSort="stock" empty="Every active product sold at least once in this range." />;
}

// ---- helpers ------------------------------------------------------------------

type Sum = { units: number; revenue: number; cost: number; profit: number; orders: number };

function sum(rows: { units: number; revenue: number; cost: number; profit: number; orders?: number }[]): Sum {
  return rows.reduce<Sum>(
    (a, r) => ({ units: a.units + r.units, revenue: a.revenue + r.revenue, cost: a.cost + r.cost, profit: a.profit + r.profit, orders: a.orders + (r.orders ?? 0) }),
    { units: 0, revenue: 0, cost: 0, profit: 0, orders: 0 }
  );
}
