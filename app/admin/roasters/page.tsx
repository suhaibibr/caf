import type { Metadata } from "next";
import { AdminShell } from "@/components/AdminShell";
import { AdminRoastersStudio } from "@/components/AdminRoastersStudio";
import { listRoasters } from "@/lib/roasters-db";
import { requireAdminPageAccess } from "@/lib/auth/session";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";

export const metadata: Metadata = {
  title: "المحامص | لوحة الإدارة",
  description: "إدارة المحامص داخل كــاف.",
};

export const dynamic = "force-dynamic";

export default async function AdminRoastersPage() {
  await requireAdminPageAccess("/admin/roasters", RBAC_PERMISSIONS.ADMIN_ROASTERS_MANAGE);

  const roasters = await listRoasters();

  return (
    <AdminShell activePath="/admin/roasters">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-black/42 dark:text-[#EAEAEA]/42">
              المحامص
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              إدارة المحامص
            </h1>
          </div>
        </section>

        <AdminRoastersStudio initialRoasters={roasters} />
      </div>
    </AdminShell>
  );
}
