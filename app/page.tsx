import Link from "next/link";
import { GuestRecipeEntry } from "@/components/GuestRecipeEntry";
import { ManagedRoastersCarousel } from "@/components/ManagedRoastersCarousel";
import { NavBar } from "@/components/NavBar";
import {
  TopUsedRecipesSection,
  type TopRecipeUsageCard,
} from "@/components/TopUsedRecipesSection";
import { XbloomTrackedLink } from "@/components/XbloomTrackedLink";
import { getRoasterForRecipe, recipes } from "@/lib/data";
import { appendMiscRecipesRoaster } from "@/lib/misc-recipes-roaster";
import {
  countManagedRecipes,
  countManagedRecipesForMiscRoaster,
  listManagedRecipes,
  listManagedRecipesBySlugs,
  listManagedRecipesRandom,
} from "@/lib/recipes-db";
import { listRoasters } from "@/lib/roasters-db";
import { listTopXbloomRecipes } from "@/lib/xbloom-clicks-db";

export const dynamic = "force-dynamic";

const EXCLUSIVE_RECIPE_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1494314671902-399b18174975?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1522992319-0365e5f11656?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1400&q=85",
  "https://images.unsplash.com/photo-1459755486867-b55449bb39ff?auto=format&fit=crop&w=1400&q=85",
];

type ExclusiveRecipeCardData = {
  slug: string;
  name: string;
  href: string;
  image: string;
  sourceLabel: string;
  authorName: string;
  isRoasterApproved: boolean;
  grams: number;
  iceGrams: number | null;
  ratio: string;
  waterMl: number | null;
  brewType: "hot" | "cold" | "filter";
  firstPourTemperature: number | null;
  xbloomUrl: string;
};

function LeafOrnament({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 180 180"
      className={`pointer-events-none absolute h-36 w-36 text-[color:var(--ornament)] ${className}`}
      fill="none"
    >
      <path
        d="M30 150C70 118 86 80 112 24"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      {[
        [55, 118, -32],
        [78, 90, 24],
        [97, 58, -28],
        [112, 32, 22],
        [45, 135, 26],
        [68, 104, -24],
      ].map(([cx, cy, rotate], index) => (
        <ellipse
          key={index}
          cx={cx}
          cy={cy}
          rx="9"
          ry="24"
          transform={`rotate(${rotate} ${cx} ${cy})`}
          stroke="currentColor"
          strokeWidth="1.1"
        />
      ))}
    </svg>
  );
}

function TopographicPattern({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 260 220"
      className={`pointer-events-none absolute h-56 w-64 text-[color:var(--ornament)] ${className}`}
      fill="none"
    >
      {[
        "M30 118c26-52 72-76 120-64 32 8 46 32 74 24",
        "M22 142c34-62 86-92 138-78 38 10 52 34 78 24",
        "M36 164c34-50 72-78 124-68 42 8 58 34 82 30",
        "M58 186c24-30 58-54 100-48 42 6 64 26 82 24",
        "M70 96c22-26 50-38 78-32 24 6 36 22 56 18",
        "M96 130c20-18 42-25 68-18 20 5 34 16 48 12",
      ].map((d) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.2"
        />
      ))}
    </svg>
  );
}

function SteamSwirls({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 130 190"
      className={`pointer-events-none absolute h-48 w-32 text-[color:var(--ornament)] ${className}`}
      fill="none"
    >
      <path
        d="M78 178c-34-32 22-48-8-82-24-28 20-46-2-76"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.35"
      />
      <path
        d="M44 164c28-36-18-48 10-82 20-26-4-42 18-62"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1"
      />
    </svg>
  );
}

function BrewingToolOrnament({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 170 150"
      className={`pointer-events-none absolute h-36 w-40 text-[color:var(--ornament)] ${className}`}
      fill="none"
    >
      <path
        d="M54 42h62l-18 52H72L54 42Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
      <path
        d="M64 42c3-16 12-24 26-24s23 8 26 24M70 94h28M84 94v24M58 118h54"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.3"
      />
      <path
        d="M122 60c18 2 25 10 22 22-3 13-14 18-32 15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.1"
      />
    </svg>
  );
}

