import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getBatchesByIds, getLowStock, getRecentStockIn, getStockInCatalogue, getSuppliers, type LowStockRow } from "@/lib/queries/stock";
import { StockInForm } from "@/components/admin/stock-in-form";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth";

const LOW_STOCK_LIMIT = 25;

export const dynamic = "force-dynamic";

export default async function StockInPage({
  searchParams,
}: {
  searchParams: Promise<{ received?: string; product?: string; variant?: string }>;
}) {
  await requireAdmin();
  const { received, product, variant } = await searchParams;
  const receivedIds = (received ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  const preselect = product && /^\d+$/.test(product) ? Number(product) : undefined;
  const preselectVariant = preselect && variant && /^\d+$/.test(variant) ? Number(variant) : undefined;

  const [suppliers, catalogue, recent, justReceived, low] = await Promise.all([
    getSuppliers(),
    getStockInCatalogue(),
    getRecentStockIn(10),
    getBatchesByIds(receivedIds),
    getLowStock(),
  ]);
  const outCount = low.filter((r) => r.level === "out").length;

  const today = localDate(new Date());

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Stock-in</h1>
          <p className="text-sm font-medium text-zinc-500">
            Record a purchase: supplier, variants, quantity and unit cost. Costs feed the margin on every sale.
          </p>
        </div>
      </div>

      {justReceived.length > 0 && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 className="size-5" />
            <h2 className="text-[15px] font-extrabold">
              Received {justReceived.reduce((a, b) => a + b.qtyReceived, 0)} pcs in {justReceived.length} line{justReceived.length === 1 ? "" : "s"}
              {justReceived[0].supplier ? ` from ${justReceived[0].supplier}` : ""}
            </h2>
          </div>
          <ul className="mt-3 divide-y divide-emerald-200/70 text-sm tabular-nums">
            {justReceived.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2">
                <span>
                  <Link href={`/admin/products/${b.productId}`} className="font-bold hover:underline">
                    {b.productName}
                  </Link>
                  <span className="ml-2 text-zinc-600">
                    {b.sku} · {b.variantLabel}
                  </span>
                </span>
                <span className="font-semibold text-zinc-700">
                  {b.qtyReceived} × {peso(b.unitCost)} = <span className="font-extrabold text-zinc-900">{peso(b.qtyReceived * b.unitCost)}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between text-sm">
            <Link href="/admin/stock-in" className="font-bold text-emerald-800 hover:underline">
              Record another stock-in
            </Link>
            <span className="font-extrabold">Total {peso(justReceived.reduce((a, b) => a + b.qtyReceived * b.unitCost, 0))}</span>
          </div>
        </section>
      )}

      <LowStockCard rows={low} outCount={outCount} />

      {catalogue.length === 0 ? (
        <Card>
          <Empty>
            No active products yet.{" "}
            <Link href="/admin/products/new" className="font-bold text-emerald-700 hover:underline">
              Add a product
            </Link>{" "}
            before recording stock.
          </Empty>
        </Card>
      ) : (
        // keyed on the URL so a Restock click (or a fresh page) always resets the form to the chosen variant
        <div id="stock-in-form" className="scroll-mt-4">
          <StockInForm
            key={`${received ?? "fresh"}-${preselect ?? ""}-${preselectVariant ?? ""}`}
            suppliers={suppliers}
            products={catalogue}
            today={today}
            preselectProductId={preselect}
            preselectVariantId={preselectVariant}
          />
        </div>
      )}

      <Card>
        <CardHeader title="Recent stock-in" action={<span className="text-xs font-semibold text-zinc-500">last 10 batches</span>} />
        {recent.length === 0 ? (
          <Empty>No stock received yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-2.5">Received</th>
                <th className="px-5 py-2.5">Product</th>
                <th className="px-5 py-2.5">Supplier</th>
                <th className="px-5 py-2.5 text-right">Qty</th>
                <th className="px-5 py-2.5 text-right">Left</th>
                <th className="px-5 py-2.5 text-right">Unit cost</th>
                <th className="px-5 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 tabular-nums">
              {recent.map((b) => (
                <tr key={b.id} className="hover:bg-zinc-50">
                  <td className="px-5 py-2.5 whitespace-nowrap">{fmtDate(b.receivedAt)}</td>
                  <td className="px-5 py-2.5">
                    <Link href={`/admin/products/${b.productId}`} className="font-bold hover:underline">
                      {b.productName}
                    </Link>
                    <div className="text-xs font-medium text-zinc-500">
                      {b.sku} · {b.variantLabel}
                    </div>
                  </td>
                  <td className="px-5 py-2.5 text-zinc-700">
                    {b.supplier ?? "—"}
                    {b.reference && <div className="text-xs font-medium text-zinc-500">{b.reference}</div>}
                  </td>
                  <td className="px-5 py-2.5 text-right">{b.qtyReceived}</td>
                  <td className="px-5 py-2.5 text-right font-bold">{b.qtyRemaining}</td>
                  <td className="px-5 py-2.5 text-right">{peso(b.unitCost)}</td>
                  <td className="px-5 py-2.5 text-right font-extrabold">{peso(b.qtyReceived * b.unitCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

/** Variants to restock — red rows have nothing on hand, yellow rows are at/below the product's reorder level. */
function LowStockCard({ rows, outCount }: { rows: LowStockRow[]; outCount: number }) {
  const shown = rows.slice(0, LOW_STOCK_LIMIT);
  const hidden = rows.length - shown.length;
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Low stock
            {rows.length > 0 && (
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-bold tabular-nums text-zinc-700">
                {rows.length}
              </span>
            )}
          </span>
        }
        action={
          <div className="flex items-center gap-4 text-xs font-semibold text-zinc-600">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm border border-red-200 bg-red-100" />
              0 stock{outCount > 0 && <span className="text-red-700">· {outCount}</span>}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm border border-amber-200 bg-amber-100" />
              Low (at or below reorder level)
            </span>
          </div>
        }
      />
      {rows.length === 0 ? (
        <Empty>Every product is above its reorder level. Nothing to restock right now.</Empty>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-2.5">Product</th>
                <th className="px-5 py-2.5">Variant</th>
                <th className="px-5 py-2.5 text-right">On hand</th>
                <th className="px-5 py-2.5 text-right">Product total</th>
                <th className="px-5 py-2.5 text-right">Last cost</th>
                <th className="px-5 py-2.5 text-right">Status</th>
                <th className="w-28 px-5 py-2.5 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white tabular-nums">
              {shown.map((r) => {
                const out = r.level === "out";
                return (
                  <tr key={r.variantId} className={cn(out ? "bg-red-50 hover:bg-red-100/70" : "bg-amber-50 hover:bg-amber-100/70")}>
                    <td className="px-5 py-2.5">
                      <Link href={`/admin/products/${r.productId}`} className="font-bold hover:underline">
                        {r.productName}
                      </Link>
                      <div className="text-xs font-medium text-zinc-500">{r.sku}</div>
                    </td>
                    <td className="px-5 py-2.5 font-semibold text-zinc-700">{r.variantLabel}</td>
                    <td className={cn("px-5 py-2.5 text-right font-extrabold", out ? "text-red-700" : "text-amber-800")}>{r.stock}</td>
                    <td className="px-5 py-2.5 text-right text-zinc-700">
                      {r.productStock} <span className="text-xs font-medium text-zinc-500">/ reorder at {r.reorderLevel}</span>
                    </td>
                    <td className="px-5 py-2.5 text-right text-zinc-700">{r.lastCost == null ? "—" : peso(r.lastCost)}</td>
                    <td className="px-5 py-2.5 text-right">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap",
                          out ? "bg-red-600 text-white" : "bg-amber-200 text-amber-900"
                        )}
                      >
                        {out ? "Out of stock" : "Low stock"}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Link
                        href={`/admin/stock-in?product=${r.productId}&variant=${r.variantId}#stock-in-form`}
                        scroll={true}
                        className="inline-flex h-8 items-center rounded-lg border border-zinc-300 bg-white px-2.5 text-xs font-bold hover:bg-zinc-50"
                      >
                        Restock
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hidden > 0 && (
            <p className="border-t border-zinc-100 px-5 py-3 text-xs font-semibold text-zinc-500">
              Showing the {LOW_STOCK_LIMIT} most urgent · {hidden} more on the{" "}
              <Link href="/admin/products" className="font-bold text-emerald-700 hover:underline">
                Products
              </Link>{" "}
              page.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDate = (d: Date) => d.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric" });
