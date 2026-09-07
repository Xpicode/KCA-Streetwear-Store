"use client";

import { useActionState } from "react";
import { placeOrder } from "@/actions/shop-orders";
import { PAYMENT_OPTIONS } from "@/components/shop/payment-options";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import type { Shopper } from "@/lib/shopper";

export function CheckoutForm({ shopper }: { shopper: Shopper | null }) {
  const c = shopper;
  const [state, action] = useActionState(placeOrder, null);
  return (
    <form action={action} className="flex flex-col gap-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-[15px] font-extrabold">Deliver to</h2>
        <p className="mb-4 text-xs font-medium text-zinc-500">{c ? "Prefilled from your last order — edit anything that changed." : "We use your number to match future orders to your shop."}</p>
        <div className="flex flex-col gap-4">
          <Field label="Shop / business name">
            <Input name="shopName" defaultValue={c?.shopName ?? ""} required autoFocus={!c} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact person">
              <Input name="contactName" defaultValue={c?.contactName ?? ""} required />
            </Field>
            <Field label="Contact number">
              <Input name="phone" type="tel" defaultValue={c?.phone ?? ""} required />
            </Field>
          </div>
          <Field label="Delivery address">
            <Textarea name="address" defaultValue={c?.address ?? ""} required />
          </Field>
          <Field label="Email (optional)" hint="Only if you want order updates by email too.">
            <Input name="email" type="email" defaultValue={c?.email ?? ""} />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-[15px] font-extrabold">Preferred payment</h2>
        <p className="mb-4 text-xs font-medium text-zinc-500">Nothing is charged now. After we confirm, you pay by e-wallet or bank transfer and your order ships.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAYMENT_OPTIONS.map((opt, i) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 hover:border-zinc-400 has-checked:border-brand-600 has-checked:bg-brand-50/60"
            >
              <input type="radio" name="payment" value={opt.value} defaultChecked={i === 0} className="mt-0.5 size-4 accent-brand-700" required />
              <span>
                <span className="block text-sm font-bold">{opt.label}</span>
                <span className="block text-xs font-medium text-zinc-500">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <Field label="Note for us (optional)" hint="Preferred delivery day, substitutions you'd accept, anything we should know.">
          <Textarea name="note" placeholder="e.g. Deliver Tuesday morning; OK to swap Navy for Black if short." />
        </Field>
      </section>

      <FormMessage state={state} />
      <SubmitButton pendingText="Sending request…" className="h-12 text-base">
        Send order request
      </SubmitButton>
      <p className="-mt-3 text-center text-xs font-medium text-zinc-500">
        We&apos;ll check stock and message you the confirmed total and delivery fee.
      </p>
    </form>
  );
}
