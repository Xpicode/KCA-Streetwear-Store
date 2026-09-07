"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, History, ListTodo } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { OrderCounts, OrderSort, OrderTab, OrderView } from "@/lib/queries/orders";

const TAB_LABELS: Record<OrderTab, string> = {
  all: "All",
  pending: "Pending",
  confirmed: "To pack",
  packed: "Awaiting payment",
  paid: "To deliver",
  unpaid: "Unpaid",
  delivered: "Completed",
  cancelled: "Cancelled",
};

const SORT_LABELS: Record<OrderSort, string> = {
  status: "By status (queue order)",
  newest: "Newest first",
  oldest: "Oldest first",
  total: "Highest total",
};

export function OrderFilters({
  view,
  active,
  sort,
  counts,
  tabs,
}: {
  view: OrderView;
  active: OrderTab;
  sort: OrderSort;
  counts: OrderCounts;
  tabs: OrderTab[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      if (next.toString() !== params.toString()) router.replace(`${pathname}?${next.toString()}`);
    }, 250);
    return () => clearTimeout(t);
  }, [q, params, pathname, router]);

  const href = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const s = next.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  const setSort = (value: string) => router.replace(href({ sort: value || null }) as string);

  return (
    <div className="flex flex-col gap-3">
      {/* view switch + search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex h-10 items-center gap-0.5 rounded-lg bg-zinc-200/70 p-0.5">
          <ViewTab
            href={href({ view: null, status: null, sort: null })}
            active={view === "active"}
            icon={<ListTodo className="size-4" />}
            label="Active"
            count={counts.activeTotal}
          />
          <ViewTab
            href={href({ view: "history", status: null, sort: null })}
            active={view === "history"}
            icon={<History className="size-4" />}
            label="History"
            count={counts.historyTotal}
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort orders"
            className="h-9 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm font-semibold text-zinc-700 outline-none focus:border-emerald-600"
          >
            {(view === "active" ? (["status", "newest", "oldest", "total"] as const) : (["newest", "oldest", "total"] as const)).map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
          <label className="flex h-9 w-64 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3">
            <Search className="size-4 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Order no or customer"
              className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-zinc-400"
            />
          </label>
        </div>
      </div>

      {/* status chips for the current view */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <Link
            key={t}
            href={href({ status: t === "all" ? null : t })}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold",
              active === t ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
            )}
          >
            {TAB_LABELS[t]}
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px] tabular-nums",
                active === t ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-500"
              )}
            >
              {counts.byTab[t]}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ViewTab({ href, active, icon, label, count }: { href: string; active: boolean; icon: React.ReactNode; label: string; count: number }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-bold",
        active ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
      )}
    >
      {icon}
      {label}
      <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500")}>
        {count}
      </span>
    </Link>
  );
}
