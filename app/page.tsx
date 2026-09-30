/* eslint-disable @next/next/no-img-element -- product photos are plain uploads; category art is local SVG */
import Link from "next/link";
import { Instrument_Serif } from "next/font/google";
import { ArrowRight } from "lucide-react";
import { getLandingData } from "@/lib/queries/landing";
import { peso } from "@/lib/format";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

// display face for the landing page only (see --font-display in globals.css)
const display = Instrument_Serif({ weight: "400", style: ["normal", "italic"], subsets: ["latin"], variable: "--font-instrument" });

const ART: Record<string, string> = {
  tees: "/landing/tee.svg",
  caps: "/landing/cap.svg",
  outerwear: "/landing/hoodie.svg",
  bottoms: "/landing/pants.svg",
  accessories: "/landing/tote.svg",
};
const artFor = (slug: string | null | undefined) => (slug && ART[slug]) || "/landing/box.svg";

const container = "mx-auto max-w-6xl px-6";
const label = "text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500";
const btn = "inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-[11px] font-semibold uppercase tracking-[0.2em] transition";
const btnDark = `${btn} bg-stone-900 text-stone-50 hover:bg-stone-700`;
const btnLight = `${btn} border border-stone-300 text-stone-900 hover:border-stone-900`;

export default async function LandingPage() {
  const { cats, featured, stats } = await getLandingData();
  const stocked = cats.filter((c) => c.products > 0);
  const categoryList = stocked.length ? stocked : cats;
  const heroPair = featured.slice(0, 2);

  return (
    <div className={`${display.variable} min-h-screen bg-stone-50 text-stone-900`}>
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-stone-50/85 backdrop-blur">
        <div className={`${container} flex h-16 items-center justify-between lg:grid lg:grid-cols-[1fr_auto_1fr]`}>
          <nav className={`hidden items-center gap-7 lg:flex ${label}`}>
            <a href="#collection" className="transition hover:text-stone-900">Collection</a>
            <a href="#how" className="transition hover:text-stone-900">Ordering</a>
            <a href="#pricing" className="transition hover:text-stone-900">Pricing</a>
            <a href="#contact" className="transition hover:text-stone-900">Contact</a>
          </nav>
          <Link href="/" className="font-display text-[26px] leading-none tracking-tight lg:col-start-2">
            {BRAND.short} <span className="italic">Streetwear</span>
          </Link>
          <div className={`flex items-center justify-end gap-6 ${label}`}>
            <Link href="/retail" className="hidden transition hover:text-stone-900 sm:inline">Retail</Link>
            <Link href="/shop" className="flex items-center gap-1.5 text-stone-900 transition hover:gap-2.5">
              Wholesale <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className={`${container} grid gap-12 pt-20 pb-16 lg:grid-cols-12 lg:items-end lg:pt-28 lg:pb-24`}>
        <div className="lg:col-span-7">
          <div className={label}>{BRAND.city} · Wholesale &amp; retail</div>
          <h1 className="mt-6 max-w-2xl font-display text-6xl leading-[0.95] tracking-tight text-balance sm:text-7xl xl:text-[5.5rem]">
            Streetwear, <em>curated</em> for shops and for you.
          </h1>
          <p className="mt-8 max-w-md text-base leading-relaxed text-stone-600">
            Tees, caps, hoodies and bags from our own stock. Resellers order by the dozen at wholesale tiers; everyone else
            buys single pieces at retail. No account, no upfront payment. We confirm by message and ship once you pay.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/shop" className={btnDark}>
              Wholesale catalog <ArrowRight className="size-3.5" />
            </Link>
            <Link href="/retail" className={btnLight}>
              Retail store
            </Link>
          </div>
        </div>

        {heroPair.length > 0 && (
          <div className="grid grid-cols-2 gap-4 lg:col-span-5">
            {heroPair.map((p, i) => (
              <Link key={p.id} href={`/shop/product/${p.slug}`} className={`group ${i === 1 ? "mt-12" : ""}`}>
                <Tile imageUrl={p.imageUrl} alt={p.name} art={artFor(p.category?.toLowerCase())} ratio="aspect-[4/5]" />
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <span className="font-display text-xl leading-tight">{p.name}</span>
                  <span className="text-sm text-stone-500">{peso(p.price)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* numbers */}
      <section className="border-y border-stone-200">
        <dl className={`${container} grid grid-cols-2 gap-x-6 gap-y-8 py-10 sm:grid-cols-4`}>
          {stats.styles > 0 && <Stat value={`${stats.styles}`} label="styles in stock" />}
          <Stat value={`${stats.minMoq}`} label="pcs minimum per style" />
          <Stat value="24/7" label="open, order anytime" />
          <Stat value="Same day" label="dispatch after payment" />
        </dl>
      </section>

      {/* collection */}
      {categoryList.length > 0 && (
        <section id="collection" className={`${container} py-20 lg:py-28`}>
          <Heading eyebrow="The collection" title="Everything a shop restocks" />
          <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            {categoryList.map((c) => (
              <li key={c.id}>
                <Link href={`/shop?category=${c.slug}`} className="group block">
                  <Tile art={artFor(c.slug)} ratio="aspect-[4/5]" />
                  <div className="mt-4 font-display text-2xl leading-none">{c.name}</div>
                  <div className={`mt-1.5 ${label}`}>
                    {c.products} {c.products === 1 ? "style" : "styles"}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* best sellers */}
      {featured.length > 0 && (
        <section className="border-t border-stone-200 bg-stone-100/60">
          <div className={`${container} py-20 lg:py-28`}>
            <Heading eyebrow="Best sellers" title="What shops reorder most" link={{ href: "/shop", label: "Full catalog" }} />
            <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
              {featured.map((p) => (
                <li key={p.id}>
                  <Link href={`/shop/product/${p.slug}`} className="group block">
                    <Tile imageUrl={p.imageUrl} alt={p.name} art={artFor(p.category?.toLowerCase())} ratio="aspect-[3/4]" />
                    <div className={`mt-4 ${label}`}>{p.category ?? "Style"}</div>
                    <div className="mt-1 flex items-baseline justify-between gap-3">
                      <span className="font-display text-xl leading-tight">{p.name}</span>
                      <span className="shrink-0 text-sm text-stone-500">
                        {peso(p.price)} <span className="text-stone-400">/pc</span>
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* how to order */}
      <section id="how" className={`${container} py-20 lg:py-28`}>
        <Heading eyebrow="Ordering" title="Three steps, no paperwork" />
        <ol className="mt-12 grid gap-10 border-t border-stone-200 pt-10 md:grid-cols-3 md:gap-8">
          <Step n="i" title="Build your order" text="See real stock per size and color. Add at least the minimum per style and the tier price applies on its own." />
          <Step n="ii" title="Send the request" text="Your shop name, contact number and address. No account, nothing to pay yet." />
          <Step n="iii" title="We confirm, you pay, it ships" text="We check stock and message you the final total. Pay by GCash, Maya or bank transfer and it leaves the same day." />
        </ol>
      </section>

      {/* pricing */}
      <section id="pricing" className="border-t border-stone-200 bg-stone-100/60">
        <div className={`${container} grid gap-12 py-20 lg:grid-cols-2 lg:gap-20 lg:py-28`}>
          <div>
            <Heading eyebrow="Wholesale pricing" title="Buy more of a style, pay less per piece" />
            <p className="mt-6 max-w-md leading-relaxed text-stone-600">
              Tiers count every size and color of the same style together, so you can mix and still reach the better price.
              Every style has its own tiers, shown on the product page.
            </p>
            <ul className="mt-8 flex flex-col gap-3 text-sm text-stone-700">
              <li>Minimum {stats.minMoq} pcs per style, sizes and colors mixed freely.</li>
              <li>Prices are per piece and update live as you change quantity.</li>
              <li>We confirm the final total before anything ships.</li>
            </ul>
          </div>
          <div className="self-center rounded-2xl border border-stone-200 bg-stone-50 p-8 sm:p-10">
            <div className={label}>Example · Plain cotton tee</div>
            <dl className="mt-6 divide-y divide-stone-200">
              <TierRow qty="1 – 11 pcs" price="₱150" note="retail-size order" />
              <TierRow qty="12+ pcs" price="₱140" note="wholesale tier" best />
            </dl>
          </div>
        </div>
      </section>

      {/* two stores */}
      <section className={`${container} grid gap-4 py-20 md:grid-cols-2 lg:py-28`}>
        <Channel href="/shop" eyebrow="For shops" title="Wholesale" text={`Tier prices from ${stats.minMoq} pcs per style. Mix sizes and colors.`} cta="Open the catalog" />
        <Channel href="/retail" eyebrow="For you" title="Retail" text="Single pieces at retail price. Same stock, same fast dispatch." cta="Shop retail" />
      </section>

      <footer id="contact" className="border-t border-stone-200">
        <div className={`${container} flex flex-col items-center py-20 text-center`}>
          <div className="font-display text-5xl leading-none tracking-tight sm:text-7xl">
            {BRAND.short} <span className="italic">Streetwear</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone-600">
            Questions about bulk pricing or custom prints? Message us any time.
          </p>
          <div className="mt-6 flex flex-col gap-1 text-sm text-stone-700 sm:flex-row sm:gap-6">
            <span>{BRAND.phone}</span>
            <span>{BRAND.email}</span>
            <span>{BRAND.city}</span>
          </div>
          <nav className={`mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3 ${label}`}>
            <Link href="/shop" className="transition hover:text-stone-900">Wholesale catalog</Link>
            <Link href="/retail" className="transition hover:text-stone-900">Retail store</Link>
            <Link href="/shop/orders" className="transition hover:text-stone-900">Track order</Link>
            <Link href="/admin/login" className="transition hover:text-stone-900">Staff sign in</Link>
          </nav>
          <div className="mt-10 text-xs text-stone-400">© {new Date().getFullYear()} {BRAND.name}</div>
        </div>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function Tile({ imageUrl, alt, art, ratio }: { imageUrl?: string | null; alt?: string; art: string; ratio: string }) {
  return (
    <div className={`overflow-hidden rounded-xl bg-stone-200/60 ${ratio}`}>
      {imageUrl ? (
        <img src={imageUrl} alt={alt ?? ""} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <img src={art} alt="" className="size-1/3 opacity-50 grayscale transition duration-700 group-hover:scale-110" />
        </div>
      )}
    </div>
  );
}

function Stat({ value, label: text }: { value: string; label: string }) {
  return (
    <div>
      <dt className="font-display text-4xl leading-none sm:text-5xl">{value}</dt>
      <dd className={`mt-2 ${label}`}>{text}</dd>
    </div>
  );
}

function Heading({ eyebrow, title, link }: { eyebrow: string; title: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <div className={label}>{eyebrow}</div>
        <h2 className="mt-3 font-display text-4xl leading-none tracking-tight text-balance sm:text-5xl">{title}</h2>
      </div>
      {link ? (
        <Link href={link.href} className={`flex items-center gap-1.5 text-stone-900 transition hover:gap-2.5 ${label}`}>
          {link.label} <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <li>
      <span className="font-display text-3xl italic text-stone-400">{n}.</span>
      <h3 className="mt-4 font-display text-2xl leading-tight">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-stone-600">{text}</p>
    </li>
  );
}

function TierRow({ qty, price, note, best }: { qty: string; price: string; note: string; best?: boolean }) {
  return (
    <div className="flex items-center justify-between py-4">
      <div>
        <dt className="text-sm font-semibold">{qty}</dt>
        <dd className="text-xs text-stone-500">{note}</dd>
      </div>
      <dd className="flex items-center gap-3">
        <span className="font-display text-3xl">{price}</span>
        <span className="text-xs text-stone-500">/pc</span>
        {best ? <span className="rounded-full border border-stone-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em]">best</span> : null}
      </dd>
    </div>
  );
}

function Channel({ href, eyebrow, title, text, cta }: { href: string; eyebrow: string; title: string; text: string; cta: string }) {
  return (
    <Link href={href} className="group flex min-h-64 flex-col rounded-2xl border border-stone-200 p-8 transition hover:border-stone-900 sm:p-10">
      <span className={label}>{eyebrow}</span>
      <span className="mt-4 font-display text-5xl leading-none tracking-tight sm:text-6xl">{title}</span>
      <span className="mt-4 max-w-xs text-sm leading-relaxed text-stone-600">{text}</span>
      <span className={`mt-auto flex items-center gap-1.5 pt-8 text-stone-900 transition group-hover:gap-2.5 ${label}`}>
        {cta} <ArrowRight className="size-3.5" />
      </span>
    </Link>
  );
}
