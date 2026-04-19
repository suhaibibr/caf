import type { Metadata } from "next";
import { AdminRecipesStudio } from "@/components/AdminRecipesStudio";
import { AdminShell } from "@/components/AdminShell";
import { listRoasters } from "@/lib/roasters-db";
import { listManagedRecipes } from "@/lib/recipes-db";
import { requireAdminPageAccess } from "@/lib/auth/session";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";

export const metadata: Metadata = {
  title: "الوصفات | لوحة الإدارة",
  description: "إدارة الوصفات داخل كــاف.",
};

export const dynamic = "force-dynamic";

type AdminRecipesPageProps = {
  searchParams: Promise<{ create?: string }>;
};

export default async function AdminRecipesPage({ searchParams }: AdminRecipesPageProps) {
  await requireAdminPageAccess("/admin/recipes", RBAC_PERMISSIONS.ADMIN_RECIPES_MANAGE);
  const query = await searchParams;
  const openCreate = query.create === "1";

  const [roasters, recipes] = await Promise.all([
    listRoasters(),
    listManagedRecipes(),
  ]);

  return (
    <AdminShell activePath="/admin/recipes">
      <div className="mx-auto min-w-0 max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold text-black/42 dark:text-[#EAEAEA]/42">
              الوصفات
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
              إدارة الوصفات
            </h1>
          </div>
        </section>

        <AdminRecipesStudio
          initialRecipes={recipes}
          roasters={roasters}
          initialOpenCreate={openCreate}
        />
      </div>
    </AdminShell>
  );
}
