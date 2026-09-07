import { requireAdmin } from "@/lib/auth";
import { MobileTopBar, Sidebar } from "@/components/admin/sidebar";

/**
 * Admin shell. proxy.ts already turned away requests without a valid session; this
 * check (and the one in every page) verifies the user against the database.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="theme-zone flex min-h-screen flex-col bg-zinc-50 lg:flex-row">
      <Sidebar user={user} />
      <MobileTopBar user={user} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
