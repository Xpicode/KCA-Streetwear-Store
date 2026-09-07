"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_KEY } from "@/lib/theme";

/** Sun/moon button that flips the `dark` class on <html> and remembers the choice. */
export function ThemeToggle({ className, labeled }: { className?: string; labeled?: boolean }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      // private mode etc. — the toggle still works for this page
    }
    setDark(next);
  };

  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center gap-2 rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800",
        labeled ? "h-10 px-3 text-sm font-semibold text-zinc-600" : "p-1.5",
        className
      )}
    >
      {/* render both until mounted so server + first client paint match */}
      {dark === null ? <Sun className="size-4 opacity-0" /> : dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {labeled && <span>{dark === null ? "Theme" : dark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
