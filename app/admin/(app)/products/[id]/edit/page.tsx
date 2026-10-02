import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getCategories } from "@/lib/queries/products";
import { getPriceGroups, getProductDetail } from "@/lib/queries/product-detail";
import { ProductForm } from "@/components/admin/product-form";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id)) notFound();

  const [product, categories, priceGroups] = await Promise.all([getProductDetail(id), getCategories(), getPriceGroups()]);
  if (!product) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/admin/products/${id}`} className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-800">
          <ChevronLeft className="size-3.5" />
          {product.name}
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">Edit product</h1>
        <p className="text-sm font-medium text-zinc-500">
          {product.sku} · changes apply to new orders; existing order lines keep their prices.
        </p>
      </div>
      <ProductForm
        mode="edit"
        categories={categories}
        priceGroups={priceGroups}
        initial={{
          id: product.id,
          name: product.name,
          sku: product.sku,
          slug: product.slug,
          categoryId: product.categoryId,
          description: product.description,
          imageUrl: product.imageUrl,
          basePrice: product.basePrice,
          retailPrice: product.retailPrice,
          baseCost: product.baseCost,
          unit: product.unit,
          moq: product.moq,
          reorderLevel: product.reorderLevel,
          isActive: product.isActive,
          showIn: product.showIn,
        }}
        initialVariants={product.variants.map((v) => ({
          id: v.id,
          size: v.size ?? "",
          color: v.color ?? "",
          priceOverride: v.priceOverride == null ? "" : String(v.priceOverride),
          isActive: v.isActive,
          locked: v.locked,
          stockOnHand: v.stockOnHand,
        }))}
        initialTiers={product.tiers.map((t) => ({ minQty: String(t.minQty), price: String(t.price), priceGroup: t.priceGroup ?? "" }))}
      />
    </div>
  );
}
