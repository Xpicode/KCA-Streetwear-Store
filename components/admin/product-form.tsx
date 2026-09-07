"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";
import { ImageIcon, Lock, Plus, Trash2, Upload, X } from "lucide-react";
import { createProduct, updateProduct } from "@/actions/products";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ProductFormValues = {
  id?: number;
  name: string;
  sku: string;
  slug: string;
  categoryId: number | null;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  baseCost: number;
  unit: string;
  moq: number;
  reorderLevel: number;
  isActive: boolean;
};

export type VariantFormRow = {
  id?: number;
  size: string;
  color: string;
  priceOverride: string;
  /** create mode only: pieces already on the shelf — becomes the first stock-in */
  initialStock?: string;
  isActive: boolean;
  /** has movements / batches / order lines — can be deactivated, not removed */
  locked: boolean;
  stockOnHand?: number;
};

export type TierFormRow = { minQty: string; price: string; priceGroup: string };

type Category = { id: number; name: string };

const UNITS = [
  { value: "pc", label: "Piece (pc)" },
  { value: "dozen", label: "Dozen" },
  { value: "set", label: "Set" },
];

const EMPTY: ProductFormValues = {
  name: "",
  sku: "",
  slug: "",
  categoryId: null,
  description: "",
  imageUrl: "",
  basePrice: 0,
  baseCost: 0,
  unit: "pc",
  moq: 1,
  reorderLevel: 0,
  isActive: true,
};

let keySeq = 1;
const nextKey = () => keySeq++;

const num = (s: string) => {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) ? n : null;
};

/** Live profit + margin readout under the cost / selling price inputs. */
function ProfitPreview({ cost, price }: { cost: string; price: string }) {
  const c = num(cost);
  const s = num(price);
  if (c == null || s == null || s <= 0) {
    return (
      <p className="rounded-lg bg-zinc-50 px-3 py-2.5 text-xs font-semibold text-zinc-500">
        Enter cost and selling price to see the profit per unit.
      </p>
    );
  }
  const profit = s - c;
  const margin = (profit / s) * 100;
  const markup = c > 0 ? (profit / c) * 100 : null;
  const losing = profit < 0;
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2.5",
        losing ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"
      )}
    >
      <div>
        <div className={cn("text-[11px] font-bold uppercase tracking-wider", losing ? "text-red-600" : "text-emerald-700")}>
          {losing ? "Losing per unit" : "Profit per unit"}
        </div>
        <div className={cn("text-lg font-extrabold tabular-nums", losing ? "text-red-700" : "text-emerald-900")}>
          {peso(profit)}
        </div>
      </div>
      <div className={cn("text-right text-xs font-bold tabular-nums", losing ? "text-red-700" : "text-emerald-800")}>
        <div>{margin.toFixed(1)}% margin</div>
        {markup != null && <div className="font-semibold opacity-80">{markup.toFixed(0)}% markup on cost</div>}
      </div>
    </div>
  );
}

