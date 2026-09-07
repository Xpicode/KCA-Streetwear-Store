"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutGrid, Tag, PackagePlus, ClipboardList, Users, BarChart3, Settings, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/auth";
import type { AdminUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { ThemeToggle } from "@/components/theme-toggle";

type Item = { href: string; label: string; icon: typeof LayoutGrid };

const NAV: Item[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/products", label: "Products", icon: Tag },
  { href: "/admin/stock-in", label: "Stock-in", icon: PackagePlus },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
];
const SETTINGS: Item = { href: "/admin/settings", label: "Settings", icon: Settings };

const isActive = (href: string, pathname: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

function NavLinks({ items, pathname }: { items: Item[]; pathname: string }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href, pathname) ? "page" : undefined}
          className={cn(
            "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100",
            isActive(href, pathname) && "bg-brand-50 text-brand-800"
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function UserRow({ user, showTheme = true }: { user: AdminUser; showTheme?: boolean }) {
  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-extrabold text-brand-800">{initials}</div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-sm font-bold">{user.name}</div>
        <div className="text-[11px] capitalize text-zinc-500">{user.role}</div>
      </div>
      {showTheme && <ThemeToggle />}
      <form action={logout}>
        <button
          type="submit"
          title="Sign out"
          aria-label="Sign out"
          className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

/** Desktop navigation (lg and up). */
export function Sidebar({ user }: { user: AdminUser }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-zinc-200 bg-white p-4 lg:flex">
      <div className="mb-6 px-2">
        <div className="font-extrabold">{BRAND.name}</div>
        <div className="text-xs text-zinc-500">Wholesale admin</div>
      </div>

      <NavLinks items={NAV} pathname={pathname} />

      <div className="mt-auto flex flex-col gap-1">
        {user.role === "owner" && <NavLinks items={[SETTINGS]} pathname={pathname} />}
        <div className="mt-2 border-t border-zinc-100 pt-3">
          <UserRow user={user} />
        </div>
      </div>
    </aside>
  );
}

/** Phone / tablet navigation: sticky top bar with a menu that closes itself on navigation. */
export function MobileTopBar({ user }: { user: AdminUser }) {
  const pathname = usePathname();
  // remember which page the menu was opened on; moving to another page closes it
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const items = user.role === "owner" ? [...NAV, SETTINGS] : NAV;

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white lg:hidden">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-extrabold">{BRAND.name}</div>
          <div className="text-[11px] text-zinc-500">Wholesale admin</div>
        </div>
        <ThemeToggle />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpenedOn(open ? null : pathname)}
          className="flex size-10 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div id="admin-mobile-menu" className="border-t border-zinc-200 bg-white px-3 pt-2 pb-4">
          <NavLinks items={items} pathname={pathname} />
          <div className="mt-3 border-t border-zinc-100 pt-3">
            <UserRow user={user} showTheme={false} />
          </div>
        </div>
      )}
    </header>
  );
}
