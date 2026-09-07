import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getShopper } from "@/lib/shopper";
import { readCart } from "@/lib/cart";
import { getCartLines } from "@/lib/queries/catalog";
import { peso } from "@/lib/format";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const shopper = await getShopper();
  const cart = await readCart();
  const summary = await getCartLines(cart, shopper?.priceGroup ?? "standard");
  // nothing to send, or the cart still has MOQ / stock problems → back to the cart to fix
  if (summary.lines.length === 0 || !summary.ok) redirect("/shop/cart");

  return (
    <div className="flex flex-col gap-5">
      <Link href="/shop/cart" className="inline-flex items-center gap-1 text-sm font-bold text-zinc-500 hover:text-zinc-900">
        <ChevronLeft className="size-4" /> Back to cart
      </Link>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Send order request</h1>
        <p className="text-sm font-medium text-zinc-500">Tell us where to deliver — no account and no payment needed now.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <CheckoutForm shopper={shopper} />

        <aside className="rounded-xl border border-zinc-200 bg-white lg:sticky lg:top-24">
          <div className="border-b border-zinc-100 px-5 py-3">
            <h2 className="text-[15px] font-extrabold">Your request</h2>
            <p className="text-xs font-medium text-zinc-500">
              {summary.lines.length} {summary.lines.length === 1 ? "line" : "lines"} · {summary.units} pcs
            </p>
          </div>
          <ul className="divide-y divide-zinc-100 text-sm">
            {summary.lines.map((l) => (
              <li key={l.variantId} className="flex items-start justify-between gap-3 px-5 py-2.5 tabular-nums">
                <div className="min-w-0">
                  <div className="truncate font-bold">{l.name}</div>
                  <div className="text-xs font-medium text-zinc-500">
                    {l.variant} · {l.qty} × {peso(l.unitPrice)}
                  </div>
                </div>
                <div className="shrink-0 font-extrabold">{peso(l.lineTotal)}</div>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-1.5 border-t border-zinc-200 px-5 py-4 text-sm tabular-nums">
            <div className="flex justify-between font-medium text-zinc-600">
              <dt>Subtotal</dt>
              <dd className="font-bold text-zinc-900">{peso(summary.subtotal)}</dd>
            </div>
            <div className="flex justify-between font-medium text-zinc-600">
              <dt>Delivery fee</dt>
              <dd>Confirmed later</dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-zinc-200 pt-3 text-base font-extrabold">
              <dt>Estimated total</dt>
              <dd>{peso(summary.subtotal)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
