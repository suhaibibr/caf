import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { recipes } from "@/lib/data";
import { listRoasters } from "@/lib/roasters-db";
import { listManagedRecipes } from "@/lib/recipes-db";
import { getSiteMetrics } from "@/lib/site-metrics-db";
import { requireAdminPageAccess } from "@/lib/auth/session";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";

export const metadata: Metadata = {
  title: "لوحة الإدارة | كــاف",
  description: "لوحة إدارة هادئة للمحامص والوصفات.",
};

export const dynamic = "force-dynamic";

function formatTimeAgo(timestamp: string) {
  const target = new Date(timestamp).getTime();
  if (Number.isNaN(target)) {
    return "الآن";
  }

  const diffMs = Math.max(Date.now() - target, 0);
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes <= 1) {
    return "قبل دقيقة";
  }
  if (diffMinutes < 60) {
    return `قبل ${new Intl.NumberFormat("ar-EG").format(diffMinutes)} دقيقة`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `قبل ${new Intl.NumberFormat("ar-EG").format(diffHours)} ساعة`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `قبل ${new Intl.NumberFormat("ar-EG").format(diffDays)} يوم`;
}

export default async function AdminPage() {
  await requireAdminPageAccess(
    "/admin",
    RBAC_PERMISSIONS.ADMIN_DASHBOARD_READ,
  );

  const [roasters, managedRecipes, metrics] = await Promise.all([
    listRoasters(),
    listManagedRecipes(),
    getSiteMetrics(),
  ]);
  const latestAddedRecipe = [...managedRecipes]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .at(0);
  const latestAddedAgo = latestAddedRecipe
    ? formatTimeAgo(latestAddedRecipe.createdAt)
    : "لا توجد وصفات مضافة بعد";
  const totalRecipes = recipes.length + managedRecipes.length;
  const recentActivity = managedRecipes.slice(0, 4);

  const stats = [
    ["عدد المحامص", roasters.length.toLocaleString("ar-EG"), "محتوى نشط"],
    [
      "عدد الوصفات",
      totalRecipes.toLocaleString("ar-EG"),
      "وصفات منشورة",
    ],
    ["عدد الزيارات", metrics.totalVisits.toLocaleString("ar-EG"), "إجمالي الزيارات"],
    ["عدد المتصلين", metrics.connectedUsers.toLocaleString("ar-EG"), "نشطون الآن"],
  ];

  return (
    <AdminShell activePath="/admin">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-black/42 dark:text-[#EAEAEA]/42">
              لوحة التحكم
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              نظرة سريعة على المحتوى
            </h1>
            <p className="mt-3 text-sm font-bold text-black/45 dark:text-[#EAEAEA]/45">
              {latestAddedRecipe
                ? `آخر وصفة مضافة: ${latestAddedRecipe.name} · ${latestAddedAgo}`
                : "لا توجد وصفات مضافة بعد."}
            </p>
          </div>
          <Link
            href="/admin/roasters"
            className="w-fit rounded-[16px] bg-black px-5 py-3 text-sm font-bold text-white shadow-[0_16px_44px_rgba(0,0,0,0.12)] transition hover:scale-[1.01] dark:bg-[#EAEAEA] dark:text-[#0B0F1A]"
          >
            إدارة المحامص
          </Link>
        </section>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(([label, value, detail]) => (
            <div
              key={label}
              className="rounded-[20px] border border-black/8 bg-white/76 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-white/[0.045]"
            >
              <p className="text-xs font-bold text-black/42 dark:text-[#EAEAEA]/42">
                {label}
              </p>
              <p className="mt-4 text-3xl font-bold tracking-[-0.03em]">
                {value}
              </p>
              <p className="mt-2 text-xs text-black/38 dark:text-[#EAEAEA]/38">
                {detail}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <aside className="rounded-[24px] border border-black/8 bg-white/76 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-white/[0.045]">
            <p className="text-xs font-bold text-black/42 dark:text-[#EAEAEA]/42">
              النشاط
            </p>
            <h2 className="mt-1 text-2xl font-bold">آخر التحديثات</h2>
            <div className="mt-5 space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.map((recipe) => (
                  <div
                    key={recipe.slug}
                    className="rounded-[18px] border border-black/8 bg-[#F8F8F5] p-4 dark:border-white/10 dark:bg-[#101623]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold">تمت إضافة وصفة</p>
                        <p className="mt-1 text-sm text-black/45 dark:text-[#EAEAEA]/45">
                          {recipe.name}
                        </p>
                      </div>
                      <span className="text-xs text-black/35 dark:text-[#EAEAEA]/35">
                        {formatTimeAgo(recipe.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div
                  className="rounded-[18px] border border-black/8 bg-[#F8F8F5] p-4 dark:border-white/10 dark:bg-[#101623]"
                >
                  <p className="text-sm font-bold text-black/45 dark:text-[#EAEAEA]/45">
                    لا توجد تحديثات بعد.
                  </p>
                </div>
              )}
            </div>
          </aside>

          <div className="rounded-[24px] border border-black/8 bg-white/76 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-white/[0.045]">
            <p className="text-xs font-bold text-black/42 dark:text-[#EAEAEA]/42">
              الوصفات
            </p>
            <h2 className="mt-1 text-2xl font-bold">إدارة الوصفات</h2>
            <div className="mt-5 overflow-hidden rounded-[18px] border border-black/8 dark:border-white/10">
              {managedRecipes.length > 0 ? (
                managedRecipes.slice(0, 6).map((recipe) => (
                  <div
                    key={recipe.slug}
                    className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-black/8 bg-[#F8F8F5] p-4 last:border-b-0 dark:border-white/10 dark:bg-[#101623]"
                  >
                    <div>
                      <p className="font-bold">{recipe.name}</p>
                      <p className="mt-1 text-sm text-black/45 dark:text-[#EAEAEA]/45">
                        {recipe.roasterName || "وصفات متنوعة"} · {recipe.brewer} ·{" "}
                        {formatTimeAgo(recipe.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href="/admin/recipes"
                        className="rounded-[12px] border border-black/8 px-3 py-2 text-xs font-bold dark:border-white/10"
                      >
                        تعديل
                      </Link>
                      <Link
                        href="/admin/recipes"
                        className="rounded-[12px] border border-black/8 px-3 py-2 text-xs font-bold text-black/45 dark:border-white/10 dark:text-[#EAEAEA]/45"
                      >
                        حذف
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-[#F8F8F5] p-4 text-sm font-bold text-black/45 dark:bg-[#101623] dark:text-[#EAEAEA]/45">
                  لا توجد وصفات لإدارتها الآن.
                </div>
              )}
            </div>
            <Link
              href="/admin/recipes"
              className="mt-4 inline-flex rounded-[12px] border border-black/10 px-3 py-2 text-xs font-bold transition hover:bg-black hover:text-white dark:border-white/10 dark:hover:bg-white dark:hover:text-[#0B0F1A]"
            >
              فتح إدارة الوصفات
            </Link>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
