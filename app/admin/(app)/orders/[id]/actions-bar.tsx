"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Ban, Check, PackageCheck, Truck, Wallet, X } from "lucide-react";
import { cancelOrder, confirmOrder, deliverOrder, packOrder, recordPayment } from "@/actions/orders";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage, type ActionState } from "@/components/ui/form-message";
import { cn } from "@/lib/utils";

type Props = {
  orderId: number;
  status: string;
  paymentStatus: string;
  balance: number;
};

const NEXT: Record<string, { label: string; pending: string; icon: typeof Check; run: (id: number) => Promise<ActionState> }> = {
  pending: { label: "Confirm order", pending: "Reserving stock…", icon: Check, run: confirmOrder },
  confirmed: { label: "Mark packed", pending: "Deducting stock…", icon: PackageCheck, run: packOrder },
  // packed has NO next step until payment is in — delivery only happens on a fully paid order
  paid: { label: "Mark delivered", pending: "Saving…", icon: Truck, run: deliverOrder },
};

export function ActionsBar({ orderId, status, paymentStatus, balance }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [showPayment, setShowPayment] = useState(false);

  const next = NEXT[status];
  const canCancel = status === "pending" || status === "confirmed";
  const canPay = status !== "cancelled" && status !== "delivered" && paymentStatus !== "paid" && balance > 0;
  const awaitingPayment = status === "packed" && balance > 0;

  const runStep = (fn: (id: number) => Promise<ActionState>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn(orderId);
      if (res?.error) setError(res.error);
    });
  };

  const onCancel = () => {
    if (!confirm("Cancel this order? Reserved stock will be released.")) return;
    runStep(cancelOrder);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {awaitingPayment && (
          <span className="flex h-10 items-center gap-2 rounded-lg bg-amber-50 px-4 text-sm font-bold text-amber-800">
            <Truck className="size-4" />
            Delivery unlocks after full payment
          </span>
        )}
        {next && (
          <button
            type="button"
            disabled={busy}
            onClick={() => runStep(next.run)}
            className="flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            <next.icon className="size-4" />
            {busy ? next.pending : next.label}
          </button>
        )}
        {canPay && (
          <button
            type="button"
            onClick={() => setShowPayment((v) => !v)}
            className={cn(
              "flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-bold",
              showPayment
                ? "border-zinc-900 bg-zinc-900 text-white"
                : awaitingPayment
                  ? "border-transparent bg-emerald-700 text-white hover:bg-emerald-800"
                  : "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
            )}
          >
            <Wallet className="size-4" />
            Record payment
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="ml-auto flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            <Ban className="size-4" />
            Cancel order
          </button>
        )}
        {!next && !canPay && !canCancel && (
          <p className="text-sm font-medium text-zinc-500">
            {status === "cancelled" ? "This order was cancelled." : "This order is complete."}
          </p>
        )}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}

      {showPayment && canPay && <PaymentForm orderId={orderId} balance={balance} onDone={() => setShowPayment(false)} />}
    </div>
  );
}

function PaymentForm({ orderId, balance, onDone }: { orderId: number; balance: number; onDone: () => void }) {
  const [state, action] = useActionState(recordPayment, null);
  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <form action={action} className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold">Record a payment</h3>
        <button type="button" onClick={onDone} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700" title="Close">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Amount (₱)" hint={`Balance due ₱${balance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}>
          <Input name="amount" type="number" step="0.01" min="0.01" max={balance} defaultValue={balance.toFixed(2)} required autoFocus />
        </Field>
        <Field label="Method">
          <Select name="method" defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="bank">Bank transfer</option>
            <option value="ewallet">E-wallet (GCash / Maya)</option>
          </Select>
        </Field>
        <Field label="Reference" hint="Receipt or transfer no.">
          <Input name="reference" placeholder="Optional" />
        </Field>
        <Field label="Date">
          <Input name="paidAt" type="date" defaultValue={todayKey} max={todayKey} />
        </Field>
      </div>
      <FormMessage state={state?.ok ? null : state} />
      <div className="flex gap-2">
        <SubmitButton pendingText="Recording…">Save payment</SubmitButton>
        <button type="button" onClick={onDone} className="h-10 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-bold">
          Cancel
        </button>
      </div>
    </form>
  );
}
