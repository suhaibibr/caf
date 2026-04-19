import type { Metadata } from "next";
import { AdminShell } from "@/components/AdminShell";
import { AdminRecipeReviewsStudio } from "@/components/AdminRecipeReviewsStudio";
import { requireAdminPageAccess } from "@/lib/auth/session";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";
import { listRecipeSubmissions } from "@/lib/recipe-submissions-db";

export const metadata: Metadata = {
  title: "مراجعة الوصفات | لوحة الإدارة",
  description: "مراجعة الوصفات المرسلة من الصفحة الرئيسية.",
};

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage() {
  await requireAdminPageAccess("/admin/reviews", RBAC_PERMISSIONS.ADMIN_RECIPES_MANAGE);
  const submissions = await listRecipeSubmissions("pending");

  return (
    <AdminShell activePath="/admin/reviews">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-black/42 dark:text-[#EAEAEA]/42">
              مراجعة الوصفات
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              الوصفات الجديدة من الصفحة الرئيسية
            </h1>
          </div>
        </section>

        <AdminRecipeReviewsStudio initialSubmissions={submissions} />
      </div>
    </AdminShell>
  );
}

