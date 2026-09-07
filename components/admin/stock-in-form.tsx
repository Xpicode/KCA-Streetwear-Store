"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { stockIn } from "@/actions/stock";
import type { PickerProduct, SupplierOption } from "@/lib/queries/stock";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { peso } from "@/lib/format";

type Line = { key: number; productId: string; variantId: string; qty: string; unitCost: string; costTouched: boolean };

let keySeq = 1;
const newLine = (productId = ""): Line => ({ key: keySeq++, productId, variantId: "", qty: "", unitCost: "", costTouched: false });

export function StockInForm({
  suppliers,
  products,
  today,
  preselectProductId,
  preselectVariantId,
}: {
  suppliers: SupplierOption[];
  products: PickerProduct[];
  /** yyyy-mm-dd in the server's timezone */
  today: string;
  preselectProductId?: number;
  /** with preselectProductId: start on this size/colour (e.g. from a Restock button) */
  preselectVariantId?: number;
}) {
  const [state, action] = useActionState(stockIn, null);
  const [supplierId, setSupplierId] = useState(suppliers[0] ? String(suppliers[0].id) : "new");
  const [lines, setLines] = useState<Line[]>(() => {
    const first = applyProduct(newLine(preselectProductId ? String(preselectProductId) : ""), products);
    if (!preselectVariantId) return [first];
    const v = products.find((x) => x.id === preselectProductId)?.variants.find((x) => x.id === preselectVariantId);
    if (!v) return [first];
    return [{ ...first, variantId: String(v.id), unitCost: v.lastCost != null ? String(v.lastCost) : "" }];
  });

  const byId = useMemo(() => new Map(products.map((p) => [String(p.id), p])), [products]);

  const setLine = (key: number, patch: Partial<Line>) => setLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const onProduct = (key: number, productId: string) =>
    setLines((rows) => rows.map((r) => (r.key === key ? applyProduct({ ...r, productId, variantId: "", costTouched: false }, products) : r)));

  const onVariant = (key: number, variantId: string) =>
    setLines((rows) =>
      rows.map((r) => {
        if (r.key !== key) return r;
        const v = byId.get(r.productId)?.variants.find((x) => String(x.id) === variantId);
        const prefill = !r.costTouched && v?.lastCost != null ? String(v.lastCost) : r.costTouched ? r.unitCost : "";
        return { ...r, variantId, unitCost: prefill };
      })
    );

  const lineTotal = (l: Line) => (Number(l.qty) || 0) * (Number(l.unitCost) || 0);
  const total = lines.reduce((a, l) => a + lineTotal(l), 0);
  const units = lines.reduce((a, l) => a + (Number(l.qty) || 0), 0);

  const linesJson = JSON.stringify(
    lines.filter((l) => l.variantId).map((l) => ({ variantId: Number(l.variantId), qty: l.qty, unitCost: l.unitCost }))
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="lines" value={linesJson} />

      <Card>
        <CardHeader title="Purchase" />
        <CardBody className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_180px] gap-4">
          <Field label="Supplier">
            <div className="flex flex-col gap-2">
              <Select name="supplierId" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value="">No supplier</option>
                <option value="new">+ New supplier…</option>
              </Select>
              {supplierId === "new" && <Input name="supplierName" placeholder="Supplier name" required autoFocus />}
            </div>
          </Field>
          <Field label="Reference / notes" hint="Invoice or DR number, or a short note.">
            <Input name="reference" placeholder="e.g. DR-2041" maxLength={200} />
          </Field>
          <Field label="Received date">
            <Input name="receivedAt" type="date" defaultValue={today} max={today} required />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Lines"
          action={
            <button
              type="button"
              onClick={() => setLines((rows) => [...rows, applyProduct(newLine(rows[rows.length - 1]?.productId ?? ""), products)])}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-bold hover:bg-zinc-50"
            >
              <Plus className="size-4" />
              Add line
            </button>
          }
        />
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-5 py-2.5">Product</th>
              <th className="w-48 px-3 py-2.5">Variant</th>
              <th className="w-24 px-3 py-2.5 text-right">Qty</th>
              <th className="w-32 px-3 py-2.5 text-right">Unit cost (₱)</th>
              <th className="w-28 px-3 py-2.5 text-right">Line total</th>
              <th className="w-14 px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 tabular-nums">
            {lines.map((l) => {
              const product = byId.get(l.productId);
              return (
                <tr key={l.key}>
                  <td className="px-5 py-2">
                    <Select value={l.productId} onChange={(e) => onProduct(l.key, e.target.value)} className="h-9" aria-label="Product">
                      <option value="">Pick a product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} · {p.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={l.variantId}
                      onChange={(e) => onVariant(l.key, e.target.value)}
                      disabled={!product}
                      className="h-9"
                      aria-label="Variant"
                    >
                      <option value="">{product ? "Pick a variant…" : "—"}</option>
                      {product?.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={l.qty}
                      onChange={(e) => setLine(l.key, { qty: e.target.value })}
                      className="h-9 text-right"
                      aria-label="Quantity"
                      placeholder="0"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.unitCost}
                      onChange={(e) => setLine(l.key, { unitCost: e.target.value, costTouched: true })}
                      className="h-9 text-right"
                      aria-label="Unit cost"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-bold">{lineTotal(l) ? peso(lineTotal(l)) : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setLines((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== l.key) : rows))}
                      disabled={lines.length === 1}
                      aria-label="Remove line"
                      className="inline-flex size-9 items-center justify-center rounded-lg text-red-700 hover:bg-red-50 disabled:opacity-30"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50">
              <td colSpan={2} className="px-5 py-3 text-xs font-semibold text-zinc-500">
                Unit cost is prefilled from the last batch for that variant when known.
              </td>
              <td className="px-3 py-3 text-right font-bold">{units || "—"}</td>
              <td className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wider text-zinc-500">Total</td>
              <td className="px-3 py-3 text-right text-base font-extrabold">{total ? peso(total) : "—"}</td>
              <td />
            </tr>
          </tfoot>
        </table></div>
      </Card>

      <FormMessage state={state} />

      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Receiving…">Receive stock</SubmitButton>
        <span className="text-xs font-medium text-zinc-500">Creates one batch per line and updates stock on hand.</span>
      </div>
    </form>
  );
}

/** When a product is chosen, auto-pick its only variant and prefill the last cost. */
function applyProduct(line: Line, products: PickerProduct[]): Line {
  const p = products.find((x) => String(x.id) === line.productId);
  if (!p) return { ...line, variantId: "" };
  if (p.variants.length === 1) {
    const v = p.variants[0];
    return { ...line, variantId: String(v.id), unitCost: line.costTouched ? line.unitCost : v.lastCost != null ? String(v.lastCost) : "" };
  }
  return line;
}
