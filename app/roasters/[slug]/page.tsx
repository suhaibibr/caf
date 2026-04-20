import type { Metadata } from "next";
import {
  ManagedRoasterPage,
  type RoasterPageRecipe,
} from "@/components/ManagedRoasterPage";
import { getRecipesByRoaster } from "@/lib/data";
import { appendMiscRecipesRoaster } from "@/lib/misc-recipes-roaster";
import { listRoasters } from "@/lib/roasters-db";
import {
  countManagedRecipesForMiscRoaster,
  listManagedRecipesByRoaster,
} from "@/lib/recipes-db";

type RoasterPageProps = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 60;

function normalizeSlug(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function generateMetadata({
  params,
}: RoasterPageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);
  const [roasters, miscCounts] = await Promise.all([
    listRoasters(),
    countManagedRecipesForMiscRoaster(),
  ]);
  const roaster = appendMiscRecipesRoaster(roasters, {
    recipeCount: miscCounts.total,
    approvedRecipeCount: miscCounts.approved,
  }).find((item) => item.slug === slug);

  if (!roaster) {
    return {
      title: "محمصة | كــاف",
      description: "صفحة محمصة داخل كــاف.",
    };
  }

  return {
    title: `${roaster.name} | كــاف`,
    description: roaster.description,
  };
}

export default async function RoasterPage({ params }: RoasterPageProps) {
  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);
  const [baseRoasters, miscCounts] = await Promise.all([
    listRoasters(),
    countManagedRecipesForMiscRoaster(),
  ]);
  const roasters = appendMiscRecipesRoaster(baseRoasters, {
    recipeCount: miscCounts.total,
    approvedRecipeCount: miscCounts.approved,
  });
  const roaster = roasters.find((item) => item.slug === slug) ?? null;
  const managedRecipes = await listManagedRecipesByRoaster(slug, roaster?.name ?? null);
  const staticRecipes = roaster ? getRecipesByRoaster(roaster.slug) : [];
  const roasterRecipes: RoasterPageRecipe[] = [
    ...managedRecipes.map((recipe) => ({
      ...recipe,
      source: "managed" as const,
    })),
    ...staticRecipes,
  ];

  return (
    <ManagedRoasterPage
      slug={slug}
      initialRoaster={roaster}
      initialRoasters={roasters}
      initialRecipes={roasterRecipes}
    />
  );
}
