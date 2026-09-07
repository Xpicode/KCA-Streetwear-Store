"use client";

import { useActionState } from "react";
import { updateOrderNote } from "@/actions/orders";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function NoteForm({ orderId, note }: { orderId: number; note: string | null }) {
  const [state, action] = useActionState(updateOrderNote, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <Textarea
        name="note"
        defaultValue={note ?? ""}
        placeholder="Internal note — delivery instructions, who to call, agreed terms. Customers do not see this."
        className="min-h-24"
      />
      <div className="flex items-center gap-3">
        <SubmitButton variant="outline" pendingText="Saving…" className="h-9">
          Save note
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
