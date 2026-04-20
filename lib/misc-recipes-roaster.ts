import type { Roaster } from "@/lib/data";

export const MISC_RECIPES_LABEL = "وصفات متنوعة";
export const MISC_RECIPES_ROASTER_SLUG = "misc-recipes";
const MISC_RECIPES_LABEL_ALT = "وصفات منوعة";

export const MISC_RECIPES_NAME_ALIASES = [
  MISC_RECIPES_LABEL,
  MISC_RECIPES_LABEL_ALT,
];

function normalizeValue(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugifyValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const miscSlugAliasSet = new Set<string>([
  MISC_RECIPES_ROASTER_SLUG,
  "وصفات-متنوعة",
  "وصفات-منوعة",
  ...MISC_RECIPES_NAME_ALIASES.map((name) => slugifyValue(name)),
]);

export function getMiscRecipesNameAliases() {
  return [...MISC_RECIPES_NAME_ALIASES];
}

export function getMiscRecipesSlugAliases() {
  return [...miscSlugAliasSet];
}

export function isMiscRecipesName(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const normalized = normalizeValue(value);
  return MISC_RECIPES_NAME_ALIASES.some((alias) => {
    const normalizedAlias = normalizeValue(alias);
    return normalized === normalizedAlias || normalized.includes(normalizedAlias);
  });
}

export function isMiscRecipesSlug(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const normalized = slugifyValue(value);
  return normalized ? miscSlugAliasSet.has(normalized) : false;
}

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
    (roaster) => isMiscRecipesSlug(roaster.slug),
  );
  if (bySlug >= 0) {
    return roasters.map((roaster, index) => {
      if (index !== bySlug) {
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

  const byName = roasters.findIndex(
    (roaster) => isMiscRecipesName(roaster.name) || isMiscRecipesName(roaster.shortName),
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
