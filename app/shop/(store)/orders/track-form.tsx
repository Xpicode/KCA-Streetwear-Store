"use client";

import { useActionState } from "react";
import { trackOrder } from "@/actions/shop-orders";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function TrackOrderForm() {
  const [state, action] = useActionState(trackOrder, null);
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5">
      <Field label="Order number" hint="From your confirmation, e.g. #1043">
        <Input name="orderNo" placeholder="#1043" required autoFocus />
      </Field>
      <Field label="Contact number used on the order">
        <Input name="phone" type="tel" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton pendingText="Looking up…">Find order</SubmitButton>
    </form>
  );
}
