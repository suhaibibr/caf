import type { Metadata } from "next";
import {
  ManagedRoasterPage,
  type RoasterPageRecipe,
} from "@/components/ManagedRoasterPage";
import { getRecipesByRoaster } from "@/lib/data";
import { getRoasterBySlug, listRoasters } from "@/lib/roasters-db";
import { listManagedRecipesByRoaster } from "@/lib/recipes-db";

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
  const roaster = await getRoasterBySlug(slug);

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
  const [roaster, roasters, managedRecipes] = await Promise.all([
    getRoasterBySlug(slug),
    listRoasters(),
    listManagedRecipesByRoaster(slug),
  ]);
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
