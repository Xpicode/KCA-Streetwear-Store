"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** − [ 12 ] + control. Buttons are 36px+ hit targets. */
export function QtyStepper({
  value,
  onChange,
  min = 1,
  max = 9999,
  disabled,
  size = "md",
  className,
  ariaLabel = "Quantity",
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));
  const btn = cn(
    "flex shrink-0 items-center justify-center text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent",
    size === "sm" ? "size-9" : "size-10"
  );
  return (
    <div
      className={cn(
        "inline-flex items-center overflow-hidden rounded-lg border border-zinc-300 bg-white",
        size === "sm" ? "h-9" : "h-10",
        disabled && "opacity-60",
        className
      )}
    >
      <button type="button" className={btn} onClick={() => onChange(clamp(value - 1))} disabled={disabled || value <= min} aria-label="Decrease">
        <Minus className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={ariaLabel}
        className="h-full w-12 min-w-0 flex-1 border-x border-zinc-200 bg-white text-center text-sm font-bold tabular-nums outline-none [appearance:textfield] focus:bg-brand-50/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.max(0, Math.min(max, Math.round(n))));
        }}
        onBlur={() => onChange(clamp(value))}
      />
      <button type="button" className={btn} onClick={() => onChange(clamp(value + 1))} disabled={disabled || value >= max} aria-label="Increase">
        <Plus className="size-4" />
      </button>
    </div>
  );
}
