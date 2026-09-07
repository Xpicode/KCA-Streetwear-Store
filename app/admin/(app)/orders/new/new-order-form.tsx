"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createOrder } from "@/actions/orders";
import { unitPriceFor } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import type { FormProduct } from "@/lib/queries/orders";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { pesoExact } from "@/components/admin/order-bits";

type Customer = { id: number; shopName: string; priceGroup: string; status: string };

type Line = {
  key: number;
  productId: number | "";
  variantId: number | "";
  qty: number;
  unitPrice: number;
  priceEdited: boolean;
};

let seq = 1;
const blankLine = (): Line => ({ key: seq++, productId: "", variantId: "", qty: 12, unitPrice: 0, priceEdited: false });

export function NewOrderForm({ customers, products }: { customers: Customer[]; products: FormProduct[] }) {
  const [state, action] = useActionState(createOrder, null);
  const [customerId, setCustomerId] = useState<number | "">(customers[0]?.id ?? "");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [discount, setDiscount] = useState(0);

  const customer = customers.find((c) => c.id === customerId);
  const priceGroup = customer?.priceGroup ?? "standard";
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const priceFor = (productId: number, variantId: number | "", qty: number) => {
    const p = byId.get(productId);
    if (!p) return 0;
    const v = p.variants.find((x) => x.id === variantId);
    return unitPriceFor({ basePrice: p.basePrice, priceOverride: v?.priceOverride, tiers: p.tiers, qty: Math.max(qty, 1), priceGroup });
  };

  const update = (key: number, patch: Partial<Line>) =>
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (!next.priceEdited && next.productId !== "") next.unitPrice = priceFor(next.productId, next.variantId, next.qty);
        return next;
      })
    );

  // when the customer (price group) changes, refresh every untouched price
  const onCustomerChange = (id: number | "") => {
    setCustomerId(id);
    const group = customers.find((c) => c.id === id)?.priceGroup ?? "standard";
    setLines((ls) =>
      ls.map((l) => {
        if (l.priceEdited || l.productId === "") return l;
        const p = byId.get(l.productId);
        if (!p) return l;
        const v = p.variants.find((x) => x.id === l.variantId);
        return {
          ...l,
          unitPrice: unitPriceFor({ basePrice: p.basePrice, priceOverride: v?.priceOverride, tiers: p.tiers, qty: Math.max(l.qty, 1), priceGroup: group }),
        };
      })
    );
  };

  const complete = lines.filter((l) => l.productId !== "" && l.variantId !== "" && l.qty > 0);
  const subtotal = complete.reduce((a, l) => a + l.qty * l.unitPrice, 0);
  const total = Math.max(subtotal - (discount || 0), 0);
  const payload = JSON.stringify(complete.map((l) => ({ variantId: l.variantId, qty: l.qty, unitPrice: l.unitPrice })));

  return (
    <form action={action} className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] items-start gap-4">
      <input type="hidden" name="lines" value={payload} />
      <input type="hidden" name="source" value="manual" />

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Lines" action={<span className="text-xs font-semibold text-zinc-500">Prices follow the customer’s price group; edit any price by hand.</span>} />
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
            <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-2.5 w-[38%]">Product</th>
                <th className="px-3 py-2.5 w-[24%]">Variant</th>
                <th className="px-3 py-2.5 w-[10%]">Qty</th>
                <th className="px-3 py-2.5 w-[14%]">Unit price</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-2 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 tabular-nums">
              {lines.map((l) => {
                const p = l.productId !== "" ? byId.get(l.productId) : undefined;
                const v = p?.variants.find((x) => x.id === l.variantId);
                const short = v && v.available < l.qty;
                const belowMoq = p && l.qty > 0 && l.qty < p.moq;
                return (
                  <tr key={l.key} className="align-top">
                    <td className="px-5 py-2.5">
                      <Select
                        value={l.productId}
                        onChange={(e) => {
                          const id = e.target.value ? Number(e.target.value) : "";
                          const prod = id !== "" ? byId.get(id) : undefined;
                          const onlyVariant = prod && prod.variants.length === 1 ? prod.variants[0].id : "";
                          update(l.key, { productId: id, variantId: onlyVariant, priceEdited: false, qty: prod ? Math.max(l.qty, prod.moq) : l.qty });
                        }}
                        className="h-9"
                      >
                        <option value="">Choose a product…</option>
                        {products.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            {pr.name} · {pr.sku}
                          </option>
                        ))}
                      </Select>
                      {belowMoq && <div className="mt-1 text-[11px] font-semibold text-amber-700">Below MOQ of {p.moq}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Select
                        value={l.variantId}
                        disabled={!p}
                        onChange={(e) => update(l.key, { variantId: e.target.value ? Number(e.target.value) : "", priceEdited: false })}
                        className="h-9"
                      >
                        <option value="">{p ? "Choose…" : "—"}</option>
                        {p?.variants.map((vr) => {
                          const label = [vr.size, vr.color].filter(Boolean).join(" / ") || "Default";
                          return (
                            <option key={vr.id} value={vr.id}>
                              {label} · {vr.available} avail
                            </option>
                          );
                        })}
                      </Select>
                      {short && <div className="mt-1 text-[11px] font-semibold text-red-600">Only {v.available} available</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={l.qty || ""}
                        onChange={(e) => update(l.key, { qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                        className="h-9"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={Number.isFinite(l.unitPrice) ? l.unitPrice : ""}
                        onChange={(e) => update(l.key, { unitPrice: Number(e.target.value) || 0, priceEdited: true })}
                        className={cn("h-9", l.priceEdited && "border-amber-400")}
                      />
                    </td>
                    <td className="px-3 py-2.5 pt-4 text-right font-bold">{pesoExact(l.qty * l.unitPrice || 0)}</td>
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        title="Remove line"
                        disabled={lines.length === 1}
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                        className="flex size-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          <CardBody className="pt-3">
            <button
              type="button"
              onClick={() => setLines((ls) => [...ls, blankLine()])}
              className="flex h-9 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-bold hover:bg-zinc-50"
            >
              <Plus className="size-4" />
              Add line
            </button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Internal note" />
          <CardBody>
            <Textarea name="note" placeholder="Optional — where the order came from (Messenger, walk-in), delivery details, agreed terms." />
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="Customer" />
          <CardBody className="flex flex-col gap-3">
            <Field label="Customer">
              <Select name="customerId" value={customerId} onChange={(e) => onCustomerChange(e.target.value ? Number(e.target.value) : "")} required>
                <option value="">Choose a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shopName}
                    {c.status === "pending" ? " (pending approval)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="text-xs font-semibold text-zinc-500">
              Price group: <span className="capitalize text-zinc-800">{priceGroup}</span> · Source: <span className="text-zinc-800">Manual</span>
            </div>
            <p className="text-xs text-zinc-500">
              Not on the list?{" "}
              <Link href="/admin/customers" className="font-bold text-brand-700">
                Add them under Customers
              </Link>{" "}
              first.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Totals" />
          <CardBody className="flex flex-col gap-3 text-sm tabular-nums">
            <div className="flex items-baseline justify-between">
              <span className="font-medium text-zinc-500">Subtotal</span>
              <span className="font-semibold">{pesoExact(subtotal)}</span>
            </div>
            <Field label="Discount (₱)">
              <Input
                name="discount"
                type="number"
                min={0}
                max={subtotal}
                step="0.01"
                value={discount || ""}
                placeholder="0"
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
              />
            </Field>
            <div className="flex items-baseline justify-between border-t border-zinc-100 pt-3">
              <span className="font-bold">Total</span>
              <span className="text-xl font-extrabold">{pesoExact(total)}</span>
            </div>
            <div className="text-xs font-medium text-zinc-500">
              {complete.reduce((a, l) => a + l.qty, 0)} pcs · {complete.length} {complete.length === 1 ? "line" : "lines"}
            </div>
            <FormMessage state={state} />
            <SubmitButton pendingText="Creating…" disabled={complete.length === 0 || customerId === ""}>
              Create order
            </SubmitButton>
            <p className="text-xs text-zinc-500">The order starts as Pending. Stock is reserved when you confirm it.</p>
          </CardBody>
        </Card>
      </div>
    </form>
  );
}
