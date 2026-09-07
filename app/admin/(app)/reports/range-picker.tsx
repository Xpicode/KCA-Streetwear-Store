import Link from "next/link";
import { PRESETS, type Range } from "@/lib/queries/reports";
import { cn } from "@/lib/utils";

/** Preset pills + from/to date inputs. Plain GET form, so it works without client JS. */
export function RangePicker({ range }: { range: Range }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex h-9 items-center gap-0.5 rounded-lg bg-zinc-200/70 p-0.5">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={`/admin/reports?preset=${p.key}`}
            className={cn(
              "h-8 rounded-md px-3 text-sm font-bold leading-8",
              range.preset === p.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form method="get" action="/admin/reports" className="flex items-center gap-2">
        <input
          type="date"
          name="from"
          defaultValue={range.fromKey}
          className="h-9 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-emerald-600"
          aria-label="From"
        />
        <span className="text-xs font-bold text-zinc-400">to</span>
        <input
          type="date"
          name="to"
          defaultValue={range.toKey}
          className="h-9 rounded-lg border border-zinc-300 bg-white px-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-emerald-600"
          aria-label="To"
        />
        <button type="submit" className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-bold hover:bg-zinc-50">
          Apply
        </button>
      </form>
    </div>
  );
}
