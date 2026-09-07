import { cn } from "@/lib/utils";

/** Soft colour per category so the grid still reads well before photos are uploaded. */
const PALETTE: Record<string, string> = {
  tees: "bg-sky-100 text-sky-700",
  caps: "bg-amber-100 text-amber-700",
  outerwear: "bg-indigo-100 text-indigo-700",
  bottoms: "bg-teal-100 text-teal-700",
  accessories: "bg-rose-100 text-rose-700",
};
const FALLBACK = ["bg-zinc-100 text-zinc-600", "bg-lime-100 text-lime-700", "bg-violet-100 text-violet-700", "bg-orange-100 text-orange-700"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function ProductImage({
  name,
  imageUrl,
  categorySlug,
  className,
  textClass = "text-3xl",
}: {
  name: string;
  imageUrl: string | null;
  categorySlug: string | null;
  className?: string;
  textClass?: string;
}) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={name} className={cn("h-full w-full object-cover", className)} />;
  }
  const tone = (categorySlug && PALETTE[categorySlug]) ?? FALLBACK[name.length % FALLBACK.length];
  return (
    <div className={cn("flex h-full w-full items-center justify-center font-extrabold tracking-tight select-none", tone, textClass, className)} aria-hidden>
      {initials(name)}
    </div>
  );
}

export function StockBadge({ available, moq, className }: { available: number; moq: number; className?: string }) {
  const out = available <= 0;
  const low = !out && available < moq * 2;
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold shadow-sm",
        out ? "bg-zinc-900 text-white" : low ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200" : "bg-white/95 text-zinc-700 ring-1 ring-zinc-200",
        className
      )}
    >
      {out ? "Out of stock" : low ? `Low · ${available} pcs` : `${available} pcs`}
    </span>
  );
}
