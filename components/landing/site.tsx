import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BRAND } from "@/lib/brand";

/** Shared chrome + style tokens for the public site (home and detail pages). */
export const label = "font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500";
export const navLink = "text-xs font-bold uppercase tracking-[0.15em]";
export const container = "mx-auto max-w-[1400px] px-5";

/** Placeholder art per category slug, used wherever a product has no photo yet. */
const ART: Record<string, string> = {
  tees: "/landing/tee.svg",
  caps: "/landing/cap.svg",
  outerwear: "/landing/hoodie.svg",
  bottoms: "/landing/pants.svg",
  accessories: "/landing/tote.svg",
};
export const artFor = (slug: string | null | undefined) => (slug && ART[slug]) || "/landing/box.svg";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/how-to-order", label: "How to order" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  return (
    <>
      <div className="bg-zinc-950 text-white">
        <div className={`${container} flex h-8 items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em]`}>
          <span>Wholesale + retail · {BRAND.city}</span>
          <span className="hidden sm:inline">Open 24/7 · order anytime</span>
        </div>
      </div>
      <header className="sticky top-0 z-30 border-b border-zinc-950 bg-white">
        <div className={`${container} flex h-16 items-center justify-between gap-6`}>
          <Link href="/" className="font-display text-2xl uppercase leading-none">
            {BRAND.short}
            <span className="text-zinc-400"> / </span>
            Streetwear
          </Link>
          <nav className={`hidden items-center gap-8 lg:flex ${navLink}`}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-5">
            <Link href="/shop" className={`ink hidden sm:inline ${navLink}`}>Wholesale</Link>
            <Link href="/retail" className={`flex h-10 items-center gap-2 bg-zinc-950 px-4 text-white hover:bg-zinc-800 ${navLink}`}>
              Shop retail <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer id="contact" className="overflow-hidden bg-zinc-950 text-white">
      <div className={`${container} pt-16 pb-6`}>
        <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h2 className="reveal font-display text-4xl uppercase leading-none sm:text-6xl">Questions? Message us.</h2>
            <div className="mt-6 flex flex-col gap-1 font-mono text-sm text-zinc-400">
              <span>{BRAND.phone}</span>
              <span>{BRAND.email}</span>
              <span>{BRAND.city}</span>
            </div>
          </div>
          <nav className={`grid grid-cols-2 gap-x-12 gap-y-3 ${navLink}`}>
            <Link href="/shop" className="ink">Wholesale catalog</Link>
            <Link href="/retail" className="ink">Retail store</Link>
            <Link href="/how-to-order" className="ink">How to order</Link>
            <Link href="/pricing" className="ink">Pricing</Link>
            <Link href="/contact" className="ink">Contact</Link>
            <Link href="/shop/orders" className="ink">Track order</Link>
            <Link href="/admin/login" className="ink">Staff sign in</Link>
          </nav>
        </div>
        <div aria-hidden className="reveal mt-14 -mb-3 select-none font-display text-[12.5vw] uppercase leading-[0.8] whitespace-nowrap xl:text-[11rem]">
          {BRAND.name}
        </div>
        <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-white/20 pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
          <span>Wholesale + retail streetwear</span>
        </div>
      </div>
    </footer>
  );
}

/** Numbered section heading used on the home page and the detail pages. */
export function SectionBar({ no, title, link, dark }: { no: string; title: string; link?: { href: string; label: string }; dark?: boolean }) {
  return (
    <div className="reveal flex items-end justify-between gap-6 py-8 sm:py-10">
      <div className="flex items-baseline gap-4">
        <span className={`font-mono text-xs ${dark ? "text-zinc-500" : "text-zinc-400"}`}>{no}</span>
        <h2 className="font-display text-3xl uppercase leading-none sm:text-5xl">{title}</h2>
      </div>
      {link ? (
        <Link href={link.href} className={`flex shrink-0 items-center gap-1 underline-offset-4 hover:underline ${navLink}`}>
          {link.label} <ArrowUpRight className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

/** Big page title block for the detail pages. */
export function PageHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <section className="border-b border-zinc-950">
      <div className={`${container} pt-14 pb-12 lg:pt-20 lg:pb-16`}>
        <div className={`rise ${label}`}>{eyebrow}</div>
        <h1 className="rise mt-4 font-display text-6xl uppercase leading-[0.9] tracking-tight [--i:1] sm:text-8xl lg:text-9xl">{title}</h1>
        <p className="rise mt-8 max-w-2xl text-lg font-medium text-zinc-600 [--i:2]">{intro}</p>
      </div>
    </section>
  );
}

/** A numbered block of explanatory text: bold title + paragraphs (+ optional bullet list). */
export function Block({ n, title, children, bullets }: { n: string; title: string; children: React.ReactNode; bullets?: string[] }) {
  return (
    <div className="reveal grid gap-4 border-b border-zinc-200 py-8 md:grid-cols-[6rem_1fr] md:gap-8" style={{ "--i": Number(n) % 4 } as React.CSSProperties}>
      <span className="font-display text-4xl leading-none text-zinc-300">{n}</span>
      <div className="max-w-2xl">
        <h3 className="text-lg font-bold uppercase leading-tight">{title}</h3>
        <div className="mt-3 flex flex-col gap-3 text-base font-medium text-zinc-600">{children}</div>
        {bullets ? (
          <ul className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200 text-sm font-medium text-zinc-700">
            {bullets.map((b) => (
              <li key={b} className="py-2.5">{b}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

/** Black call-to-action band at the end of a detail page. */
export function Cta({ title, text }: { title: string; text: string }) {
  return (
    <section className="border-t border-zinc-950 bg-zinc-950 text-white">
      <div className={`${container} grid gap-8 py-16 md:grid-cols-[1fr_auto] md:items-center`}>
        <div>
          <h2 className="reveal font-display text-4xl uppercase leading-none sm:text-6xl">{title}</h2>
          <p className="mt-4 max-w-lg text-zinc-400">{text}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/retail" className={`flex h-12 items-center gap-2 bg-white px-6 text-zinc-950 hover:bg-zinc-200 ${navLink}`}>
            Shop retail <ArrowUpRight className="size-4" />
          </Link>
          <Link href="/shop" className={`flex h-12 items-center border border-white px-6 hover:bg-white/10 ${navLink}`}>
            Wholesale catalog
          </Link>
        </div>
      </div>
    </section>
  );
}
