"use client";

import { useActionState, useEffect, useRef } from "react";
import { adjustStockForm } from "@/actions/stock";
import { ADJUST_REASONS, REASON_LABEL } from "@/components/admin/stock-reasons";
import { SubmitButton } from "@/components/ui/submit-button";

/** Inline "Adjust" row for one variant on the product page. */
export function AdjustForm({ variantId, onHand }: { variantId: number; onHand: number }) {
  const [state, action] = useActionState(adjustStockForm, null);
  const formRef = useRef<HTMLFormElement>(null);

  // clear qty + note after a successful save so the row is ready for the next entry
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-1">
      <input type="hidden" name="variantId" value={variantId} />
      <div className="flex items-center gap-1.5">
        <select
          name="direction"
          defaultValue="out"
          aria-label="Direction"
          className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm font-bold outline-none focus:border-brand-600"
        >
          <option value="out">−</option>
          <option value="in">+</option>
        </select>
        <input
          name="qty"
          type="number"
          min="1"
          max={99999}
          step="1"
          required
          placeholder="qty"
          aria-label="Quantity"
          className="h-9 w-16 rounded-lg border border-zinc-300 bg-white px-2 text-sm font-medium tabular-nums outline-none focus:border-brand-600"
        />
        <select
          name="reason"
          defaultValue="count"
          aria-label="Reason"
          className="h-9 rounded-lg border border-zinc-300 bg-white px-2 text-sm font-medium outline-none focus:border-brand-600"
        >
          {ADJUST_REASONS.map((r) => (
            <option key={r} value={r}>
              {REASON_LABEL[r]}
            </option>
          ))}
        </select>
        <input
          name="note"
          placeholder="note"
          aria-label="Note"
          maxLength={300}
          className="h-9 w-28 rounded-lg border border-zinc-300 bg-white px-2 text-sm font-medium outline-none placeholder:text-zinc-400 focus:border-brand-600"
        />
        <SubmitButton variant="outline" className="h-9 px-3" pendingText="…">
          Adjust
        </SubmitButton>
      </div>
      {state?.error ? (
        <p className="text-xs font-semibold text-red-600">{state.error}</p>
      ) : state?.ok ? (
        <p className="text-xs font-semibold text-brand-700">Adjusted · now {onHand} on hand</p>
      ) : null}
    </form>
  );
}
