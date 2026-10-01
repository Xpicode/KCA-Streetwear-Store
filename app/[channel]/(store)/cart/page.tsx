import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, AlertTriangle, ShoppingBag } from "lucide-react";
import { channelFromSlug } from "@/lib/channel";
import { getShopperPriceGroup } from "@/lib/shopper";
import { readCart } from "@/lib/cart";
import { getCartLines } from "@/lib/queries/catalog";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CartLineRow } from "@/components/shop/cart-line";

export const dynamic = "force-dynamic";

export default async function CartPage({
  params,
  searchParams,
}: {
  params: Promise<{ channel: string }>;
  searchParams: Promise<{ reordered?: string }>;
}) {
  const [{ channel: slug }, { reordered }] = await Promise.all([params, searchParams]);
  const channel = channelFromSlug(slug);
  if (!channel) notFound();
  const { base, key } = channel;
  const priceGroup = await getShopperPriceGroup(key);
  const cart = await readCart(key);
  const summary = await getCartLines(cart, priceGroup, key);
  const { lines, subtotal, units, problems, ok } = summary;

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
          <ShoppingBag className="size-6" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">Your cart is empty</h1>
        <p className="mt-2 text-sm font-medium text-zinc-500">
          {key === "retail"
            ? "Pick anything from the store — buy one piece or more."
            : "Pick a style from the catalog — minimum 12 pcs per style, any mix of sizes and colors."}
        </p>
        <Link href={base} className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-700 px-5 text-sm font-bold text-white">
          {key === "retail" ? "Browse the store" : "Browse the catalog"}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-24 lg:pb-0">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Your cart</h1>
        <p className="text-sm font-medium text-zinc-500">
          {lines.length} {lines.length === 1 ? "line" : "lines"} · {units} pcs{key === "retail" ? "" : " · prices update with quantity"}
        </p>
      </div>

      {reordered && (
        <p className="rounded-lg bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          Your previous order is back in the cart. Adjust quantities, then send it again.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
          {lines.map((l) => (
            <CartLineRow key={l.variantId} channel={key} line={l} />
          ))}
        </ul>

        <aside className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 lg:sticky lg:top-24">
          <h2 className="text-[15px] font-extrabold">Estimated total</h2>
          <dl className="flex flex-col gap-2 text-sm tabular-nums">
            <div className="flex justify-between font-medium text-zinc-600">
              <dt>Subtotal ({units} pcs)</dt>
              <dd className="font-bold text-zinc-900">{peso(subtotal)}</dd>
            </div>
            <div className="flex justify-between font-medium text-zinc-600">
              <dt>Delivery fee</dt>
              <dd>Confirmed later</dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-zinc-200 pt-3 text-base font-extrabold">
              <dt>Estimated</dt>
              <dd>{peso(subtotal)}</dd>
            </div>
          </dl>

          {!ok && (
            <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
              <p className="mb-1 flex items-center gap-1.5 font-bold">
                <AlertTriangle className="size-3.5" /> Fix these before sending
              </p>
              <ul className="list-disc pl-4">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href={`${base}/checkout`}
            aria-disabled={!ok}
            tabIndex={ok ? 0 : -1}
            className={cn(
              "hidden h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-bold text-white lg:flex",
              ok ? "bg-brand-700 hover:bg-brand-800" : "pointer-events-none bg-zinc-300"
            )}
          >
            Send order request <ArrowRight className="size-4" />
          </Link>
          <p className="text-xs font-medium text-zinc-500">
            No payment now. We confirm stock and total first — your order ships once payment is received.
          </p>
          <Link href={base} className="text-center text-sm font-bold text-zinc-600 hover:text-zinc-900">
            Keep browsing
          </Link>
        </aside>
      </div>

      {/* phone: sticky summary + CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="tabular-nums">
            <div className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase">Estimated</div>
            <div className="text-lg font-extrabold leading-tight">{peso(subtotal)}</div>
          </div>
          <Link
            href={`${base}/checkout`}
            aria-disabled={!ok}
            className={cn(
              "flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white",
              ok ? "bg-brand-700" : "pointer-events-none bg-zinc-300"
            )}
          >
            {ok ? "Send order request" : "Fix cart to continue"} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
