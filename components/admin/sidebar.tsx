"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Tag, PackagePlus, ClipboardList, Users, BarChart3, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/auth";
import type { AdminUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { ThemeToggle } from "@/components/theme-toggle";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/products", label: "Products", icon: Tag },
  { href: "/admin/stock-in", label: "Stock-in", icon: PackagePlus },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
];

export function Sidebar({ user }: { user: AdminUser }) {
  const pathname = usePathname();
  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-zinc-200 bg-white p-4">
      <div className="mb-6 px-2">
        <div className="font-extrabold">{BRAND.name}</div>
        <div className="text-xs text-zinc-500">Wholesale admin</div>
      </div>

      <nav className="flex flex-col gap-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100",
                active && "bg-emerald-50 text-emerald-800"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        {user.role === "owner" && (
          <Link
            href="/admin/settings"
            className={cn(
              "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-100",
              pathname.startsWith("/admin/settings") && "bg-emerald-50 text-emerald-800"
            )}
          >
            <Settings className="size-4" />
            Settings
          </Link>
        )}
        <div className="mt-2 flex items-center gap-3 border-t border-zinc-100 px-2 pt-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-xs font-extrabold text-emerald-800">{initials}</div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-bold">{user.name}</div>
            <div className="text-[11px] capitalize text-zinc-500">{user.role}</div>
          </div>
          <ThemeToggle />
          <form action={logout}>
            <button title="Sign out" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
