/* eslint-disable @next/next/no-img-element -- landing art is local SVG and product photos are plain uploads */
import Link from "next/link";
import { ArrowRight, PackageCheck, Search, Send, ShieldCheck, Truck, Layers } from "lucide-react";
import { getLandingData } from "@/lib/queries/landing";
import { peso } from "@/lib/format";
import { RevealOnScroll } from "@/components/landing/reveal";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

const ART: Record<string, string> = {
  tees: "/landing/tee.svg",
  caps: "/landing/cap.svg",
  outerwear: "/landing/hoodie.svg",
  bottoms: "/landing/pants.svg",
  accessories: "/landing/tote.svg",
};
const artFor = (slug: string | null | undefined, fallback = "/landing/box.svg") => (slug && ART[slug]) || fallback;

export default async function LandingPage() {
  const { cats, featured, stats } = await getLandingData();
  const categoriesWithProducts = cats.filter((c) => c.products > 0);
  const marqueeItems = (categoriesWithProducts.length ? categoriesWithProducts.map((c) => c.name) : ["Tees", "Caps", "Outerwear", "Bottoms", "Accessories"]).concat([
    "Mix sizes & colors",
    `Min ${stats.minMoq} pcs per style`,
    "Same-day dispatch",
    "GCash · Maya · Bank transfer",
  ]);

  return (
    <div className="min-h-screen bg-[#f6f7f5] text-zinc-900">
      <RevealOnScroll />

      {/* ---------------------------------------------------------------- nav */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-[#f6f7f5]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5 font-extrabold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-700 text-white">
              <Layers className="size-4" />
            </span>
            {BRAND.name} <span className="hidden font-semibold text-zinc-500 sm:inline">{BRAND.tagline}</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-zinc-600 md:flex">
            <a href="#categories" className="hover:text-zinc-900">Categories</a>
            <a href="#how" className="hover:text-zinc-900">How it works</a>
            <a href="#pricing" className="hover:text-zinc-900">Pricing</a>
            <a href="#contact" className="hover:text-zinc-900">Contact</a>
          </nav>
          <Link href="/retail" className="hidden h-10 items-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-bold hover:bg-zinc-50 sm:flex">
            Retail store
          </Link>
          <Link href="/shop" className="flex h-10 items-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-bold text-white hover:bg-zinc-800">
            Browse catalog <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      {/* --------------------------------------------------------------- hero */}
      <section className="relative overflow-hidden">
        <div className="drift pointer-events-none absolute -top-32 -right-24 size-[520px] rounded-full bg-brand-200/50 blur-3xl" />
        <div className="drift pointer-events-none absolute -bottom-40 -left-24 size-[420px] rounded-full bg-amber-100/70 blur-3xl [animation-delay:-8s]" />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-16 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-24 lg:pb-28">
          <div className="flex flex-col gap-6">
            <span className="rise inline-flex w-fit items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800">
              <span className="size-1.5 rounded-full bg-brand-600" /> KCA Streetwear · now taking reseller orders
            </span>
            <h1 className="rise rise-1 text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Streetwear for resellers, at wholesale prices.
            </h1>
            <p className="rise rise-2 max-w-xl text-lg font-medium text-zinc-600">
              Browse live stock, mix sizes and colors, and send an order request in minutes. No account needed — we confirm by message, you
              pay by GCash or bank transfer, and your order ships the same day.
            </p>
            <div className="rise rise-3 flex flex-wrap gap-3">
              <Link href="/shop" className="flex h-12 items-center gap-2 rounded-xl bg-brand-700 px-6 text-base font-bold text-white shadow-lg shadow-brand-700/20 hover:bg-brand-800">
                Browse the catalog <ArrowRight className="size-4" />
              </Link>
              <Link href="/shop/orders" className="flex h-12 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-6 text-base font-bold hover:bg-zinc-50">
                Track an order
              </Link>
            </div>
            <dl className="rise rise-4 mt-2 grid max-w-md grid-cols-3 gap-4 border-t border-zinc-200 pt-6">
              <Stat value={`${stats.styles}+`} label="styles in stock" />
              <Stat value={`${stats.minMoq} pcs`} label="minimum per style" />
              <Stat value="Same day" label="dispatch before 2 pm" />
            </dl>
          </div>

          {/* floating product cards */}
          <div className="relative mx-auto h-[420px] w-full max-w-md lg:h-[520px]">
            <FloatCard className="float left-0 top-6 w-52" tilt="-6deg" art="/landing/tee.svg" name="Plain Cotton Tee" price="₱140 /pc" note="12+ pcs" />
            <FloatCard className="float-slow right-0 top-0 w-48" tilt="5deg" art="/landing/cap.svg" name="Snapback Cap" price="₱180 /pc" note="5 colors" />
            <FloatCard className="float-fast left-10 bottom-6 w-48" tilt="4deg" art="/landing/tote.svg" name="Canvas Tote Bag" price="₱100 /pc" note="3 prints" />
            <FloatCard className="float right-6 bottom-16 w-52" tilt="-4deg" art="/landing/hoodie.svg" name="Zip Hoodie" price="₱530 /pc" note="M–XXL" />
          </div>
        </div>

        {/* marquee */}
        <div className="border-y border-zinc-200 bg-white/70 py-3">
          <div className="flex overflow-hidden">
            <ul className="marquee flex shrink-0 items-center gap-10 pr-10 text-sm font-bold tracking-wide text-zinc-500 uppercase">
              {[...marqueeItems, ...marqueeItems].map((t, i) => (
                <li key={i} className="flex items-center gap-10 whitespace-nowrap">
                  {t} <span className="size-1.5 rounded-full bg-brand-600" />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- categories */}
      <section id="categories" className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading eyebrow="What we carry" title="Everything a clothing reseller restocks" sub="Live stock from our warehouse. Pick sizes and colors per style." />
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(categoriesWithProducts.length ? categoriesWithProducts : cats).map((c, i) => (
            <Link
              key={c.id}
              href={`/shop?category=${c.slug}`}
              className={`reveal reveal-delay-${(i % 3) + 1} group flex items-center gap-5 rounded-2xl border border-zinc-200 bg-white p-5 transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-900/5`}
            >
              <img src={artFor(c.slug)} alt="" className="size-20 shrink-0 transition group-hover:scale-110" />
              <div className="min-w-0 flex-1">
                <div className="text-lg font-extrabold">{c.name}</div>
                <div className="text-sm font-medium text-zinc-500">
                  {c.products} {c.products === 1 ? "style" : "styles"} in stock
                </div>
              </div>
              <ArrowRight className="size-5 text-zinc-300 transition group-hover:translate-x-1 group-hover:text-brand-700" />
            </Link>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- how it works */}
      <section id="how" className="bg-zinc-900 py-20 text-white">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading dark eyebrow="How ordering works" title="Three steps, no paperwork" sub="You browse, you send a request, we handle the rest." />
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            <Step n="1" icon={<Search className="size-5" />} title="Browse and build your order" text="See real stock per size and color. Add at least the minimum per style — tier prices apply automatically." />
            <Step n="2" icon={<Send className="size-5" />} title="Send the order request" text="Give us your shop name, contact number and address. No account, no payment yet." />
            <Step n="3" icon={<Truck className="size-5" />} title="We confirm and deliver" text="We check stock and message you the final total. Pay by GCash, Maya or bank transfer — your order ships as soon as payment lands." />
          </ol>
        </div>
      </section>

      {/* ----------------------------------------------------------- featured */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-20">
          <SectionHeading eyebrow="Best sellers" title="What resellers reorder most" sub="Wholesale prices per piece at the first tier." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((p, i) => (
              <Link
                key={p.id}
                href={`/shop/product/${p.slug}`}
                className={`reveal reveal-delay-${(i % 4) + 1} group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:-translate-y-1 hover:shadow-lg hover:shadow-brand-900/5`}
              >
                <div className="flex h-44 items-center justify-center bg-gradient-to-br from-zinc-50 to-brand-50">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <img src={artFor(p.category?.toLowerCase())} alt="" className="size-28 transition group-hover:scale-110" />
                  )}
                </div>
                <div className="p-4">
                  <div className="text-xs font-bold tracking-wider text-zinc-500 uppercase">{p.category ?? "Style"}</div>
                  <div className="mt-0.5 font-extrabold">{p.name}</div>
                  <div className="mt-1 text-sm font-semibold text-brand-700">from {peso(p.price)} /pc</div>
                </div>
              </Link>
            ))}
          </div>
          <div className="reveal mt-8 text-center">
            <Link href="/shop" className="inline-flex h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-5 text-sm font-bold hover:bg-zinc-50">
              See the full catalog <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ pricing */}
      <section id="pricing" className="border-y border-zinc-200 bg-white py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
          <div className="reveal">
            <SectionHeading eyebrow="Wholesale pricing" title="Buy more of a style, pay less per piece" sub="Tiers count every size and color of the same style together, so you can mix and still hit the better price." align="left" />
            <ul className="mt-8 flex flex-col gap-3">
              <Perk icon={<Layers className="size-4" />} text={`Minimum ${stats.minMoq} pcs per style — mix sizes and colors freely`} />
              <Perk icon={<PackageCheck className="size-4" />} text="Prices shown are per piece and update live as you change quantity" />
              <Perk icon={<ShieldCheck className="size-4" />} text="Final total is confirmed by us before anything ships — no surprises" />
            </ul>
          </div>
          <div className="reveal reveal-delay-2 rounded-3xl border border-zinc-200 bg-[#f6f7f5] p-6 sm:p-8">
            <div className="text-xs font-bold tracking-wider text-zinc-500 uppercase">Example · Plain Cotton Tee</div>
            <div className="mt-4 flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
              <TierRow qty="1 – 11 pcs" price="₱150" note="retail-size order" />
              <TierRow qty="12+ pcs" price="₱140" note="wholesale tier" best />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-500">Every style has its own tiers — you see them on the product page.</p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ contact */}
      <section id="contact" className="mx-auto max-w-6xl px-5 py-20">
        <div className="reveal relative overflow-hidden rounded-3xl bg-brand-700 px-6 py-14 text-white sm:px-12">
          <div className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full bg-brand-500/40 blur-3xl" />
          <div className="relative grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">Ready to restock?</h2>
              <p className="mt-3 max-w-lg text-brand-50/90">
                Send your first order request today. Questions about bulk pricing or custom prints? Message us at{" "}
                <span className="font-bold text-white">{BRAND.phone}</span> or{" "}
                <span className="font-bold text-white">{BRAND.email}</span>.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <Link href="/shop" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-bold text-brand-800 hover:bg-brand-50">
                Browse the catalog <ArrowRight className="size-4" />
              </Link>
              <Link href="/shop/orders" className="flex h-12 items-center justify-center rounded-xl border border-white/40 px-6 text-base font-bold text-white hover:bg-white/10">
                Track an order
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm font-medium text-zinc-500 sm:flex-row">
          <div>© {new Date().getFullYear()} {BRAND.name} {BRAND.tagline} · {BRAND.city}</div>
          <div className="flex gap-6">
            <Link href="/shop" className="hover:text-zinc-900">Wholesale catalog</Link>
            <Link href="/retail" className="hover:text-zinc-900">Retail store</Link>
            <Link href="/shop/orders" className="hover:text-zinc-900">Track order</Link>
            <Link href="/admin/login" className="hover:text-zinc-900">Staff sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="text-2xl font-extrabold tracking-tight">{value}</dt>
      <dd className="text-xs font-semibold text-zinc-500">{label}</dd>
    </div>
  );
}

function FloatCard({ className, tilt, art, name, price, note }: { className: string; tilt: string; art: string; name: string; price: string; note: string }) {
  return (
    <div className={`absolute rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl shadow-zinc-900/10 ${className}`} style={{ ["--tilt" as string]: tilt }}>
      <div className="flex h-28 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-50 to-brand-50">
        <img src={art} alt="" className="size-24" />
      </div>
      <div className="mt-2.5 px-0.5">
        <div className="text-sm font-extrabold">{name}</div>
        <div className="flex items-baseline justify-between text-xs font-semibold text-zinc-500">
          <span className="text-brand-700">{price}</span>
          <span>{note}</span>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, sub, dark, align = "center" }: { eyebrow: string; title: string; sub?: string; dark?: boolean; align?: "center" | "left" }) {
  return (
    <div className={`reveal ${align === "center" ? "mx-auto max-w-2xl text-center" : ""}`}>
      <div className={`text-xs font-bold tracking-wider uppercase ${dark ? "text-brand-300" : "text-brand-700"}`}>{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {sub ? <p className={`mt-3 text-base font-medium ${dark ? "text-zinc-300" : "text-zinc-600"}`}>{sub}</p> : null}
    </div>
  );
}

function Step({ n, icon, title, text }: { n: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className={`reveal reveal-delay-${n} rounded-2xl border border-white/10 bg-white/5 p-6`}>
      <div className="flex items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500/20 text-brand-300">{icon}</span>
        <span className="text-4xl font-extrabold text-white/10">{n}</span>
      </div>
      <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
      <p className="mt-2 text-sm font-medium text-zinc-300">{text}</p>
    </li>
  );
}

function Perk({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3 text-sm font-semibold text-zinc-700">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">{icon}</span>
      {text}
    </li>
  );
}

function TierRow({ qty, price, note, best }: { qty: string; price: string; note: string; best?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div>
        <div className="font-extrabold">{qty}</div>
        <div className="text-xs font-semibold text-zinc-500">{note}</div>
      </div>
      <div className={`text-xl font-extrabold tabular-nums ${best ? "text-brand-700" : ""}`}>
        {price} <span className="text-xs font-semibold text-zinc-500">/pc</span>
        {best ? <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">best</span> : null}
      </div>
    </div>
  );
}
