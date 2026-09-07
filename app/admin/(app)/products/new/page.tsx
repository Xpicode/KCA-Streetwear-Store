import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getCategories } from "@/lib/queries/products";
import { getPriceGroups } from "@/lib/queries/product-detail";
import { ProductForm } from "@/components/admin/product-form";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const [categories, priceGroups] = await Promise.all([getCategories(), getPriceGroups()]);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/admin/products" className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-800">
          <ChevronLeft className="size-3.5" />
          Products
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">Add product</h1>
        <p className="text-sm font-medium text-zinc-500">Details, variants and quantity pricing. Type a starting stock here, or add stock later via Stock-in.</p>
      </div>
      <ProductForm mode="create" categories={categories} priceGroups={priceGroups} />
    </div>
  );
}
