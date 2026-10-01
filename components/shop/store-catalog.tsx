/* eslint-disable @next/next/no-img-element -- banner and placeholder art are local files; photos are plain uploads */
import Link from "next/link";
import { ArrowUpRight, Search, X } from "lucide-react";
import type { CatalogProduct } from "@/lib/queries/catalog";
import { peso } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RevealOnScroll } from "@/components/landing/reveal";
import { artFor } from "@/components/landing/site";
import { CHANNELS, type Channel } from "@/lib/channel";
import { bestTier } from "./tiers";

type Cat = { slug: string; name: string };
const label = "font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500";

/** Catalog for /shop and /retail: photo banner, bold category tabs and a tile grid that links to the product page. */
export function StoreCatalog({ channel, products, categories, active, q }: { channel: Channel; products: CatalogProduct[]; categories: Cat[]; active?: string; q?: string }) {
  const { base } = CHANNELS[channel];
  const retail = channel === "retail";
  const moq = products[0]?.moq ?? 12;
  const current = categories.find((c) => c.slug === active);
  const href = (slug?: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (slug) sp.set("category", slug);
    const s = sp.toString();
    return s ? `${base}?${s}` : base;
  };
  const tab = (isActive: boolean) =>
    cn(
      "flex h-10 shrink-0 items-center border px-4 text-xs font-bold uppercase tracking-[0.15em] whitespace-nowrap transition-colors",
      isActive ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 text-zinc-700 hover:border-zinc-950 hover:text-zinc-950"
    );

  return (
    <div className="-mx-6 -mt-8 flex flex-col pb-20 md:pb-0">
      <RevealOnScroll />

      {/* banner */}
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        <img src="/landing/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-right" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/40 to-zinc-950/10" />
        <div className="relative flex min-h-72 flex-col justify-end gap-3 px-6 pt-24 pb-8 sm:min-h-96 sm:pb-10">
          <div className="rise font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-300">
            {retail ? "Retail · single pieces · same stock as the shops" : `Wholesale · min ${moq} pcs per style · mix sizes and colors`}
          </div>
          <h1 className="rise font-display text-6xl uppercase leading-[0.9] tracking-tight [--i:1] sm:text-8xl">{current ? current.name : retail ? "Shop the drop" : "Stock up"}</h1>
          <p className="rise max-w-md text-sm font-medium text-zinc-200 [--i:2] sm:text-base">
            {retail
              ? "Pick a size and color, order in a minute, pay by GCash, Maya or bank transfer once we confirm."
              : "Tier prices drop as you add more of a style. Send the request, we confirm the total, you pay by GCash, Maya or bank transfer."}
          </p>
        </div>
      </section>

      {/* search (phones) + category tabs */}
      <div className="sticky top-16 z-20 border-b border-zinc-950 bg-white">
        <form action={base} className="flex h-11 items-center gap-2 border-b border-zinc-200 px-6 md:hidden">
          {active && <input type="hidden" name="category" value={active} />}
          <Search className="size-4 text-zinc-500" />
          <input name="q" defaultValue={q} placeholder="Search tees, caps, bags…" className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-zinc-400" />
        </form>
        <div className="flex items-center gap-2 overflow-x-auto px-6 py-3 [scrollbar-width:none]">
          <Link href={href()} className={tab(!active)}>
            All
          </Link>
          {categories.map((c) => (
            <Link key={c.slug} href={href(c.slug)} className={tab(active === c.slug)}>
              {c.name}
            </Link>
          ))}
          {q && (
            <Link href={href(active)} className="flex h-10 shrink-0 items-center gap-1.5 border border-zinc-950 bg-zinc-100 px-3 text-xs font-bold uppercase tracking-[0.15em]">
              “{q}” <X className="size-3.5" />
            </Link>
          )}
          <span className={`ml-auto hidden shrink-0 pl-4 sm:inline ${label}`}>
            {products.length} {products.length === 1 ? "style" : "styles"}
          </span>
        </div>
      </div>

      {/* grid */}
      {products.length === 0 ? (
        <div className="px-6 py-24 text-center">
          <p className="font-display text-4xl uppercase">Nothing here yet.</p>
          <p className="mt-2 text-sm font-medium text-zinc-500">Try another word, or clear the filters to see everything.</p>
          <Link href={base} className="mt-6 inline-flex h-11 items-center gap-2 bg-zinc-950 px-5 text-xs font-bold uppercase tracking-[0.15em] text-white">
            See everything <ArrowUpRight className="size-4" />
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-10 px-6 py-8 md:grid-cols-3 xl:grid-cols-4">
          {products.map((p, i) => {
            const out = p.available <= 0;
            const low = !out && p.available <= (retail ? 3 : p.moq * 2);
            const tier = retail ? null : bestTier(p.basePrice, p.tiers);
            return (
              <li key={p.id} className="reveal" style={{ "--i": i % 4 } as React.CSSProperties}>
                <Link href={`${base}/product/${p.slug}`} className="group block">
                  <div className="relative aspect-[3/4] overflow-hidden bg-zinc-100">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <img src={artFor(p.categorySlug)} alt="" className="size-2/5 opacity-60 grayscale transition duration-500 group-hover:scale-110" />
                      </div>
                    )}
                    {out ? (
                      <span className="absolute top-3 left-3 bg-zinc-950 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white">Sold out</span>
                    ) : low ? (
                      <span className="absolute top-3 left-3 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-950">{retail ? `Only ${p.available} left` : `Low · ${p.available} pcs`}</span>
                    ) : null}
                    <span className="absolute right-3 bottom-3 flex size-9 items-center justify-center bg-white text-zinc-950 opacity-0 transition group-hover:opacity-100">
                      <ArrowUpRight className="size-4" />
                    </span>
                  </div>
                  <div className={`mt-3 ${label}`}>{p.category ?? "Style"}</div>
                  <div className="mt-1 line-clamp-2 font-bold uppercase leading-tight group-hover:underline underline-offset-4">{p.name}</div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-display text-xl leading-none">
                      {peso(p.basePrice)} <span className={label}>per {p.unit}</span>
                    </span>
                    {!retail && tier && (
                      <span className="bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-700">
                        {peso(tier.price)} at {tier.minQty}+
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* how to order */}
      <section className="border-t border-zinc-950 px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className={label}>How to order</div>
            <h2 className="mt-2 font-display text-4xl uppercase leading-none sm:text-5xl">No account. No payment up front.</h2>
          </div>
          <Link href="/how-to-order" className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.15em] underline-offset-4 hover:underline">
            Full details <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <ol className="mt-8 grid gap-px border border-zinc-950 bg-zinc-950 md:grid-cols-4">
          {(retail
            ? [
                ["Pick", "Open a product, choose the size and color, set how many. Stock shown is live."],
                ["Send", "Checkout asks for your name, mobile number and address. That is all."],
                ["Confirm", "We message you the final total with delivery. Nothing is charged yet."],
                ["Pay & ship", "Pay by GCash, Maya or bank transfer and send the reference. It ships the same day."],
              ]
            : [
                ["Build", `At least ${moq} pcs per style, sizes and colors mixed. The tier price applies on its own.`],
                ["Send", "Checkout asks for your shop name, contact person, mobile number and address."],
                ["Confirm", "We check stock and message you the final total with delivery. Nothing is charged yet."],
                ["Pay & ship", "Pay by GCash, Maya or bank transfer and send the reference. It ships the same day."],
              ]
          ).map(([title, text], i) => (
            <li key={title} className="reveal flex flex-col gap-3 bg-white p-6" style={{ "--i": i } as React.CSSProperties}>
              <span className="font-display text-4xl leading-none text-zinc-300">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-bold uppercase leading-tight">{title}</h3>
              <p className="text-sm font-medium text-zinc-600">{text}</p>
            </li>
          ))}
        </ol>
        <p className={`mt-4 ${label}`}>Payment: GCash · Maya · Bank transfer · Pickup in Cavite by arrangement</p>
      </section>

      {/* pricing */}
      <section className="border-t border-zinc-950 px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className={label}>Pricing</div>
            <h2 className="mt-2 font-display text-4xl uppercase leading-none sm:text-5xl">
              {retail ? "One price. No minimum." : "Buy more, pay less per piece."}
            </h2>
          </div>
          <Link href="/pricing" className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.15em] underline-offset-4 hover:underline">
            Full details <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_minmax(0,24rem)] lg:gap-16">
          <ul className="divide-y divide-zinc-200 border-y border-zinc-200">
            {(retail
              ? [
                  ["Per piece", "Every product shows its retail price per piece. Buy one or ten, the price does not change."],
                  ["Same stock as the shops", "Retail pieces come from the same warehouse stock as wholesale orders, so what you see is what ships."],
                  ["Shipping", "Prices do not include delivery. We quote the courier fee with your confirmed total, or arrange pickup."],
                  ["No surprises", "The total we confirm is the total you pay. Nothing is charged before you see it."],
                ]
              : [
                  ["Minimum per style", `${moq} pcs per style, not per size or color. 4 small, 4 medium and 4 large of the same tee count as 12.`],
                  ["Quantity tiers", "Each style has its own tiers. The more pieces of that style in the order, the lower the per-piece price. The cart applies the best one on its own."],
                  ["Regular buyers", "Shops that reorder with us can be moved to a better price group. Your prices then show automatically on this device."],
                  ["Shipping", "Prices do not include delivery. We quote the courier fee with your confirmed total, or arrange pickup."],
                ]
            ).map(([title, text], i) => (
              <li key={title} className="reveal grid gap-2 py-5 sm:grid-cols-[12rem_1fr] sm:gap-6" style={{ "--i": i } as React.CSSProperties}>
                <h3 className="font-bold uppercase leading-tight">{title}</h3>
                <p className="text-sm font-medium text-zinc-600">{text}</p>
              </li>
            ))}
          </ul>
          <div className="reveal self-start border border-zinc-950 p-6">
            <div className={label}>{retail ? "Example · Plain cotton tee" : "Example · Plain cotton tee · per piece"}</div>
            <table className="mt-4 w-full border-t border-zinc-950 font-mono text-sm">
              <tbody>
                {(retail
                  ? [
                      ["1 pc", "₱240", "retail price"],
                      ["3 pcs", "₱240", "same price each"],
                      ["10 pcs", "₱240", "same price each"],
                    ]
                  : [
                      ["1 – 11 pcs", "₱150", "retail store"],
                      ["12 – 47 pcs", "₱140", "wholesale, first tier"],
                      ["48+ pcs", "₱130", "wholesale, volume tier"],
                    ]
                ).map(([qty, price, note], i, arr) => (
                  <tr key={qty} className="border-b border-zinc-200">
                    <td className="py-3 pr-4">
                      <div className={i === arr.length - 1 && !retail ? "font-bold" : ""}>{qty}</div>
                      <div className="text-xs text-zinc-500">{note}</div>
                    </td>
                    <td className="py-3 text-right">
                      <span className="font-display text-2xl">{price}</span>
                      <span className="ml-1 text-xs text-zinc-500">/pc</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs font-medium text-zinc-500">Illustrative. Live prices are on each product page.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