/** Small profit cell for the tiers table — profit at that tier's price against the unit cost. */
function TierProfit({ cost, price }: { cost: string; price: string }) {
  const c = num(cost);
  const s = num(price);
  if (c == null || s == null || s <= 0) return <span className="text-xs font-semibold text-zinc-400">—</span>;
  const profit = s - c;
  return (
    <span className={cn("text-xs font-bold tabular-nums", profit < 0 ? "text-red-600" : "text-emerald-700")}>
      {peso(profit)} · {((profit / s) * 100).toFixed(0)}%
    </span>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

export function ProductForm({
  mode,
  categories,
  priceGroups,
  initial,
  initialVariants = [],
  initialTiers = [],
}: {
  mode: "create" | "edit";
  categories: Category[];
  priceGroups: string[];
  initial?: ProductFormValues;
  initialVariants?: VariantFormRow[];
  initialTiers?: TierFormRow[];
}) {
  const [state, action] = useActionState(mode === "create" ? createProduct : updateProduct, null);
  const p = initial ?? EMPTY;

  const [name, setName] = useState(p.name);
  const [slug, setSlug] = useState(p.slug);
  const [categoryId, setCategoryId] = useState(p.categoryId != null ? String(p.categoryId) : "");
  const [price, setPrice] = useState(p.basePrice ? String(p.basePrice) : "");
  const [cost, setCost] = useState(p.baseCost ? String(p.baseCost) : "");

  // photo: an uploaded file wins over the pasted link; preview shows whichever is set
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState(p.imageUrl ?? "");
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const f = e.target.files?.[0];
    if (filePreview) URL.revokeObjectURL(filePreview);
    if (!f) {
      setFilePreview(null);
      setFileName(null);
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setImageError("That photo is over 5 MB. Use a smaller image.");
      e.target.value = "";
      setFilePreview(null);
      setFileName(null);
      return;
    }
    setFilePreview(URL.createObjectURL(f));
    setFileName(f.name);
  };

  const clearImage = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    setFileName(null);
    setImageUrl("");
    setImageError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const preview = filePreview ?? (imageUrl.trim() || null);
  const [variants, setVariants] = useState<(VariantFormRow & { key: number })[]>(() =>
    initialVariants
      // an unused default (blank) variant is represented by "no rows" in the form
      .filter((v) => !(initialVariants.length === 1 && !v.size && !v.color && !v.locked))
      .map((v) => ({ ...v, key: nextKey() }))
  );
  const [tiers, setTiers] = useState<(TierFormRow & { key: number })[]>(() => initialTiers.map((t) => ({ ...t, key: nextKey() })));

  const autoSlug = useMemo(() => slugify(name), [name]);

  const variantsJson = useMemo(
    () =>
      JSON.stringify(
        variants.map((v) => ({
          id: v.id,
          size: v.size.trim(),
          color: v.color.trim(),
          priceOverride: v.priceOverride.trim(),
          initialStock: mode === "create" ? (v.initialStock ?? "").trim() || "0" : undefined,
          isActive: v.isActive,
        }))
      ),
    [variants, mode]
  );
  const tiersJson = useMemo(
    () => JSON.stringify(tiers.map((t) => ({ minQty: t.minQty, price: t.price, priceGroup: t.priceGroup.trim() }))),
    [tiers]
  );

  const setVariant = (key: number, patch: Partial<VariantFormRow>) =>
    setVariants((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setTier = (key: number, patch: Partial<TierFormRow>) =>
    setTiers((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // a hidden default variant keeps its id so it is updated, not recreated
  const defaultVariantId =
    initialVariants.length === 1 && !initialVariants[0].size && !initialVariants[0].color && !initialVariants[0].locked ? initialVariants[0].id : undefined;

  return (
    <form action={action} className="flex flex-col gap-5">
      {mode === "edit" && <input type="hidden" name="id" value={p.id} />}
      <input
        type="hidden"
        name="variants"
        value={variants.length === 0 && defaultVariantId != null ? JSON.stringify([{ id: defaultVariantId, size: "", color: "", priceOverride: "", isActive: true }]) : variantsJson}
      />
      <input type="hidden" name="tiers" value={tiersJson} />

      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <Card>
          <CardHeader title="Details" />
          <CardBody className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4">
              <Field label="Product name">
                <Input name="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="e.g. Plain Cotton Tee" />
              </Field>
              <Field label="SKU">
                <Input name="sku" defaultValue={p.sku} required placeholder="TEE-001" className="uppercase" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Slug" hint={slug ? undefined : autoSlug ? `Blank — will use “${autoSlug}”` : "Used in the storefront URL"}>
                <Input name="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={autoSlug || "auto from name"} />
              </Field>
              <Field label="Category">
                <div className="flex flex-col gap-2">
                  <Select name="categoryId" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    <option value="">No category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="new">+ Add new category…</option>
                  </Select>
                  {categoryId === "new" && (
                    <Input name="newCategory" required minLength={2} placeholder="New category name, e.g. Hoodies" autoFocus />
                  )}
                </div>
              </Field>
            </div>
            <Field label="Description" hint="Shown to buyers on the storefront.">
              <Textarea name="description" defaultValue={p.description ?? ""} placeholder="Fabric, fit, packing (e.g. 12 pcs per pack)…" />
            </Field>
            <Field label="Product photo" hint="JPG, PNG, WebP or GIF, up to 5 MB. Shown to buyers on the storefront.">
              <div className="flex items-start gap-4">
                <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="Product photo preview" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-zinc-300">
                      <ImageIcon className="size-8" />
                    </div>
                  )}
                  {preview && (
                    <button
                      type="button"
                      onClick={clearImage}
                      title="Remove photo"
                      className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-white/90 text-zinc-600 shadow hover:text-red-600"
                    >
                      <X className="size-3.5" />
                      <span className="sr-only">Remove photo</span>
                    </button>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <input ref={fileRef} type="file" name="imageFile" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onPickFile} className="sr-only" id="product-photo" />
                  <label
                    htmlFor="product-photo"
                    className="inline-flex h-9 w-fit cursor-pointer items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-bold hover:bg-zinc-50"
                  >
                    <Upload className="size-4" />
                    {fileName ? "Change photo" : "Upload photo"}
                  </label>
                  {fileName && <p className="truncate text-xs font-semibold text-zinc-600">{fileName}</p>}
                  <Input
                    name="imageUrl"
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="…or paste an image link (https://…)"
                    className="h-9"
                  />
                  {imageError && <p className="text-xs font-semibold text-red-600">{imageError}</p>}
                </div>
              </div>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Pricing & stock" />
          <CardBody className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Cost per unit (₱)" hint="What you pay your supplier.">
                <Input name="baseCost" type="number" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Selling price (₱)" hint="Per unit, before quantity tiers.">
                <Input name="basePrice" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="0.00" />
              </Field>
            </div>
            <ProfitPreview cost={cost} price={price} />
            <Field label="Unit">
              <Select name="unit" defaultValue={p.unit}>
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="MOQ" hint="Minimum order qty">
                <Input name="moq" type="number" min="1" step="1" defaultValue={p.moq} required />
              </Field>
              <Field label="Reorder level" hint="Flag as low stock at">
                <Input name="reorderLevel" type="number" min="0" step="1" defaultValue={p.reorderLevel} required />
              </Field>
            </div>
            {mode === "create" && variants.length === 0 && (
              <Field label="Starting stock" hint="Pieces already on the shelf — saved as your first stock-in at the unit cost above.">
                <Input name="initialStock" type="number" min="0" step="1" defaultValue={0} />
              </Field>
            )}
            <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2">
              <input type="checkbox" name="isActive" defaultChecked={p.isActive} className="size-4 accent-emerald-700" />
              <span className="text-sm font-bold">Active</span>
              <span className="text-xs text-zinc-500">Inactive products are hidden from the storefront and stock-in.</span>
            </label>
          </CardBody>
        </Card>
      </div>

      {/* Variants */}
      <Card>
        <CardHeader
          title="Variants"
          action={
            <button
              type="button"
              onClick={() => setVariants((rows) => [...rows, { key: nextKey(), size: "", color: "", priceOverride: "", initialStock: "", isActive: true, locked: false }])}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-bold hover:bg-zinc-50"
            >
              <Plus className="size-4" />
              Add variant
            </button>
          }
        />
        <CardBody className="flex flex-col gap-3">
          {variants.length === 0 ? (
            <p className="rounded-lg bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
              No sizes or colors — this product will have one default variant.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
                <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">Size</th>
                    <th className="px-3 py-2">Color</th>
                    <th className="px-3 py-2">Price override (₱)</th>
                    {mode === "create" && <th className="px-3 py-2">Starting stock</th>}
                    <th className="px-3 py-2">Active</th>
                    <th className="w-24 px-3 py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {variants.map((v) => (
                    <tr key={v.key} className={cn(!v.isActive && "bg-zinc-50 text-zinc-500")}>
                      <td className="px-3 py-2">
                        <Input value={v.size} onChange={(e) => setVariant(v.key, { size: e.target.value })} placeholder="e.g. M" className="h-9" />
                      </td>
                      <td className="px-3 py-2">
                        <Input value={v.color} onChange={(e) => setVariant(v.key, { color: e.target.value })} placeholder="e.g. Black" className="h-9" />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={v.priceOverride}
                          onChange={(e) => setVariant(v.key, { priceOverride: e.target.value })}
                          placeholder="base price"
                          className="h-9"
                        />
                      </td>
                      {mode === "create" && (
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={v.initialStock ?? ""}
                            onChange={(e) => setVariant(v.key, { initialStock: e.target.value })}
                            placeholder="0"
                            className="h-9 w-24"
                          />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <label className="flex h-9 cursor-pointer items-center gap-2">
                          <input type="checkbox" checked={v.isActive} onChange={(e) => setVariant(v.key, { isActive: e.target.checked })} className="size-4 accent-emerald-700" />
                          <span className="text-xs font-semibold">{v.isActive ? "Active" : "Inactive"}</span>
                        </label>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {v.locked ? (
                          <span
                            className="inline-flex h-9 items-center gap-1 text-xs font-semibold text-zinc-500"
                            title="Has stock history — deactivate instead of removing"
                          >
                            <Lock className="size-3.5" />
                            {v.stockOnHand ?? 0} on hand
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setVariants((rows) => rows.filter((r) => r.key !== v.key))}
                            className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="size-3.5" />
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
          <p className="text-xs text-zinc-500">
            Each size + color pair must be unique. Variants with stock history can be deactivated but not removed.
          </p>
        </CardBody>
      </Card>

      {/* Price tiers */}
      <Card>
        <CardHeader
          title="Price tiers"
          action={
            <button
              type="button"
              onClick={() => setTiers((rows) => [...rows, { key: nextKey(), minQty: "", price: "", priceGroup: "" }])}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-bold hover:bg-zinc-50"
            >
              <Plus className="size-4" />
              Add tier
            </button>
          }
        />
        <CardBody className="flex flex-col gap-3">
          {tiers.length === 0 ? (
            <p className="rounded-lg bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
              No quantity discounts — every order uses the base price.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200">
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
                <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">From qty</th>
                    <th className="px-3 py-2">Price per unit (₱)</th>
                    <th className="px-3 py-2">Profit</th>
                    <th className="px-3 py-2">Price group</th>
                    <th className="w-24 px-3 py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {tiers.map((t) => (
                    <tr key={t.key}>
                      <td className="px-3 py-2">
                        <Input type="number" min="1" step="1" value={t.minQty} onChange={(e) => setTier(t.key, { minQty: e.target.value })} placeholder="12" className="h-9" required />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" min="0" step="0.01" value={t.price} onChange={(e) => setTier(t.key, { price: e.target.value })} placeholder="0.00" className="h-9" required />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <TierProfit cost={cost} price={t.price} />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={t.priceGroup}
                          onChange={(e) => setTier(t.key, { priceGroup: e.target.value })}
                          placeholder="Everyone"
                          list="price-groups"
                          className="h-9"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setTiers((rows) => rows.filter((r) => r.key !== t.key))}
                          className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="size-3.5" />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
          <datalist id="price-groups">
            {priceGroups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <p className="text-xs text-zinc-500">
            The highest “from qty” at or below the ordered quantity wins. Leave price group blank to apply to every customer.
          </p>
        </CardBody>
      </Card>

      <FormMessage state={state} />

      <div className="flex items-center gap-2">
        <SubmitButton pendingText={mode === "create" ? "Creating…" : "Saving…"}>{mode === "create" ? "Create product" : "Save changes"}</SubmitButton>
        <Link
          href={mode === "edit" && p.id ? `/admin/products/${p.id}` : "/admin/products"}
          className="inline-flex h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-bold hover:bg-zinc-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
