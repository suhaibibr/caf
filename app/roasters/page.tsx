import { ManagedRoastersGrid } from "@/components/ManagedRoastersGrid";
import { NavBar } from "@/components/NavBar";
import { appendMiscRecipesRoaster } from "@/lib/misc-recipes-roaster";
import { countManagedRecipesForMiscRoaster } from "@/lib/recipes-db";
import { listRoasters } from "@/lib/roasters-db";

export const dynamic = "force-dynamic";

export default async function RoastersPage() {
  const [baseRoasters, miscCounts] = await Promise.all([
    listRoasters(),
    countManagedRecipesForMiscRoaster(),
  ]);
  const roasters = appendMiscRecipesRoaster(baseRoasters, {
    recipeCount: miscCounts.total,
    approvedRecipeCount: miscCounts.approved,
  });

  return (
    <main className="theme-page page-shell min-h-screen px-8 pt-28 pb-16 sm:px-12">
      <NavBar tone="dark" />
      <section className="mx-auto max-w-6xl">
        <ManagedRoastersGrid initialRoasters={roasters} />
      </section>
    </main>
  );
}
