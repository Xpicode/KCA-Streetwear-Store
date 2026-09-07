"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { addCategory, deleteCategory, updateCategory } from "@/actions/settings";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

type Category = { id: number; name: string; slug: string; sortOrder: number; products: number };

export function CategoryRow({ category }: { category: Category }) {
  const [state, action] = useActionState(updateCategory, null);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    if (!confirm(`Delete category "${category.name}"?`)) return;
    setError(null);
    start(async () => {
      const r = await deleteCategory(category.id);
      if (r?.error) setError(r.error);
    });
  };

  return (
    <tr className="align-top">
      <td colSpan={5} className="px-5 py-2">
        <form action={action} className="grid grid-cols-[80px_1fr_180px_110px_70px_36px] items-center gap-3">
          <input type="hidden" name="id" value={category.id} />
          <Input name="sortOrder" type="number" min={0} defaultValue={category.sortOrder} className="h-9" aria-label="Sort order" />
          <Input name="name" defaultValue={category.name} required className="h-9" aria-label="Category name" />
          <span className="truncate text-xs font-medium text-zinc-500">/{category.slug}</span>
          <span className="text-right text-sm tabular-nums text-zinc-600">{category.products} {category.products === 1 ? "product" : "products"}</span>
          <SubmitButton variant="outline" pendingText="Saving…" className="h-9 px-3">
            Save
          </SubmitButton>
          <button
            type="button"
            title={category.products ? "Move its products first" : "Delete category"}
            disabled={busy || category.products > 0}
            onClick={remove}
            className="flex size-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
          >
            <Trash2 className="size-4" />
          </button>
          {(state?.error || error) && <p className="col-span-6 text-xs font-semibold text-red-600">{state?.error ?? error}</p>}
          {state?.ok && !error && <p className="col-span-6 text-xs font-semibold text-emerald-700">Saved.</p>}
        </form>
      </td>
    </tr>
  );
}

export function AddCategoryForm({ nextSort }: { nextSort: number }) {
  const [state, action] = useActionState(addCategory, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="grid grid-cols-1 sm:grid-cols-[80px_1fr_auto] items-center gap-3">
        <Input name="sortOrder" type="number" min={0} defaultValue={nextSort} className="h-9" aria-label="Sort order" />
        <Input name="name" placeholder="New category name" required className="h-9" />
        <SubmitButton pendingText="Adding…" className="h-9">
          <Plus className="size-4" />
          Add category
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
