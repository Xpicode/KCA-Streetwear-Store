import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, AlertTriangle, ArrowUpRight } from "lucide-react";
import { channelFromSlug } from "@/lib/channel";
import { getShopperPriceGroup } from "@/lib/shopper";
import { readCart } from "@/lib/cart";
import { getCartLines } from "@/lib/queries/catalog";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CartLineRow } from "@/components/shop/cart-line";

export const dynamic = "force-dynamic";

const label = "font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500";
const navLink = "text-xs font-bold uppercase tracking-[0.15em]";

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
  const retail = key === "retail";
  const priceGroup = await getShopperPriceGroup(key);
  const cart = await readCart(key);
  const summary = await getCartLines(cart, priceGroup, key);
  const { lines, subtotal, units, problems, ok } = summary;

  if (lines.length === 0) {
    return (
      <div className="py-20 text-center">
        <div className={`rise ${label}`}>Cart · empty</div>
        <h1 className="rise mt-4 font-display text-6xl uppercase leading-none [--i:1] sm:text-8xl">Nothing in here yet.</h1>
        <p className="rise mx-auto mt-6 max-w-md text-base font-medium text-zinc-600 [--i:2]">
          {retail
            ? "Pick anything from the store. Buy one piece or more."
            : "Pick a style from the catalog. Minimum 12 pcs per style, any mix of sizes and colors."}
        </p>
        <Link href={base} className={`rise mt-8 inline-flex h-12 items-center gap-2 bg-zinc-950 px-6 text-white hover:bg-zinc-800 [--i:3] ${navLink}`}>
          {retail ? "Browse the store" : "Browse the catalog"} <ArrowUpRight className="size-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-28 lg:pb-0">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-950 pb-6">
        <div>
          <div className={`rise ${label}`}>
            Cart · {lines.length} {lines.length === 1 ? "line" : "lines"} · {units} pcs
            {retail ? "" : " · prices update with quantity"}
          </div>
          <h1 className="rise mt-3 font-display text-6xl uppercase leading-none [--i:1] sm:text-8xl">Your cart</h1>
        </div>
        <Link href={base} className={`rise flex items-center gap-1 underline-offset-4 hover:underline [--i:2] ${navLink}`}>
          Keep browsing <ArrowUpRight className="size-4" />
        </Link>
      </div>

      {reordered && (
        <p className="border border-zinc-950 bg-zinc-100 px-4 py-3 text-sm font-semibold">
          Your previous order is back in the cart. Adjust quantities, then send it again.
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <ul className="divide-y divide-zinc-200 border border-zinc-950">
          {lines.map((l) => (
            <CartLineRow key={l.variantId} channel={key} line={l} />
          ))}
        </ul>

        <aside className="flex flex-col gap-5 border border-zinc-950 p-6 lg:sticky lg:top-24">
          <div className={label}>Estimated total</div>
          <dl className="flex flex-col gap-3 font-mono text-sm tabular-nums">
            <div className="flex justify-between text-zinc-600">
              <dt>Subtotal · {units} pcs</dt>
              <dd className="text-zinc-950">{peso(subtotal)}</dd>
            </div>
            <div className="flex justify-between text-zinc-600">
              <dt>Delivery fee</dt>
              <dd>confirmed later</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-zinc-950 pt-4">
              <dt className="font-bold uppercase tracking-[0.15em] text-zinc-950">Estimated</dt>
              <dd className="font-display text-4xl leading-none text-zinc-950">{peso(subtotal)}</dd>
            </div>
          </dl>

          {!ok && (
            <div className="border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
              <p className="mb-1 flex items-center gap-1.5 font-bold uppercase tracking-[0.1em]">
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
            className={cn("hidden h-12 items-center justify-center gap-2 text-white lg:flex", navLink, ok ? "bg-zinc-950 hover:bg-zinc-800" : "pointer-events-none bg-zinc-300")}
          >
            Send order request <ArrowRight className="size-4" />
          </Link>
          <p className="text-xs font-medium text-zinc-500">
            No payment now. We confirm stock and total first. Your order ships once payment is received.
          </p>
          <p className={label}>GCash · Maya · Bank transfer</p>
        </aside>
      </div>

      {/* phone: sticky total + CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-950 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="flex items-center gap-4">
          <div className="tabular-nums">
            <div className={label}>Estimated</div>
            <div className="font-display text-2xl leading-none">{peso(subtotal)}</div>
          </div>
          <Link
            href={`${base}/checkout`}
            aria-disabled={!ok}
            className={cn("flex h-12 flex-1 items-center justify-center gap-2 text-white", navLink, ok ? "bg-zinc-950" : "pointer-events-none bg-zinc-300")}
          >
            {ok ? "Send order request" : "Fix cart to continue"} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
