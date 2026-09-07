"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { resetCustomerPassword } from "@/actions/customers";
import { SubmitButton } from "@/components/ui/submit-button";

/** Owner only: generates a new storefront password and shows it once. */
export function ResetPassword({ customerId, email }: { customerId: number; email: string | null }) {
  const [state, action] = useActionState(resetCustomerPassword, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Reset this customer's storefront password? Their current password will stop working.")) e.preventDefault();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={customerId} />
      <p className="text-sm text-zinc-600">
        {email
          ? `Generates a new password for ${email}. It is shown once, here — send it to the customer yourself.`
          : "This customer has no email, so they cannot sign in to the storefront. Add an email above first."}
      </p>
      {state?.password && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">New password (shown once)</div>
          <code className="mt-1 block select-all text-lg font-extrabold tracking-wide text-emerald-900">{state.password}</code>
        </div>
      )}
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{state.error}</p>}
      <div>
        <SubmitButton variant="outline" pendingText="Resetting…" disabled={!email} className="h-9">
          <KeyRound className="size-4" />
          Reset password
        </SubmitButton>
      </div>
    </form>
  );
}
