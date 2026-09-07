import { BRAND } from "@/lib/brand";
import { requireAdmin } from "@/lib/auth";
import { getCategoriesWithCounts, getStaffUsers } from "@/lib/queries/settings";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, Empty } from "@/components/ui/card";
import { fmtDate } from "@/components/admin/order-bits";
import { AddCategoryForm, CategoryRow } from "./category-forms";
import { AddStaffForm, StaffRowActions } from "./staff-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const me = await requireAdmin({ owner: true });
  const [cats, staff] = await Promise.all([getCategoriesWithCounts(), getStaffUsers()]);
  const nextSort = cats.reduce((m, c) => Math.max(m, c.sortOrder), 0) + 1;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm font-medium text-zinc-500">Owner only · categories, staff logins, store details</p>
      </div>

      <Card>
        <CardHeader
          title="Categories"
          action={<span className="text-xs font-semibold text-zinc-500">Lower sort order shows first in the storefront and product filters</span>}
        />
        {cats.length === 0 ? (
          <Empty>No categories yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              <tr>
                <th colSpan={5} className="px-5 py-2.5">
                  <div className="grid grid-cols-[80px_1fr_180px_110px_70px_36px] gap-3">
                    <span>Order</span>
                    <span>Name</span>
                    <span>Slug</span>
                    <span className="text-right">Products</span>
                    <span />
                    <span />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {cats.map((c) => (
                <CategoryRow key={c.id} category={c} />
              ))}
            </tbody>
          </table>
        )}
        <CardBody className="border-t border-zinc-100 pt-4">
          <AddCategoryForm nextSort={nextSort} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Staff users"
          action={<span className="text-xs font-semibold text-zinc-500">Only owners can open Settings and reset customer passwords; staff run orders and stock</span>}
        />
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-5 py-2.5">Name</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5 text-right">Orders handled</th>
              <th className="px-4 py-2.5">Added</th>
              <th className="px-5 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 tabular-nums">
            {staff.map((u) => (
              <tr key={u.id} className="align-top">
                <td className="px-5 py-3 font-bold">
                  {u.name}
                  {u.id === me.id && <span className="ml-2 text-xs font-semibold text-zinc-500">(you)</span>}
                </td>
                <td className="px-4 py-3 text-zinc-700">{u.email}</td>
                <td className="px-4 py-3">
                  <Badge tone={u.role === "owner" ? "solid" : "neutral"}>{u.role === "owner" ? "Owner" : "Staff"}</Badge>
                </td>
                <td className="px-4 py-3 text-right text-zinc-700">
                  {u.ordersHandled}
                  {u.movements > 0 && <span className="text-xs text-zinc-500"> · {u.movements} stock moves</span>}
                </td>
                <td className="px-4 py-3 text-zinc-600">{fmtDate(u.createdAt)}</td>
                <td className="px-5 py-2.5">
                  <StaffRowActions id={u.id} name={u.name} isMe={u.id === me.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <CardBody className="border-t border-zinc-100 pt-4">
          <AddStaffForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Store details" />
        <CardBody className="flex flex-col gap-2 text-sm text-zinc-700">
          <p>
            The store shows as <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-bold">{BRAND.name}</code> across the landing page,
            storefront and admin. Name, contact number, email and city all live in one file:
          </p>
          <ul className="list-disc pl-5 text-zinc-600">
            <li>
              <code>lib/brand.ts</code> — brand name, phone, email, city (phone/email/city are still placeholders)
            </li>
            <li>
              <code>app/layout.tsx</code> — browser tab title
            </li>
            <li>
              <code>public/landing/</code> — landing page artwork; swap for real product photos when ready
            </li>
          </ul>
          <p className="text-zinc-500">Placeholder phone numbers in seed data look like <code>[0917 000 0001]</code>; edit them under Customers.</p>
        </CardBody>
      </Card>
    </div>
  );
}
