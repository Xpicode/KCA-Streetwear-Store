import Link from "next/link";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Cat = { slug: string; name: string };

/** Category chips (?category=slug) + a search box that only shows on phones (the header has one on desktop). */
export function CatalogFilters({ categories, active, q }: { categories: Cat[]; active?: string; q?: string }) {
  const href = (slug?: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (slug) sp.set("category", slug);
    const s = sp.toString();
    return s ? `/shop?${s}` : "/shop";
  };
  const chip = (isActive: boolean) =>
    cn(
      "flex h-9 shrink-0 items-center rounded-full border px-4 text-sm font-bold whitespace-nowrap transition-colors",
      isActive ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400"
    );

  return (
    <div className="flex flex-col gap-3">
      <form action="/shop" className="flex h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 md:hidden">
        {active && <input type="hidden" name="category" value={active} />}
        <Search className="size-4 text-zinc-500" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search tees, caps, bags…"
          className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-zinc-400"
        />
      </form>

      <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
        <Link href={href()} className={chip(!active)}>
          All
        </Link>
        {categories.map((c) => (
          <Link key={c.slug} href={href(c.slug)} className={chip(active === c.slug)}>
            {c.name}
          </Link>
        ))}
        {q && (
          <Link href={href(active)} className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 text-sm font-bold text-emerald-800">
            “{q}” <X className="size-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
