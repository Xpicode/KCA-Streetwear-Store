import Link from "next/link";
import { Plus, PackagePlus } from "lucide-react";
import { getCategories, getProductsWithStats } from "@/lib/queries/products";
import { ProductFilters } from "@/components/admin/product-filters";
import { peso } from "@/lib/format";
import { marginPercent } from "@/lib/profit";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; category?: string }>;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const { q, category } = await searchParams;
  const categoryId = category ? Number(category) : undefined;

  const [rows, cats] = await Promise.all([
    getProductsWithStats({ q, categoryId }),
    getCategories(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Products</h1>
          <p className="text-sm font-medium text-zinc-500">
            {rows.length} products · sold and profit are for the last 30 days
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/stock-in"
            className="flex h-9 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-bold"
          >
            <PackagePlus className="size-4" />
            Stock-in
          </Link>
          <Link
            href="/admin/products/new"
            className="flex h-9 items-center gap-2 rounded-lg bg-brand-700 px-3 text-sm font-bold text-white"
          >
            <Plus className="size-4" />
            Add product
          </Link>
        </div>
      </div>

      <ProductFilters categories={cats} />

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-2.5">Product</th>
              <th className="px-4 py-2.5">Category</th>
              <th className="px-4 py-2.5 text-right">Stock</th>
              <th className="px-4 py-2.5 text-right">Cost</th>
              <th className="px-4 py-2.5 text-right">Price</th>
              <th className="px-4 py-2.5 text-right">Margin</th>
              <th className="px-4 py-2.5 text-right">Sold 30d</th>
              <th className="px-4 py-2.5 text-right">Profit 30d</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 tabular-nums">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                  No products yet. Run <code className="rounded bg-zinc-100 px-1.5 py-0.5">npm run db:seed</code> for
                  sample data, or add your first product.
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const low = p.stock <= p.reorderLevel;
              const margin = marginPercent(p.price - p.cost, p.price);
              const options = [
                p.sizes > 1 ? `${p.sizes} sizes` : null,
                p.colors > 1 ? `${p.colors} colors` : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${p.id}`} className="font-bold hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs font-medium text-zinc-500">
                      {p.sku}
                      {options ? ` · ${options}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-700">{p.category ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2.5 py-0.5 text-xs font-bold",
                        low ? "bg-red-50 text-red-700" : "bg-zinc-100 text-zinc-700"
                      )}
                    >
                      {p.stock} pcs
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700">{p.cost ? peso(p.cost) : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-bold">{peso(p.price)}</div>
                    <div className="text-xs font-medium text-zinc-500">{p.retailPrice != null ? `retail ${peso(p.retailPrice)}` : "no retail"}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-brand-700">
                    {p.cost ? `${Math.round(margin)}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-700">{p.sold}</td>
                  <td className="px-4 py-3 text-right font-extrabold">{peso(p.profit)}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
