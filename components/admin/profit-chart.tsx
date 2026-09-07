import type { Bucket } from "@/lib/queries/dashboard";
import { peso } from "@/lib/format";

/**
 * Stacked bar chart: profit (dark) sits on cost (light) so the full bar is revenue.
 * Server-rendered, no chart library needed. Swap for Recharts later if you want tooltips.
 */
export function ProfitChart({ data }: { data: Bucket[] }) {
  const max = Math.max(1, ...data.map((b) => b.profit + b.cost));
  const H = 180;
  const dense = data.length > 14;
  const total = data.reduce((a, b) => a + b.profit, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-4 text-xs font-semibold text-zinc-500">
        <Legend color="bg-emerald-700" label="Profit" />
        <Legend color="bg-emerald-200" label="Cost" />
      </div>

      {total === 0 ? (
        <p className="py-16 text-center text-sm font-medium text-zinc-500">
          No delivered orders in this period yet.
        </p>
      ) : (
        <>
          <div
            className="flex items-end border-b border-zinc-200"
            style={{ height: H, gap: dense ? 3 : 10 }}
          >
            {data.map((b, i) => {
              const ph = Math.round((b.profit / max) * (H - 12));
              const ch = Math.round((b.cost / max) * (H - 12));
              return (
                <div
                  key={i}
                  className="group relative flex flex-1 flex-col justify-end"
                  title={`${b.label}: ${peso(b.profit)} profit · ${peso(b.cost)} cost`}
                >
                  <div className="rounded-t-sm bg-emerald-200" style={{ height: ch }} />
                  <div className="bg-emerald-700" style={{ height: ph }} />
                </div>
              );
            })}
          </div>
          <div className="flex" style={{ gap: dense ? 3 : 10 }}>
            {data.map((b, i) => (
              <div key={i} className="flex-1 text-center text-[11px] font-semibold tabular-nums text-zinc-500">
                {dense ? (i === 0 || (i + 1) % 5 === 0 ? b.label : "") : b.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
