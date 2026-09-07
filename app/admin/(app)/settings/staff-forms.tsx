"use client";

import { useActionState, useState, useTransition } from "react";
import { KeyRound, Plus, Trash2, X } from "lucide-react";
import { addStaffUser, deleteStaffUser, setStaffPassword } from "@/actions/settings";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function StaffRowActions({ id, name, isMe }: { id: number; name: string; isMe: boolean }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [pwState, pwAction] = useActionState(setStaffPassword, null);

  const remove = () => {
    if (!confirm(`Delete the login for ${name}? This cannot be undone.`)) return;
    setError(null);
    start(async () => {
      const r = await deleteStaffUser(id);
      if (r?.error) setError(r.error);
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-bold hover:bg-zinc-50"
        >
          <KeyRound className="size-3.5" />
          Set password
        </button>
        <button
          type="button"
          title={isMe ? "You cannot delete your own login" : "Delete login"}
          disabled={busy || isMe}
          onClick={remove}
          className="flex size-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {error && <p className="max-w-md text-right text-xs font-semibold text-red-600">{error}</p>}
      {showPw && (
        <form action={pwAction} className="flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <Input name="password" type="text" placeholder="New password (6+ chars)" minLength={6} required className="h-9 w-full sm:w-56" autoFocus />
          <SubmitButton variant="outline" pendingText="Saving…" className="h-9 px-3">
            Save
          </SubmitButton>
          <button type="button" onClick={() => setShowPw(false)} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100" title="Close">
            <X className="size-4" />
          </button>
          {pwState?.error && <span className="text-xs font-semibold text-red-600">{pwState.error}</span>}
          {pwState?.ok && <span className="text-xs font-semibold text-emerald-700">Saved.</span>}
        </form>
      )}
    </div>
  );
}

export function AddStaffForm() {
  const [state, action] = useActionState(addStaffUser, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_140px_1fr] gap-3">
        <Field label="Name">
          <Input name="name" required placeholder="e.g. Ana" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required placeholder="ana@example.com" />
        </Field>
        <Field label="Role">
          <Select name="role" defaultValue="staff">
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </Select>
        </Field>
        <Field label="Password" hint="Share it with them; they can’t change it themselves yet">
          <Input name="password" type="text" minLength={6} required placeholder="6+ characters" />
        </Field>
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingText="Adding…">
          <Plus className="size-4" />
          Add user
        </SubmitButton>
      </div>
    </form>
  );
}
