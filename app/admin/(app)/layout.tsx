import { requireAdmin } from "@/lib/auth";
import { Sidebar } from "@/components/admin/sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <div className="theme-zone flex min-h-screen bg-zinc-50">
      <Sidebar user={user} />
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
