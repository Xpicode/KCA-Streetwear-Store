"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  /** Unique id when two columns read the same field (e.g. profit + margin). Defaults to key. */
  id?: string;
  key: keyof T & string;
  label: string;
  align?: "left" | "right";
  /** Renders the cell; defaults to String(value). */
  render?: (row: T) => React.ReactNode;
  /** Sort by this value instead of the raw field. */
  sortValue?: (row: T) => number | string;
  href?: (row: T) => string;
  strong?: boolean;
};

/** Client-side sortable table for report sections. Click a header to sort; click again to flip. */
export function ReportTable<T extends { [k: string]: unknown }>({
  rows,
  columns,
  rowKey,
  defaultSort,
  defaultDir = "desc",
  empty = "Nothing in this range.",
  footer,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  /** Column id (or key) to sort by first. */
  defaultSort: string;
  defaultDir?: "asc" | "desc";
  empty?: string;
  footer?: React.ReactNode;
}) {
  const [sort, setSort] = useState<string>(defaultSort);
  const [dir, setDir] = useState<"asc" | "desc">(defaultDir);

  const sorted = useMemo(() => {
    const col = columns.find((c) => colId(c) === sort);
    const val = (r: T) => (col?.sortValue ? col.sortValue(r) : ((col ? r[col.key] : null) as number | string | null));
    return [...rows].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return dir === "asc" ? c : -c;
    });
  }, [rows, columns, sort, dir]);

  const toggle = (key: string) => {
    if (key === sort) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir("desc");
    }
  };

  return (
    <table className="w-full text-sm">
      <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
        <tr>
          {columns.map((c) => (
            <th key={colId(c)} className={cn("px-4 py-2.5 first:pl-5 last:pr-5", c.align === "right" && "text-right")}>
              <button
                type="button"
                onClick={() => toggle(colId(c))}
                className={cn(
                  "inline-flex h-6 items-center gap-1 uppercase tracking-wider hover:text-zinc-900",
                  sort === colId(c) && "text-zinc-900"
                )}
              >
                {c.label}
                {sort === colId(c) && (dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100 tabular-nums">
        {sorted.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="px-5 py-8 text-center font-medium text-zinc-500">
              {empty}
            </td>
          </tr>
        )}
        {sorted.map((r) => (
          <tr key={rowKey(r)} className="hover:bg-zinc-50">
            {columns.map((c) => {
              const content = c.render ? c.render(r) : String(r[c.key] ?? "—");
              return (
                <td
                  key={colId(c)}
                  className={cn("px-4 py-2.5 first:pl-5 last:pr-5", c.align === "right" && "text-right", c.strong && "font-bold")}
                >
                  {c.href ? (
                    <Link href={c.href(r)} className="font-bold hover:underline">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
      {footer && sorted.length > 0 && <tfoot className="border-t border-zinc-200 bg-zinc-50 font-bold tabular-nums">{footer}</tfoot>}
    </table>
  );
}

const colId = <T,>(c: Column<T>) => c.id ?? c.key;