function CoffeeBeanSketch({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 150 120"
      className={`pointer-events-none absolute h-28 w-36 text-[color:var(--ornament)] ${className}`}
      fill="none"
    >
      <ellipse
        cx="58"
        cy="60"
        rx="22"
        ry="35"
        transform="rotate(-24 58 60)"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M58 26c-10 18 10 26-2 50-4 8-8 12-10 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1"
      />
      <ellipse
        cx="98"
        cy="58"
        rx="18"
        ry="29"
        transform="rotate(28 98 58)"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M96 30c9 14-7 23 4 42 4 7 8 11 9 16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1"
      />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 20c.9-4 3.1-6 6.5-6s5.6 2 6.5 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <path
        d="M5 8h14M5 12h14M5 16h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m16 16 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function RecipeBadgeUserIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    >
      <path d="M12 12.2a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z" />
      <path d="M5.8 18.8a6.8 6.8 0 0 1 12.4 0" />
    </svg>
  );
}

function RecipeBadgeCheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d="M12 3.8 18.8 6.6v5.8c0 4.1-2.7 7.8-6.8 9.8-4.1-2-6.8-5.7-6.8-9.8V6.6L12 3.8Z" />
      <path d="m8.8 12.4 2.1 2.1 4.2-4.2" />
    </svg>
  );
}

function RecipeCardIcon({
  type,
  className = "",
}: {
  type: "bean" | "ratio" | "temp" | "water" | "ice";
  className?: string;
}) {
  const icons = {
    bean: (
      <>
        <path d="M14.8 4.8c3.5 1.9 4.9 6.4 3.1 10s-6.2 5.1-9.7 3.2-4.9-6.4-3.1-10 6.2-5.1 9.7-3.2Z" />
        <path d="M10.4 5.7c2.4 2.2-.2 4.7 1.6 8.1.8 1.4 1.9 2.3 2 4.4" />
      </>
    ),
    ratio: (
      <>
        <circle cx="8" cy="8" r="2.1" />
        <circle cx="16" cy="16" r="2.1" />
        <path d="M7 17 17 7" />
      </>
    ),
    temp: (
      <>
        <path d="M10 5.2a2 2 0 0 1 4 0v7.1a3.7 3.7 0 1 1-4 0Z" />
        <path d="M12 9v6" />
      </>
    ),
    water: (
      <>
        <path d="M12 4.4c3.2 3.5 5 6.1 5 8.7a5 5 0 1 1-10 0c0-2.6 1.8-5.2 5-8.7Z" />
        <path d="M9.4 14.4c.7 1 2 1.5 3.2 1.3" />
      </>
    ),
    ice: (
      <>
        <path d="M12 4v16" />
        <path d="M5.8 7.3 18.2 16.7" />
        <path d="M18.2 7.3 5.8 16.7" />
        <path d="M4 12h16" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    >
      {icons[type]}
    </svg>
  );
}

function getMethodLabel(brewType: ExclusiveRecipeCardData["brewType"]) {
  if (brewType === "cold") {
    return "بارد";
  }
  if (brewType === "hot" || brewType === "filter") {
    return "حار";
  }
  return "مختص";
}

function getTopUsageShortLabel(recipe: {
  brewType: "hot" | "cold" | "filter";
  ratio: string;
  grams: number;
  iceGrams: number | null;
}) {
  const compact = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  });

  if (recipe.iceGrams && recipe.iceGrams > 0) {
    return `ice ${compact.format(recipe.iceGrams)}/${compact.format(recipe.grams)}`;
  }

  const ratio = recipe.ratio?.trim();
  if (ratio) {
    return `${recipe.brewType} ${ratio}`;
  }

  return recipe.brewType;
}

function getFirstMatchedNumber(ingredients: string[], pattern: RegExp) {
  return ingredients
    .map((ingredient) => ingredient.match(pattern))
    .find(Boolean)?.[1];
}

function mapStaticMethodToBrewType(method: string): ExclusiveRecipeCardData["brewType"] {
  if (method === "Cold Brew") {
    return "cold";
  }
  if (method === "Filter") {
    return "filter";
  }
  return "hot";
}

