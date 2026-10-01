/* eslint-disable @next/next/no-img-element -- photos are plain uploads; placeholder art is local */
import { cn } from "@/lib/utils";
import { artFor } from "@/components/landing/site";

/** Product photo, or a grey tile with the category's placeholder art until a photo is uploaded. */
export function ProductImage({ name, imageUrl, categorySlug, className }: { name: string; imageUrl: string | null; categorySlug: string | null; className?: string }) {
  if (imageUrl) return <img src={imageUrl} alt={name} className={cn("h-full w-full object-cover", className)} />;
  return (
    <div className={cn("flex h-full w-full items-center justify-center bg-zinc-100", className)} aria-hidden>
      <img src={artFor(categorySlug)} alt="" className="size-2/5 opacity-60 grayscale" />
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
