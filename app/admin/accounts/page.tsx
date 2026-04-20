import type { Metadata } from "next";
import { AdminShell } from "@/components/AdminShell";
import { AdminAccountsStudio } from "@/components/AdminAccountsStudio";
import { requireAdminPageAccess } from "@/lib/auth/session";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";
import { listAdminUsers } from "@/lib/auth-db";
import { getDatabaseUsageSnapshot } from "@/lib/database-usage";

export const metadata: Metadata = {
  title: "الإدارة | لوحة الإدارة",
  description: "إدارة حسابات الإدارة واستخدام قاعدة البيانات.",
};

export const dynamic = "force-dynamic";

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 MB";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const fractionDigits = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  }).format(size)} ${units[unitIndex]}`;
}

export default async function AdminAccountsPage() {
  const auth = await requireAdminPageAccess(
    "/admin/accounts",
    RBAC_PERMISSIONS.ADMIN_ACCOUNTS_MANAGE,
    { requireSuperAdmin: true },
  );
  const [admins, dbUsage] = await Promise.all([
    listAdminUsers(),
    getDatabaseUsageSnapshot(6).catch(() => null),
  ]);

  return (
    <AdminShell activePath="/admin/accounts">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-black/42 dark:text-[#EAEAEA]/42">
              الإدارة
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              إدارة الحسابات
            </h1>
          </div>
        </section>

        {dbUsage ? (
          <section className="mt-6 rounded-[24px] border border-black/8 bg-white/76 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-white/[0.045]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold text-black/42 dark:text-[#EAEAEA]/42">
                  صلاحية عليا
                </p>
                <h2 className="mt-1 text-2xl font-bold">استخدام قاعدة البيانات</h2>
              </div>
              <p className="text-xs text-black/38 dark:text-[#EAEAEA]/38">
                {dbUsage.database} · {new Date(dbUsage.sampledAt).toLocaleString("ar-EG")}
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[18px] border border-black/8 bg-[#F8F8F5] p-4 dark:border-white/10 dark:bg-[#101623]">
                <p className="text-xs font-bold text-black/42 dark:text-[#EAEAEA]/42">
                  الحجم الكلي
                </p>
                <p className="mt-2 text-2xl font-bold">{formatBytes(dbUsage.totalBytes)}</p>
              </div>
              <div className="rounded-[18px] border border-black/8 bg-[#F8F8F5] p-4 dark:border-white/10 dark:bg-[#101623]">
                <p className="text-xs font-bold text-black/42 dark:text-[#EAEAEA]/42">
                  عدد الجداول
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {dbUsage.tablesCount.toLocaleString("ar-EG")}
                </p>
              </div>
              <div className="rounded-[18px] border border-black/8 bg-[#F8F8F5] p-4 dark:border-white/10 dark:bg-[#101623]">
                <p className="text-xs font-bold text-black/42 dark:text-[#EAEAEA]/42">
                  أكبر جدول
                </p>
                <p className="mt-2 text-sm font-bold">
                  {dbUsage.topTables[0]?.name ?? "غير متاح"}
                </p>
                <p className="mt-1 text-xs text-black/45 dark:text-[#EAEAEA]/45">
                  {formatBytes(dbUsage.topTables[0]?.sizeBytes ?? 0)}
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-[18px] border border-black/8 dark:border-white/10">
              {dbUsage.topTables.length > 0 ? (
                dbUsage.topTables.map((table) => (
                  <div
                    key={table.name}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-black/8 bg-[#F8F8F5] p-4 last:border-b-0 dark:border-white/10 dark:bg-[#101623]"
                  >
                    <p className="text-sm font-bold">{table.name}</p>
                    <p className="text-xs text-black/45 dark:text-[#EAEAEA]/45">
                      ~{table.estimatedRows.toLocaleString("ar-EG")} صف
                    </p>
                    <p className="text-xs font-bold text-black/55 dark:text-[#EAEAEA]/60">
                      {formatBytes(table.sizeBytes)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="bg-[#F8F8F5] p-4 text-sm font-bold text-black/45 dark:bg-[#101623] dark:text-[#EAEAEA]/45">
                  لا توجد بيانات جداول لعرضها.
                </div>
              )}
            </div>
          </section>
        ) : null}

        <AdminAccountsStudio initialAdmins={admins} currentAdminId={auth.user.id} />
      </div>
    </AdminShell>
  );
}
