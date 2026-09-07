"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { THEME_KEY } from "@/lib/theme";

/** The <html class="dark"> flag is the source of truth; watch it instead of mirroring it in state. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const readDark = () => document.documentElement.classList.contains("dark");
const readServer = () => null;

/** Sun/moon button that flips the `dark` class on <html> and remembers the choice. */
export function ThemeToggle({ className, labeled }: { className?: string; labeled?: boolean }) {
  // null during server render and hydration so both paints match
  const dark = useSyncExternalStore(subscribe, readDark, readServer);

  const toggle = () => {
    const next = !readDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {
      // private mode etc. — the toggle still works for this page
    }
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
      {dark === null ? <Sun className="size-4 opacity-0" /> : dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {labeled && <span>{dark === null ? "Theme" : dark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
