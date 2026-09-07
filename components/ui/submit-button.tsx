"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/** Submit button that shows a pending state while the server action runs. */
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string; variant?: "primary" | "outline" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || props.disabled}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold disabled:opacity-60",
        variant === "primary" && "bg-emerald-700 text-white hover:bg-emerald-800",
        variant === "outline" && "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
        variant === "danger" && "border border-red-200 bg-white text-red-700 hover:bg-red-50",
        className
      )}
      {...props}
    >
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}