function ExclusiveRecipeCard({
  recipe,
  index,
}: {
  recipe: ExclusiveRecipeCardData;
  index: number;
}) {
  const numberFormat = new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 1,
  });
  const recipeNumber = new Intl.NumberFormat("ar-EG", {
    minimumIntegerDigits: 2,
    useGrouping: false,
  }).format(index + 1);

  const topBadgeLabel = recipe.firstPourTemperature
    ? `${numberFormat.format(recipe.firstPourTemperature)}°`
    : recipeNumber;
  const publisherLine = recipe.isRoasterApproved
    ? "وصفة معتمدة من المحمصة"
    : recipe.authorName?.trim()
      ? recipe.authorName
      : "xBloom";
  const methodLabel = getMethodLabel(recipe.brewType);
  const shortWaterLabel = recipe.waterMl
    ? `${numberFormat.format(recipe.waterMl)} مل`
    : "--";
  const beansAndIceLabel = recipe.iceGrams
    ? `${numberFormat.format(recipe.grams)}ج + ${numberFormat.format(recipe.iceGrams)}ج ثلج`
    : `${numberFormat.format(recipe.grams)}ج`;

  return (
    <article className="group relative isolate flex min-h-[304px] w-full min-w-0 flex-col overflow-hidden rounded-[18px] border border-white/12 bg-[#0B0F1A] p-3 pb-4 shadow-[0_14px_34px_rgba(0,0,0,0.38)] transition duration-200 ease-out hover:-translate-y-1 hover:border-white/24 hover:shadow-[0_18px_44px_rgba(0,0,0,0.54),0_0_34px_rgba(234,234,234,0.12)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={recipe.image}
        alt={recipe.name}
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-52 saturate-[0.72] blur-[1px] transition duration-200 group-hover:scale-105 group-hover:opacity-68"
        loading="lazy"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(8,13,22,0.48)_0%,rgba(8,13,22,0.66)_42%,rgba(2,6,23,0.92)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_8%,rgba(255,255,255,0.16),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-2 rounded-[14px] border border-white/[0.055]" />
      <div className="absolute inset-x-5 top-0 h-px bg-gradient-to-l from-transparent via-white/34 to-transparent" />

      <div className="relative z-10 flex items-center justify-between gap-2">
        <span
          className={`inline-flex max-w-[72%] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold backdrop-blur-xl ${
            recipe.isRoasterApproved
              ? "border-[#FFD699]/55 bg-[linear-gradient(135deg,rgba(255,203,112,0.28),rgba(255,150,75,0.22))] text-[#FFF1D6] shadow-[0_8px_24px_rgba(255,176,92,0.35)]"
              : "border-white/14 bg-white/[0.075] text-white/76"
          }`}
        >
          <span
            className={`grid h-4 w-4 place-items-center rounded-full ${
              recipe.isRoasterApproved
                ? "bg-[#FFD699]/22 text-[#FFF1D6]"
                : "bg-white/[0.08] text-white/68"
            }`}
          >
            {recipe.isRoasterApproved ? (
              <RecipeBadgeCheckIcon className="h-2.5 w-2.5" />
            ) : (
              <RecipeBadgeUserIcon className="h-2.5 w-2.5" />
            )}
          </span>
          <span className="truncate">{publisherLine}</span>
        </span>
        <span className="grid h-7 min-w-[40px] place-items-center rounded-full border border-white/12 bg-white/[0.07] px-2 text-[10px] font-bold text-white/62 backdrop-blur-xl">
          {topBadgeLabel}
        </span>
      </div>

      <div className="relative z-10 mt-3 min-h-[64px]">
        <h3 className="line-clamp-2 text-[17px] font-bold leading-[1.3] tracking-[0.01em] text-white">
          {recipe.name}
        </h3>
      </div>

      <div className="relative z-10 mt-auto flex shrink-0 flex-col gap-1.5">
        <div className="grid grid-cols-3 gap-1.5 rounded-[14px] border border-white/8 bg-[#091223]/80 px-2 py-2 text-center text-[10px] font-bold text-white/78 backdrop-blur-xl transition duration-200 group-hover:bg-[#0C162B]/82">
          <span className="flex min-h-[44px] items-center justify-center gap-1 overflow-hidden rounded-[10px] bg-black/10 px-1.5 py-1 leading-4">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.06] text-white/72">
              <RecipeCardIcon type="bean" className="h-3 w-3" />
            </span>
            <span className="truncate">{beansAndIceLabel}</span>
          </span>
          <span className="flex min-h-[44px] items-center justify-center gap-1 overflow-hidden rounded-[10px] bg-black/10 px-1.5 py-1 leading-4">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.06] text-white/72">
              <RecipeCardIcon type="ratio" className="h-3 w-3" />
            </span>
            <span className="truncate">{recipe.ratio}</span>
          </span>
          <span className="flex min-h-[44px] items-center justify-center gap-1 overflow-hidden rounded-[10px] bg-black/10 px-1.5 py-1 leading-4">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.06] text-white/72">
              <RecipeCardIcon type="water" className="h-3 w-3" />
            </span>
            <span className="truncate">{methodLabel} · {shortWaterLabel}</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <Link
            href={recipe.href}
            className="flex h-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-[linear-gradient(135deg,#EAEAEA,#AEB8C7)] px-3 text-[11px] font-bold text-[#080D16] shadow-[0_10px_24px_rgba(0,0,0,0.42),0_0_20px_rgba(234,234,234,0.14)] transition duration-200 group-hover:scale-[1.02] group-hover:brightness-105"
          >
            عرض الوصفة
          </Link>

          <XbloomTrackedLink
            href={recipe.xbloomUrl}
            recipeSlug={recipe.slug}
            className="flex h-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-3 text-[11px] font-bold text-white/86 backdrop-blur-xl transition duration-200 hover:bg-white/[0.11]"
          >
            دخول xBloom
          </XbloomTrackedLink>
        </div>
      </div>
    </article>
  );
}

