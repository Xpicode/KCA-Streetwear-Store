"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteOrder } from "@/actions/orders";

/** Owner-only. Permanent, so it asks first; only Paid/Cancelled orders ever render it. */
export function DeleteOrderButton({
  orderId,
  orderNo,
  status,
  redirectTo,
  labeled,
}: {
  orderId: number;
  orderNo: string;
  status: string;
  /** After a successful delete, go here instead of refreshing (used on the detail page). */
  redirectTo?: string;
  /** Render as a full button with text instead of the small icon. */
  labeled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    const ok = window.confirm(
      `Delete order ${orderNo} permanently?\n\nThis removes the order and its ${status === "delivered" ? "profit from reports" : "record"}. It cannot be undone.`
    );
    if (!ok) return;
    start(async () => {
      const res = await deleteOrder(orderId);
      if (res?.error) setError(res.error);
      else if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  };

  if (labeled) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={onClick}
          disabled={pending}
          className="flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="size-4" />
          {pending ? "Deleting…" : "Delete order"}
        </button>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      </div>
    );
  }
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <button
        onClick={onClick}
        disabled={pending}
        title={error ?? `Delete ${orderNo}`}
        className="flex size-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      >
        <Trash2 className="size-4" />
        <span className="sr-only">Delete {orderNo}</span>
      </button>
    </span>
  );
}
