import { cn } from "@/lib/utils";

/** Standard shape every server action returns for useActionState. */
export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> } | null;

export function FormMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.error) return <p className={cn("rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700")}>{state.error}</p>;
  if (state.ok) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">Saved.</p>;
  return null;
}
