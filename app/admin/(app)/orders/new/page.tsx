import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCustomersForSelect, getProductsForOrderForm } from "@/lib/queries/orders";
import { NewOrderForm } from "./new-order-form";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  await requireAdmin();
  const [customers, products] = await Promise.all([getCustomersForSelect(), getProductsForOrderForm()]);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href="/admin/orders" className="mb-1 flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-800">
          <ArrowLeft className="size-3.5" />
          All orders
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">New order</h1>
        <p className="text-sm font-medium text-zinc-500">For walk-in, Messenger or phone orders you enter by hand.</p>
      </div>
      <NewOrderForm customers={customers} products={products} />
    </div>
  );
}
