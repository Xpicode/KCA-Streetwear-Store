import { redirect } from "next/navigation";
import { getAdminUser } from "@/lib/auth";
import { AdminLoginForm } from "./login-form";
import { BRAND } from "@/lib/brand";

export default async function Page() {
  if (await getAdminUser()) redirect("/admin");
  return (
    <div className="theme-zone flex min-h-screen items-center justify-center bg-zinc-50 p-6 text-zinc-900">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8">
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-wider text-brand-700">{BRAND.name}</div>
          <h1 className="text-2xl font-extrabold tracking-tight">Admin sign in</h1>
          <p className="text-sm font-medium text-zinc-500">Owner and staff accounts</p>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  );
}
