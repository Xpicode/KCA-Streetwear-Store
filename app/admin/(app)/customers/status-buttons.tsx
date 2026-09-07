"use client";

import { useState, useTransition } from "react";
import { approveCustomer, blockCustomer } from "@/actions/customers";
import { cn } from "@/lib/utils";

/** Approve / Block for one customer. Shows the action's error inline. */
export function StatusButtons({ id, status, size = "sm" }: { id: number; status: string; size?: "sm" | "md" }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: (id: number) => Promise<{ error?: string } | null>) => {
    setError(null);
    start(async () => {
      const r = await fn(id);
      if (r?.error) setError(r.error);
    });
  };
  const h = size === "sm" ? "h-9 px-3 text-xs" : "h-10 px-4 text-sm";
  return (
    <div className="flex items-center justify-end gap-1.5">
      {status !== "approved" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(approveCustomer)}
          className={cn("rounded-lg bg-brand-700 font-bold text-white hover:bg-brand-800 disabled:opacity-60", h)}
        >
          {status === "blocked" ? "Unblock" : "Approve"}
        </button>
      )}
      {status !== "blocked" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => run(blockCustomer)}
          className={cn("rounded-lg border border-red-200 bg-white font-bold text-red-700 hover:bg-red-50 disabled:opacity-60", h)}
        >
          Block
        </button>
      )}
      {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
    </div>
  );
}