type HomePageProps = {
  searchParams: Promise<{ q?: string | string[] | undefined }>;
};

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  const searchQuery = rawQuery.trim();
  const normalizedSearchQuery = searchQuery.toLowerCase();
  const shouldSearchAllManagedRecipes = normalizedSearchQuery.length > 0;

  const [baseRoasters, managedRecipes, topXbloomRecipes, managedRecipesCount, miscCounts] =
    await Promise.all([
      listRoasters(),
      shouldSearchAllManagedRecipes
        ? listManagedRecipes()
        : listManagedRecipesRandom(48),
      listTopXbloomRecipes(5),
      countManagedRecipes(),
      countManagedRecipesForMiscRoaster(),
    ]);
  const roasters = appendMiscRecipesRoaster(baseRoasters, {
    recipeCount: miscCounts.total,
    approvedRecipeCount: miscCounts.approved,
  });
  const topUsageSlugs = [...new Set(topXbloomRecipes.map((entry) => entry.recipeSlug))];
  const topUsageRecipes =
    topUsageSlugs.length > 0
      ? await listManagedRecipesBySlugs(topUsageSlugs)
      : [];
  const roasterMapBySlug = new Map(roasters.map((roaster) => [roaster.slug, roaster]));
  const generalRecipesHref = "/#recipes";
  const topUsageCatalog: Omit<TopRecipeUsageCard, "clicks">[] = topUsageRecipes.map(
    (recipe, index) => ({
      slug: recipe.slug,
      name: recipe.name,
      roasterName: recipe.roasterName?.trim() || "وصفات متنوعة",
      href: `/recipes/${recipe.slug}`,
      xbloomUrl: recipe.xbloomUrl,
      image:
        (recipe.roasterSlug ? roasterMapBySlug.get(recipe.roasterSlug)?.coverImage : null) ??
        EXCLUSIVE_RECIPE_FALLBACK_IMAGES[index % EXCLUSIVE_RECIPE_FALLBACK_IMAGES.length],
      shortLabel: getTopUsageShortLabel({
        brewType: recipe.brewType,
        ratio: recipe.ratio,
        grams: recipe.grams,
        iceGrams: recipe.iceGrams,
      }),
    }),
  );
  const topUsageCatalogMap = new Map(topUsageCatalog.map((item) => [item.slug, item]));
  const topRecipesByUsage = topXbloomRecipes
    .map((entry) => {
      const base = topUsageCatalogMap.get(entry.recipeSlug);
      if (!base) {
        return null;
      }

      return {
        ...base,
        clicks: entry.clicks,
      };
    })
    .filter((entry): entry is TopRecipeUsageCard => entry !== null);
  const generalManagedRecipes = managedRecipes
    .map((recipe, index) => {
      const resolvedRoasterName =
        (recipe.roasterSlug ? roasterMapBySlug.get(recipe.roasterSlug)?.name : null) ??
        recipe.roasterName?.trim() ??
        "وصفات متنوعة";

      return {
        image:
          (recipe.roasterSlug ? roasterMapBySlug.get(recipe.roasterSlug)?.coverImage : null) ??
          EXCLUSIVE_RECIPE_FALLBACK_IMAGES[index % EXCLUSIVE_RECIPE_FALLBACK_IMAGES.length],
        slug: recipe.slug,
        name: recipe.name,
        href: `/recipes/${recipe.slug}`,
        sourceLabel: `محمصة ${resolvedRoasterName}`,
        authorName: recipe.authorName,
        isRoasterApproved: recipe.isRoasterApproved,
        grams: recipe.grams,
        iceGrams: recipe.iceGrams,
        ratio: recipe.ratio,
        waterMl: recipe.waterMl,
        brewType: recipe.brewType,
        firstPourTemperature: recipe.firstPourTemperature,
        xbloomUrl: recipe.xbloomUrl,
      };
    });
  const staticFallbackRecipes: ExclusiveRecipeCardData[] = recipes.map((recipe, index) => {
    const brewLiquidGrams = getFirstMatchedNumber(
      recipe.ingredients,
      /(\d+(?:\.\d+)?)\s*جم.*(?:ماء|استخلاص|حليب|تونيك)/,
    );
    const coffeeGrams =
      getFirstMatchedNumber(recipe.ingredients, /(\d+(?:\.\d+)?)\s*جم.*قهوة/) ??
      getFirstMatchedNumber(recipe.ingredients, /(\d+(?:\.\d+)?)\s*جم/);
    const waterMl = getFirstMatchedNumber(recipe.ingredients, /(\d+(?:\.\d+)?)\s*جم.*ماء/);
    const iceGrams = getFirstMatchedNumber(recipe.ingredients, /(\d+(?:\.\d+)?)\s*جم.*ثلج/);
    const grams = coffeeGrams ? Number(coffeeGrams) : 18;
    const brewLiquid = brewLiquidGrams ? Number(brewLiquidGrams) : null;
    const roaster = getRoasterForRecipe(recipe);

    return {
      image: recipe.image || EXCLUSIVE_RECIPE_FALLBACK_IMAGES[index % EXCLUSIVE_RECIPE_FALLBACK_IMAGES.length],
      slug: recipe.slug,
      name: recipe.name,
      href: `/recipes/${recipe.slug}`,
      sourceLabel: "تحضير المحمصة",
      authorName: roaster?.name ?? "تحضير المحمصة",
      isRoasterApproved: false,
      grams,
      iceGrams: iceGrams ? Number(iceGrams) : null,
      ratio: brewLiquid && grams > 0 ? `1:${(brewLiquid / grams).toFixed(1)}` : "حسب الوصفة",
      waterMl: waterMl ? Number(waterMl) : null,
      brewType: mapStaticMethodToBrewType(recipe.method),
      firstPourTemperature: null,
      xbloomUrl: "https://xbloom.com",
    };
  });
  const recipesPool = generalManagedRecipes.length > 0 ? generalManagedRecipes : staticFallbackRecipes;
  const filteredRecipes =
    normalizedSearchQuery.length === 0
      ? recipesPool
      : recipesPool.filter((recipe) => {
          const searchable = [
            recipe.name,
            recipe.authorName,
            recipe.sourceLabel,
            recipe.ratio,
            recipe.brewType,
          ]
            .join(" ")
            .toLowerCase();
          return searchable.includes(normalizedSearchQuery);
        });
  const popularRecipes =
    normalizedSearchQuery.length === 0
      ? filteredRecipes.slice(0, 12)
      : filteredRecipes;
  const hasRoasters = roasters.length > 0;
  const totalRoasters = roasters.length;
  const totalRecipes = recipes.length + managedRecipesCount;

  return (
    <main className="theme-page page-shell relative min-h-screen overflow-hidden">
      <NavBar tone="dark" />
      <GuestRecipeEntry roasters={roasters} />
      <LeafOrnament className="left-8 top-24 -rotate-12" />
      <LeafOrnament className="bottom-28 right-4 rotate-[160deg] opacity-90" />
      <LeafOrnament className="left-0 top-[58%] rotate-[-34deg] opacity-75" />
      <TopographicPattern className="right-[-72px] top-[30%] rotate-6" />
      <TopographicPattern className="bottom-4 left-[-90px] rotate-[18deg] opacity-90" />
      <SteamSwirls className="left-[16%] top-[36%] -rotate-6" />
      <BrewingToolOrnament className="right-10 top-[49%] rotate-6" />
      <CoffeeBeanSketch className="bottom-16 left-[12%] -rotate-12" />

      <section className="relative flex min-h-[62svh] items-center justify-center px-6 pt-28 pb-12 text-center">
        <div className="reveal mx-auto max-w-2xl">
          <h1 className="text-4xl font-bold leading-[1.25] tracking-[0] text-[var(--page-fg)] sm:text-5xl">
            جرب محصولك
            <br />
            بـوصـفـة تـنـاسـبـك
          </h1>
          {!hasRoasters ? (
            <p className="mt-5 text-sm font-bold leading-7 text-[var(--page-muted)]">
              لا توجد محامص منشورة الآن. أضف محمصة جديدة من لوحة الإدارة لتظهر هنا
              مباشرة بشكل مرتب.
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/roasters"
              className="border border-[color:var(--page-line-strong)] px-6 py-2.5 text-[12px] font-bold text-[var(--page-fg)] transition duration-300 hover:bg-[var(--page-fg)] hover:text-[var(--page-bg)]"
            >
              المحامص
            </Link>
            <Link
              href={generalRecipesHref}
              className="border border-[color:var(--page-line-strong)] px-6 py-2.5 text-[12px] font-bold text-[var(--page-fg)] transition duration-300 hover:bg-[var(--page-fg)] hover:text-[var(--page-bg)]"
            >
              الوصفات:
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-base font-bold text-[var(--page-muted)] sm:text-lg">
            <span className="text-[var(--page-fg)]">
              {new Intl.NumberFormat("ar-EG").format(totalRoasters)} محمصة
            </span>
            <span className="text-[var(--page-soft)]">|</span>
            <span className="text-[var(--page-fg)]">
              {new Intl.NumberFormat("ar-EG").format(totalRecipes)} وصفة
            </span>
          </div>
        </div>
      </section>

      <section className="relative px-5 pb-16 sm:px-8">
        <div className="pointer-events-none absolute right-8 top-1/2 hidden text-[var(--page-soft)] md:block">
          <UserIcon />
        </div>
        <div className="pointer-events-none absolute left-8 top-1/2 hidden text-[var(--page-soft)] md:block">
          <MenuIcon />
        </div>

        <div className="mx-auto max-w-5xl">
          <ManagedRoastersCarousel
            initialRoasters={roasters}
            heading="اختر المحمصة."
            showSearch
          />
        </div>
      </section>

      <TopUsedRecipesSection
        initialItems={topRecipesByUsage}
        catalog={topUsageCatalog}
      />

      <section id="recipes" className="relative px-5 pb-24 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="reveal mx-auto flex max-w-4xl flex-col items-center justify-center gap-4 md:flex-row">
            <h2 className="text-center text-2xl font-bold leading-tight text-[var(--page-fg)] sm:text-3xl">
              الوصفات:
            </h2>

            <form
              method="GET"
              action="/#recipes"
              className="theme-input flex h-11 w-full max-w-md items-center gap-3 rounded-[18px] px-4 text-[var(--page-soft)] transition duration-300 focus-within:border-[color:var(--page-line-strong)] md:w-[360px]"
            >
              <SearchIcon />
              <input
                name="q"
                aria-label="ابحث في الوصفات"
                placeholder="ابحث في الوصفات"
                defaultValue={searchQuery}
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm font-bold text-[var(--page-fg)] outline-none placeholder:text-[var(--page-input-placeholder)]"
              />
              <button
                type="submit"
                className="rounded-full border border-[color:var(--page-line-strong)] px-3 py-1 text-[11px] font-bold text-[var(--page-fg)] transition hover:bg-[var(--page-fg)] hover:text-[var(--page-bg)]"
              >
                بحث
              </button>
              {searchQuery ? (
                <Link
                  href="/#recipes"
                  className="rounded-full border border-[color:var(--page-line)] px-3 py-1 text-[11px] font-bold text-[var(--page-muted)] transition hover:text-[var(--page-fg)]"
                >
                  مسح
                </Link>
              ) : null}
            </form>
          </div>

          {popularRecipes.length > 0 ? (
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {popularRecipes.map((recipe, index) => (
                <ExclusiveRecipeCard
                  key={recipe.slug}
                  recipe={recipe}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <div className="theme-surface reveal mt-8 rounded-[22px] px-6 py-10 text-center text-sm font-bold text-[var(--page-muted)]">
              {searchQuery
                ? "لا توجد نتائج مطابقة لعبارة البحث."
                : "لا توجد وصفات متاحة حاليًا."}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
