/* eslint-disable @next/next/no-img-element -- product photos are plain uploads; category art is local SVG */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getLandingData } from "@/lib/queries/landing";
import { peso } from "@/lib/format";
import { Carousel } from "@/components/landing/carousel";
import { SectionBar, artFor, container, label, navLink } from "@/components/landing/site";

export const dynamic = "force-dynamic";


export default async function LandingPage() {
  const { cats, featured, stats } = await getLandingData();
  let sections = 0;
  const no = () => String(++sections).padStart(2, "0");
  const stocked = cats.filter((c) => c.products > 0);
  const categoryList = stocked.length ? stocked : cats;
  const ticker = (stocked.length ? stocked.map((c) => c.name) : ["Tees", "Caps", "Outerwear", "Bottoms", "Accessories"]).concat([
    "Mix sizes & colors",
    `Min ${stats.minMoq} pcs per style`,
    "Open 24/7",
    "GCash · Maya · Bank transfer",
  ]);

  return (
    <>
      {/* hero */}
      <section className="relative border-b border-zinc-950 bg-zinc-950 text-white">
        <img src="/landing/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-right" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/60 to-zinc-950/30" />
        <div className={`${container} relative pt-16 pb-12 lg:pt-24 lg:pb-16`}>
          <h1 className="font-display text-[15vw] uppercase leading-[0.86] tracking-tight sm:text-[13vw] lg:text-[10rem] xl:text-[11.5rem]">
            <span className="rise block">Stock up<span className="text-white/40">.</span></span>
            <span className="rise block [--i:1]">Sell out<span className="text-white/40">.</span></span>
          </h1>
          <div className="mt-10 grid gap-8 border-t border-white/30 pt-8 lg:grid-cols-[1.2fr_1fr_auto] lg:items-end">
            <p className="rise max-w-md text-lg font-medium text-zinc-200 [--i:2]">
              Tees, caps, hoodies and bags from our own stock. Browse what&rsquo;s in the warehouse right now, mix sizes and
              colors, and send an order request in minutes. No account. We confirm by message, you pay by GCash, Maya or bank
              transfer, and it ships the same day.
            </p>
            <dl className="rise grid grid-cols-3 gap-6 [--i:3] [&_dd]:text-zinc-300">
              {stats.styles > 0 && <Stat value={`${stats.styles}+`} label="styles in stock" />}
              <Stat value={`${stats.minMoq}`} label="pcs min. per style" />
              <Stat value="24/7" label="open, order anytime" />
            </dl>
            <div className="rise flex flex-wrap gap-3 [--i:4]">
              <Link href="/retail" className={`flex h-12 items-center gap-2 bg-white px-6 text-zinc-950 hover:bg-zinc-200 ${navLink}`}>
                Shop retail <ArrowUpRight className="size-4" />
              </Link>
              <Link href="/shop" className={`flex h-12 items-center border border-white px-6 hover:bg-white/10 ${navLink}`}>
                Wholesale catalog
              </Link>
            </div>
          </div>
        </div>
        <div className="overflow-hidden border-t border-zinc-950 bg-zinc-950 py-2 text-white">
          <ul className="marquee flex w-max shrink-0 font-display text-xl uppercase tracking-wide">
            {[...ticker, ...ticker].map((t, i) => (
              <li key={i} className="flex items-center whitespace-nowrap">
                {t}
                <span className="mx-6 text-zinc-500">/</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* stock */}
      {featured.length > 0 && (
        <section id="stock" className="overflow-hidden border-b border-zinc-950">
          <div className={`${container} pb-16`}>
            <Carousel heading={<SectionBar no={no()} title="In stock now" />} link={{ href: "/shop", label: "View all" }}>
              {featured.map((p, i) => (
                <li key={p.id} className="reveal w-64 shrink-0 snap-start sm:w-80" style={{ "--i": i } as React.CSSProperties}>
                  <Link href={`/shop/product/${p.slug}`} className="group block">
                    <div className="relative aspect-square overflow-hidden bg-zinc-100">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <img src={artFor(p.category?.toLowerCase())} alt="" className="size-2/5 opacity-60 grayscale transition duration-500 group-hover:scale-110" />
                        </div>
                      )}
                      {p.stock <= 0 && (
                        <span className="absolute top-3 left-3 bg-zinc-950 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white">Sold out</span>
                      )}
                    </div>
                    <div className={`mt-4 ${label}`}>{p.category ?? "Style"}</div>
                    <div className="mt-1 font-bold uppercase leading-tight group-hover:underline underline-offset-4">{p.name}</div>
                    <div className="mt-1 font-display text-xl leading-none">
                      {peso(p.price)} <span className={label}>per pc</span>
                    </div>
                  </Link>
                </li>
              ))}
            </Carousel>
          </div>
        </section>
      )}

      {/* categories */}
      {categoryList.length > 0 && (
        <section id="categories" className="border-b border-zinc-950">
          <div className={`${container} pb-16`}>
            <SectionBar no={no()} title="Categories" />
            <ul className="border-t border-zinc-950">
              {categoryList.map((c, i) => (
                <li key={c.id} className="border-b border-zinc-950">
                  <Link
                    href={`/shop?category=${c.slug}`}
                    className="reveal group relative isolate flex items-center gap-4 overflow-hidden px-2 py-5 transition hover:text-white before:absolute before:inset-0 before:-z-10 before:-translate-x-full before:bg-zinc-950 before:transition-transform before:duration-300 hover:before:translate-x-0 sm:gap-8 sm:py-7"
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    <span className="w-8 font-mono text-xs text-zinc-500 group-hover:text-zinc-400">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 font-display text-4xl uppercase leading-none sm:text-6xl">{c.name}</span>
                    <span className={`hidden sm:block ${label} group-hover:text-zinc-400`}>
                      {c.products} {c.products === 1 ? "style" : "styles"}
                    </span>
                    <ArrowUpRight className="size-6 transition group-hover:-translate-y-1 group-hover:translate-x-1 sm:size-8" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* how to order */}
      <section id="how" className="border-b border-zinc-950 bg-zinc-950 text-white">
        <div className={`${container} pb-16`}>
          <SectionBar no={no()} title="How to order" dark />
          <ol className="grid border border-white/20 md:grid-cols-3">
            <Step n="01" title="Build your order" text="See real stock per size and color. Add at least the minimum per style and tier prices apply on their own." />
            <Step n="02" title="Send the request" text="Shop name, contact number, address. No account, no payment yet." />
            <Step n="03" title="We confirm, you pay, it ships" text="We check stock and message you the final total. Pay by GCash, Maya or bank transfer and it goes out the same day." last />
          </ol>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="border-b border-zinc-950">
        <div className={`${container} pb-16`}>
          <SectionBar no={no()} title="Wholesale pricing" />
          <div className="grid border-t border-zinc-950 lg:grid-cols-2">
            <div className="reveal py-8 lg:border-r lg:border-zinc-950 lg:pr-12">
              <p className="max-w-md text-lg font-medium text-zinc-600">
                Buy more of a style, pay less per piece. Tiers count every size and color of the same style together, so you
                can mix and still hit the better price.
              </p>
              <ul className="mt-8 divide-y divide-zinc-200 border-y border-zinc-200 text-sm font-medium">
                <Perk n="a" text={`Minimum ${stats.minMoq} pcs per style. Mix sizes and colors freely.`} />
                <Perk n="b" text="Prices are per piece and update live as you change quantity." />
                <Perk n="c" text="We confirm the final total before anything ships." />
              </ul>
            </div>
            <div className="reveal py-8 lg:pl-12 [--i:1]">
              <div className={label}>Example · Plain cotton tee</div>
              <table className="mt-4 w-full border-t border-zinc-950 font-mono text-sm">
                <tbody>
                  <TierRow qty="1 – 11 pcs" price="₱150" note="retail-size order" />
                  <TierRow qty="12+ pcs" price="₱140" note="wholesale tier" best />
                </tbody>
              </table>
              <p className="mt-4 text-sm font-medium text-zinc-500">Every style has its own tiers. You see them on the product page.</p>
            </div>
          </div>
        </div>
      </section>

      {/* two stores */}
      <section className="border-b border-zinc-950">
        <div className={`${container} grid md:grid-cols-2`}>
          <Channel
            href="/shop"
            question="Buying for your shop?"
            title="Wholesale"
            text={`Tier prices, minimum ${stats.minMoq} pcs per style. Mix sizes and colors.`}
            cta="Open the catalog"
            className="border-b border-zinc-950 md:border-r md:border-b-0"
          />
          <Channel href="/retail" className="[--i:1]" question="Buying for yourself?" title="Retail" text="Single pieces at retail price. Same stock, same fast dispatch." cta="Shop retail" />
        </div>
      </section>

    </>
  );
}

// ------------------------------------------------------------------ pieces

function Stat({ value, label: text }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-display text-4xl leading-none sm:text-5xl">{value}</dt>
      <dd className={`mt-2 ${label}`}>{text}</dd>
    </div>
  );
}

function Step({ n, title, text, last }: { n: string; title: string; text: string; last?: boolean }) {
  return (
    <li className={`reveal flex flex-col p-6 sm:p-8 ${last ? "" : "border-b border-white/20 md:border-r md:border-b-0"}`} style={{ "--i": Number(n) } as React.CSSProperties}>
      <span className="font-display text-6xl leading-none text-white/25">{n}</span>
      <h3 className="mt-10 text-lg font-bold uppercase leading-tight">{title}</h3>
      <p className="mt-3 text-sm font-medium text-zinc-400">{text}</p>
    </li>
  );
}

function Perk({ n, text }: { n: string; text: string }) {
  return (
    <li className="flex gap-4 py-3">
      <span className="w-4 font-mono text-xs text-zinc-400">{n}</span>
      {text}
    </li>
  );
}

function TierRow({ qty, price, note, best }: { qty: string; price: string; note: string; best?: boolean }) {
  return (
    <tr className="border-b border-zinc-200">
      <td className="py-4 pr-4">
        <div className={best ? "font-bold" : ""}>{qty}</div>
        <div className="text-xs text-zinc-500">{note}</div>
      </td>
      <td className="py-4 text-right">
        <span className="font-display text-2xl">{price}</span>
        <span className="ml-1 text-xs text-zinc-500">/pc</span>
        {best ? <span className="ml-3 bg-zinc-950 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">best</span> : null}
      </td>
    </tr>
  );
}

function Channel({ href, question, title, text, cta, className = "" }: { href: string; question: string; title: string; text: string; cta: string; className?: string }) {
  return (
    <Link href={href} className={`reveal group flex min-h-72 flex-col gap-4 py-10 transition hover:bg-zinc-950 hover:text-white md:px-10 ${className}`}>
      <span className={`${label} group-hover:text-zinc-400`}>{question}</span>
      <span className="font-display text-6xl uppercase leading-none sm:text-8xl">{title}</span>
      <span className="max-w-xs text-sm font-medium text-zinc-500 group-hover:text-zinc-400">{text}</span>
      <span className={`mt-auto flex items-center gap-2 ${navLink}`}>
        {cta} <ArrowUpRight className="size-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
