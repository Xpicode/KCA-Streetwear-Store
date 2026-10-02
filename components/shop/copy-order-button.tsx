"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/** Copies the order details so the buyer can paste them into a chat (Messenger, Viber…). */
export function CopyOrderButton({ text, variant = "outline", className }: { text: string; variant?: "primary" | "outline"; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no clipboard API outside https: copy from a selected textarea instead
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold",
        variant === "primary" ? "bg-brand-700 text-white hover:bg-brand-800" : "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50",
        className
      )}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      <span aria-live="polite">{copied ? "Copied" : "Copy order details"}</span>
    </button>
  );
}
