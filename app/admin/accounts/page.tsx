import type { Metadata } from "next";
import { AdminShell } from "@/components/AdminShell";
import { AdminAccountsStudio } from "@/components/AdminAccountsStudio";
import { requireAdminPageAccess } from "@/lib/auth/session";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";
import { listAdminUsers } from "@/lib/auth-db";

export const metadata: Metadata = {
  title: "الحسابات الإدارية | لوحة الإدارة",
  description: "إدارة حسابات الإدارة بصلاحية عليا.",
};

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  const auth = await requireAdminPageAccess(
    "/admin/accounts",
    RBAC_PERMISSIONS.ADMIN_ACCOUNTS_MANAGE,
    { requireSuperAdmin: true },
  );
  const admins = await listAdminUsers();

  return (
    <AdminShell activePath="/admin/accounts">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-black/42 dark:text-[#EAEAEA]/42">
              الحسابات الإدارية
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              إدارة حسابات الإدارة
            </h1>
          </div>
        </section>

        <AdminAccountsStudio initialAdmins={admins} currentAdminId={auth.user.id} />
      </div>
    </AdminShell>
  );
}

