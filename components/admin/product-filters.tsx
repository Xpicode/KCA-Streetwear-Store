"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Category = { id: number; name: string };

export function ProductFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const activeCategory = params.get("category") ?? "";
  const [q, setQ] = useState(params.get("q") ?? "");

  // push the search term into the URL after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      if (next.toString() !== params.toString()) router.replace(`${pathname}?${next.toString()}`);
    }, 250);
    return () => clearTimeout(t);
  }, [q, params, pathname, router]);

  const categoryHref = (id: string) => {
    const next = new URLSearchParams(params.toString());
    if (id) next.set("category", id);
    else next.delete("category");
    const s = next.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex h-9 w-full sm:w-72 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3">
        <Search className="size-4 text-zinc-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or SKU"
          className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-zinc-400"
        />
      </label>

      <div className="flex flex-wrap gap-1.5">
        <Chip href={categoryHref("")} active={activeCategory === ""}>
          All
        </Chip>
        {categories.map((c) => (
          <Chip key={c.id} href={categoryHref(String(c.id))} active={activeCategory === String(c.id)}>
            {c.name}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "h-8 rounded-full border px-3 text-xs font-bold leading-8",
        active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
      )}
    >
      {children}
    </Link>
  );
}
