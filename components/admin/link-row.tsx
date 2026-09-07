"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/** Table row that navigates on click, while links/buttons inside keep working normally. */
export function LinkRow({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className={cn("cursor-pointer hover:bg-zinc-50", className)}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("a, button, input, select, textarea, label")) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
