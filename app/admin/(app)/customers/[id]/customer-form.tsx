"use client";

import { useActionState } from "react";
import { updateCustomer } from "@/actions/customers";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

type Customer = {
  id: number;
  shopName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  priceGroup: string;
  status: "pending" | "approved" | "blocked";
};

export function CustomerForm({ customer, priceGroups }: { customer: Customer; priceGroups: string[] }) {
  const [state, action] = useActionState(updateCustomer, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={customer.id} />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Shop / business name">
          <Input name="shopName" defaultValue={customer.shopName} required />
        </Field>
        <Field label="Contact person">
          <Input name="contactName" defaultValue={customer.contactName ?? ""} />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={customer.phone ?? ""} />
        </Field>
        <Field label="Email" hint="Used to sign in to the storefront">
          <Input name="email" type="email" defaultValue={customer.email ?? ""} />
        </Field>
        <Field label="Price group" hint="Matches price_group on price tiers; leave as standard unless you set up special tiers">
          <Input name="priceGroup" list="price-groups" defaultValue={customer.priceGroup} required pattern="[a-z0-9-]{1,30}" />
          <datalist id="price-groups">
            {priceGroups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={customer.status}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="blocked">Blocked</option>
          </Select>
        </Field>
      </div>
      <Field label="Delivery address">
        <Textarea name="address" defaultValue={customer.address ?? ""} className="min-h-16" />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
