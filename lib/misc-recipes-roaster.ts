import type { Roaster } from "@/lib/data";

export const MISC_RECIPES_LABEL = "وصفات متنوعة";
export const MISC_RECIPES_ROASTER_SLUG = "misc-recipes";

export function buildMiscRecipesRoaster(input?: {
  recipeCount?: number;
  approvedRecipeCount?: number;
}): Roaster {
  return {
    slug: MISC_RECIPES_ROASTER_SLUG,
    name: MISC_RECIPES_LABEL,
    shortName: MISC_RECIPES_LABEL,
    description: "وصفات مجمعة من إضافات المجتمع ومحامص غير محددة.",
    about:
      "هنا تجد الوصفات التي أضيفت بدون تحديد محمصة بعينها. هذا القسم يجمع وصفات متنوعة لتسهيل الوصول لها في مكان واحد.",
    location: "",
    logo: "VM",
    coverImage:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1800&q=85",
    accent: "#4C6A8A",
    featured: true,
    recipeCount: input?.recipeCount ?? 0,
    approvedRecipeCount: input?.approvedRecipeCount ?? 0,
  };
}

export function appendMiscRecipesRoaster(
  roasters: Roaster[],
  input?: {
    recipeCount?: number;
    approvedRecipeCount?: number;
  },
) {
  const bySlug = roasters.findIndex(
    (roaster) => roaster.slug === MISC_RECIPES_ROASTER_SLUG,
  );
  if (bySlug >= 0) {
    return roasters;
  }

  const byName = roasters.findIndex(
    (roaster) =>
      roaster.name.trim() === MISC_RECIPES_LABEL ||
      roaster.shortName.trim() === MISC_RECIPES_LABEL ||
      roaster.name.includes(MISC_RECIPES_LABEL),
  );
  if (byName >= 0) {
    return roasters.map((roaster, index) => {
      if (index !== byName) {
        return roaster;
      }
      return {
        ...roaster,
        recipeCount: Math.max(roaster.recipeCount ?? 0, input?.recipeCount ?? 0),
        approvedRecipeCount: Math.max(
          roaster.approvedRecipeCount ?? 0,
          input?.approvedRecipeCount ?? 0,
        ),
      };
    });
  }

  return [buildMiscRecipesRoaster(input), ...roasters];
}
