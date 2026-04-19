"use client";

import { useEffect, useMemo, useState } from "react";
import { NavBar } from "@/components/NavBar";
import { XbloomTrackedLink } from "@/components/XbloomTrackedLink";
import type { Recipe, Roaster } from "@/lib/data";
import type { ManagedPourStep, ManagedRecipe } from "@/lib/recipes-db";

type ManagedRoasterPageProps = {
  slug: string;
  initialRoaster: Roaster | null;
  initialRoasters: Roaster[];
  initialRecipes: RoasterPageRecipe[];
};

export type RoasterPageRecipe =
  | Recipe
  | (ManagedRecipe & {
      source: "managed";
    });

type RoasterRecipeGroup = {
  key: string;
  name: string;
  recipes: RoasterPageRecipe[];
};

const ROASTER_RECIPES_PER_PAGE = 24;

function isManagedRoasterRecipe(
  recipe: RoasterPageRecipe,
): recipe is ManagedRecipe & { source: "managed" } {
  return "source" in recipe && recipe.source === "managed";
}

function getRecipeHeatClass(recipe: RoasterPageRecipe) {
  if (isManagedRoasterRecipe(recipe)) {
    if (recipe.brewType === "cold") {
      return "cold" as const;
    }
    if (recipe.brewType === "hot" || recipe.brewType === "filter") {
      return "hot" as const;
    }
    return "other" as const;
  }

  if (recipe.method === "Cold Brew") {
    return "cold" as const;
  }

  return "hot" as const;
}

function buildNameKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildRecipeGroupKey(recipe: RoasterPageRecipe) {
  if (isManagedRoasterRecipe(recipe) && recipe.mergeGroupKey?.trim()) {
    return `merge:${recipe.mergeGroupKey.trim().toLowerCase()}`;
  }

  return `name:${buildNameKey(recipe.name)}`;
}

function orderRoasterRecipes(recipes: RoasterPageRecipe[]) {
  const grouped = new Map<string, RoasterPageRecipe[]>();

  recipes.forEach((recipe) => {
    const key = buildRecipeGroupKey(recipe);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(recipe);
      return;
    }
    grouped.set(key, [recipe]);
  });

  const ordered: RoasterPageRecipe[] = [];

  grouped.forEach((group) => {
    if (group.length <= 1) {
      ordered.push(...group);
      return;
    }

    const cold = group.filter((recipe) => getRecipeHeatClass(recipe) === "cold");
    const hot = group.filter((recipe) => getRecipeHeatClass(recipe) === "hot");
    const other = group.filter((recipe) => getRecipeHeatClass(recipe) === "other");

    let takeColdNext = cold.length > 0;
    while (cold.length > 0 || hot.length > 0) {
      if (takeColdNext && cold.length > 0) {
        ordered.push(cold.shift() as RoasterPageRecipe);
      } else if (!takeColdNext && hot.length > 0) {
        ordered.push(hot.shift() as RoasterPageRecipe);
      } else if (cold.length > 0) {
        ordered.push(cold.shift() as RoasterPageRecipe);
      } else if (hot.length > 0) {
        ordered.push(hot.shift() as RoasterPageRecipe);
      }

      takeColdNext = !takeColdNext;
    }

    ordered.push(...other);
  });

  return ordered;
}

function pickPrimaryRecipe(group: RoasterRecipeGroup) {
  const managedApproved = group.recipes.find(
    (recipe) => isManagedRoasterRecipe(recipe) && recipe.isRoasterApproved,
  );
  if (managedApproved) {
    return managedApproved;
  }

  const managed = group.recipes.find((recipe) => isManagedRoasterRecipe(recipe));
  if (managed) {
    return managed;
  }

  return group.recipes[0];
}

function getGroupMethodLabel(group: RoasterRecipeGroup) {
  const hasCold = group.recipes.some((recipe) => getRecipeHeatClass(recipe) === "cold");
  const hasHot = group.recipes.some((recipe) => getRecipeHeatClass(recipe) === "hot");

  if (hasCold && hasHot) {
    return "بارد / حار";
  }
  if (hasCold) {
    return "بارد";
  }
  if (hasHot) {
    return "حار";
  }

  return "مختص";
}

function getLocalizedPourName(name: string | undefined, index: number) {
  const fallback = `الصبة ${new Intl.NumberFormat("ar-EG").format(index + 1)}`;

  if (!name) {
    return fallback;
  }

  const normalized = name.trim().toLowerCase();

  if (normalized === "bloom") {
    return "البلومنق";
  }

  const pourMatch = normalized.match(/^pour\s*(\d+)$/);
  if (pourMatch) {
    return `الصبة ${new Intl.NumberFormat("ar-EG").format(Number(pourMatch[1]))}`;
  }

  return name;
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function UserIcon({ className = "" }: { className?: string }) {
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

function BadgeCheckIcon({ className = "" }: { className?: string }) {
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

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function CardIcon({
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

function RecipeExploreCard({
  group,
  index,
  roasterImage,
  onPreview,
  onPickVariant,
}: {
  group: RoasterRecipeGroup;
  index: number;
  roasterImage: string;
  onPreview: (recipe: RoasterPageRecipe) => void;
  onPickVariant: (group: RoasterRecipeGroup) => void;
}) {
  const recipe = pickPrimaryRecipe(group);
  const numberFormat = new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 1,
  });
  const recipeNumber = new Intl.NumberFormat("ar-EG", {
    minimumIntegerDigits: 2,
    useGrouping: false,
  }).format(index + 1);
  const isManagedRecipe = isManagedRoasterRecipe(recipe);

  let coffeeGrams: string | undefined;
  let iceGrams: string | undefined;
  let waterMl: string | undefined;
  let ratio = "حسب الوصفة";
  const methodTone = getGroupMethodLabel(group);
  let isRoasterApproved = false;
  let firstPourTemperature: number | null = null;
  let xbloomUrl: string | null = null;

  if (isManagedRecipe) {
    coffeeGrams = String(recipe.grams);
    iceGrams = recipe.iceGrams ? String(recipe.iceGrams) : undefined;
    waterMl = recipe.waterMl ? String(recipe.waterMl) : undefined;
    ratio = recipe.ratio;
    firstPourTemperature = recipe.firstPourTemperature;
    xbloomUrl = recipe.xbloomUrl;
    isRoasterApproved = recipe.isRoasterApproved;
  } else {
    const brewLiquidGrams = recipe.ingredients
      .map((ingredient) =>
        ingredient.match(/(\d+(?:\.\d+)?)\s*جم.*(?:ماء|استخلاص|حليب|تونيك)/),
      )
      .find(Boolean)?.[1];
    coffeeGrams =
      recipe.ingredients
        .map((ingredient) => ingredient.match(/(\d+(?:\.\d+)?)\s*جم.*قهوة/))
        .find(Boolean)?.[1] ??
      recipe.ingredients
        .map((ingredient) => ingredient.match(/(\d+(?:\.\d+)?)\s*جم/))
        .find(Boolean)?.[1];
    waterMl = recipe.ingredients
      .map((ingredient) => ingredient.match(/(\d+(?:\.\d+)?)\s*جم.*ماء/))
      .find(Boolean)?.[1];
    ratio =
      coffeeGrams && brewLiquidGrams
        ? `١:${numberFormat.format(Number(brewLiquidGrams) / Number(coffeeGrams))}`
        : "حسب الوصفة";
  }

  const gramsLabel = coffeeGrams
    ? `${numberFormat.format(Number(coffeeGrams))} جرام`
    : "غير محدد";
  const waterLabel = waterMl
    ? `${numberFormat.format(Number(waterMl))} مل ماء`
    : "حسب الوصفة";
  const topBadgeLabel = firstPourTemperature
    ? `${numberFormat.format(firstPourTemperature)}°`
    : recipeNumber;
  const methodLabel = methodTone;
  const publisherLine = isManagedRecipe
    ? isRoasterApproved
      ? "وصفة معتمدة من المحمصة"
      : recipe.authorName?.trim()
        ? recipe.authorName
        : "xBloom"
    : "تحضير المحمصة";

  return (
    <article
      className="group relative isolate flex h-[470px] flex-col overflow-hidden rounded-[30px] border border-white/12 bg-[#0B0F1A] p-5 shadow-[0_18px_54px_rgba(0,0,0,0.38)] transition duration-200 ease-out hover:-translate-y-1 hover:border-white/24 hover:shadow-[0_30px_86px_rgba(0,0,0,0.58),0_0_48px_rgba(234,234,234,0.12)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={roasterImage}
        alt="خلفية المحمصة"
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-52 saturate-[0.72] blur-[1px] transition duration-200 group-hover:scale-105 group-hover:opacity-66"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(8,13,22,0.48)_0%,rgba(8,13,22,0.66)_42%,rgba(2,6,23,0.92)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_8%,rgba(255,255,255,0.16),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-3 rounded-[26px] border border-white/[0.055]" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-l from-transparent via-white/34 to-transparent" />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold backdrop-blur-xl ${
            isRoasterApproved
              ? "border-[#FFD699]/55 bg-[linear-gradient(135deg,rgba(255,203,112,0.28),rgba(255,150,75,0.22))] text-[#FFF1D6] shadow-[0_8px_24px_rgba(255,176,92,0.35)]"
              : "border-white/14 bg-white/[0.075] text-white/76"
          }`}
        >
          <span
            className={`grid h-4 w-4 place-items-center rounded-full ${
              isRoasterApproved
                ? "bg-[#FFD699]/22 text-[#FFF1D6]"
                : "bg-white/[0.08] text-white/68"
            }`}
          >
            {isRoasterApproved ? (
              <BadgeCheckIcon className="h-2.5 w-2.5" />
            ) : (
              <UserIcon className="h-2.5 w-2.5" />
            )}
          </span>
          {publisherLine}
        </span>
        <span className="grid h-8 min-w-[44px] place-items-center rounded-full border border-white/12 bg-white/[0.07] px-2 text-[11px] font-bold text-white/62 backdrop-blur-xl">
          {topBadgeLabel}
        </span>
      </div>

      <div className="relative z-10 mt-5 min-h-[112px]">
        <h3 className="text-[23px] font-bold leading-[1.22] tracking-[0.01em] text-white">
          {group.name}
        </h3>
      </div>

      <div className="relative z-10 mt-auto flex shrink-0 flex-col gap-2">
        <div className="min-h-[116px] rounded-[22px] border border-white/12 bg-white/[0.08] px-4 py-3 backdrop-blur-xl transition duration-200 group-hover:bg-white/[0.11]">
          <div className="flex items-center gap-2 text-white/38">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.07] text-white/62">
              <CardIcon type="bean" className="h-3.5 w-3.5" />
            </span>
            <p className="text-[11px] font-bold">
              {iceGrams ? "جرعات الوصفة" : "كمية البن"}
            </p>
          </div>

          {iceGrams ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-[18px] border border-white/10 bg-black/14 px-3 py-2.5">
                <p className="text-[11px] font-bold text-white/40">القهوة</p>
                <p className="mt-2 text-lg font-bold tracking-[-0.04em] text-white">
                  {gramsLabel}
                </p>
              </div>
              <div className="rounded-[18px] border border-white/10 bg-black/14 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-white/40">
                  <CardIcon type="ice" className="h-3.5 w-3.5" />
                  <p className="text-[11px] font-bold">الثلج</p>
                </div>
                <p className="mt-2 text-lg font-bold tracking-[-0.04em] text-white">
                  {numberFormat.format(Number(iceGrams))} جرام
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-white">
              {gramsLabel}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5 rounded-[18px] border border-white/8 bg-white/[0.04] px-2 py-2 text-center text-[11px] font-bold text-white/62 backdrop-blur-xl transition duration-200 group-hover:bg-white/[0.06]">
          <span className="flex min-h-[50px] items-center justify-center gap-1.5 rounded-[14px] bg-black/10 px-2 py-1.5 leading-4">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.06] text-white/72">
              <CardIcon type="ratio" className="h-3 w-3" />
            </span>
            ريشيو {ratio}
          </span>
          <span className="flex min-h-[50px] items-center justify-center gap-1.5 rounded-[14px] bg-black/10 px-2 py-1.5 leading-4">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.06] text-white/72">
              <CardIcon type="temp" className="h-3 w-3" />
            </span>
            {methodLabel}
          </span>
          <span className="flex min-h-[50px] items-center justify-center gap-1.5 rounded-[14px] bg-black/10 px-2 py-1.5 leading-4">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.06] text-white/72">
              <CardIcon type="water" className="h-3 w-3" />
            </span>
            {waterLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              const hasCold = group.recipes.some(
                (item) => getRecipeHeatClass(item) === "cold",
              );
              const hasHot = group.recipes.some(
                (item) => getRecipeHeatClass(item) === "hot",
              );

              if (group.recipes.length > 1 && hasCold && hasHot) {
                onPickVariant(group);
                return;
              }

              onPreview(recipe);
            }}
            className="flex h-12 shrink-0 items-center justify-center rounded-full border border-white/12 bg-[linear-gradient(135deg,#EAEAEA,#AEB8C7)] px-4 text-sm font-bold text-[#080D16] shadow-[0_12px_34px_rgba(0,0,0,0.42),0_0_26px_rgba(234,234,234,0.14)] transition duration-200 group-hover:scale-[1.02] group-hover:brightness-105"
          >
            عرض الوصفة
          </button>

          {xbloomUrl ? (
            <XbloomTrackedLink
              href={xbloomUrl}
              recipeSlug={recipe.slug}
              className="flex h-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm font-bold text-white/86 backdrop-blur-xl transition duration-200 hover:bg-white/[0.11]"
            >
              دخول xBloom
            </XbloomTrackedLink>
          ) : (
            <span className="flex h-12 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] px-4 text-sm font-bold text-white/35">
              xBloom غير متاح
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function RecipePreviewModal({
  recipe,
  roaster,
  onClose,
}: {
  recipe: RoasterPageRecipe;
  roaster: Roaster;
  onClose: () => void;
}) {
  const numberFormat = new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 1,
  });
  const isManagedRecipe = isManagedRoasterRecipe(recipe);
  const [fetchedPourSteps, setFetchedPourSteps] = useState<ManagedPourStep[]>([]);
  const [isLoadingPourSteps, setIsLoadingPourSteps] = useState(false);

  let summary = "";
  let extraRows: Array<[string, string]> = [];
  let xbloomUrl: string | null = null;
  let pourSteps: ManagedPourStep[] = [];

  if (isManagedRecipe) {
    pourSteps = recipe.pourSteps ?? [];
    extraRows = [
      [
        "كمية البن",
        recipe.iceGrams
          ? `${numberFormat.format(recipe.grams)} جرام قهوة · ${numberFormat.format(recipe.iceGrams)} جرام ثلج`
          : `${numberFormat.format(recipe.grams)} جرام`,
      ],
      ["الأداة", recipe.brewer],
      ["النسبة", recipe.ratio],
      [
        "كمية الماء",
        recipe.waterMl
          ? `${numberFormat.format(recipe.waterMl)} مل`
          : "حسب الوصفة",
      ],
      [
        "عدد الصبات",
        recipe.pourCount ? `${recipe.pourCount}` : "غير متوفر",
      ],
      [
        "درجة الحرارة",
        recipe.firstPourTemperature
          ? `${numberFormat.format(recipe.firstPourTemperature)}°`
          : "غير متوفرة",
      ],
    ];
    xbloomUrl = recipe.xbloomUrl;
  } else {
    summary = recipe.summary;
    extraRows = [
      ["الطريقة", recipe.method === "Cold Brew" ? "بارد" : recipe.method === "Filter" ? "فلتر" : "مختص"],
      ["الوقت", `${numberFormat.format(recipe.brewTime)} دقائق`],
      ["الأدوات", recipe.tools.join(" - ")],
    ];
  }

  useEffect(() => {
    let cancelled = false;

    const loadPourSteps = async () => {
      if (!isManagedRecipe || pourSteps.length > 0 || !xbloomUrl) {
        setFetchedPourSteps([]);
        return;
      }

      setIsLoadingPourSteps(true);
      try {
        const response = await fetch("/api/xbloom", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: xbloomUrl }),
        });

        const payload = (await response.json()) as {
          pourSteps?: ManagedPourStep[];
        };

        if (!cancelled && response.ok && Array.isArray(payload.pourSteps)) {
          setFetchedPourSteps(payload.pourSteps);
        }
      } catch {
        if (!cancelled) {
          setFetchedPourSteps([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPourSteps(false);
        }
      }
    };

    loadPourSteps();

    return () => {
      cancelled = true;
    };
  }, [isManagedRecipe, pourSteps.length, xbloomUrl]);

  const displayPourSteps = pourSteps.length > 0 ? pourSteps : fetchedPourSteps;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#02050B]/84 p-4 backdrop-blur-md">
      <div className="hide-scrollbar relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[30px] border border-white/10 bg-[#0B101A] text-[#EAEAEA] shadow-[0_40px_140px_rgba(0,0,0,0.56)]">
        <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0B101A]/92 px-6 py-5 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <button
              type="button"
              onClick={onClose}
              className="mt-1 text-[#EAEAEA]/68 transition hover:text-[#EAEAEA]"
            >
              <CloseIcon />
            </button>
            <div className="text-right">
              <p className="text-[11px] font-bold tracking-[0.18em] text-[#EAEAEA]/34">
                {roaster.name}
              </p>
              <h2 className="mt-3 text-3xl font-bold leading-[1.12] text-white sm:text-4xl">
                {recipe.name}
              </h2>
              {summary ? (
                <p className="mt-3 max-w-2xl text-sm font-bold leading-7 text-white/58">
                  {summary}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden px-6 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={roaster.coverImage}
            alt={recipe.name}
            className="h-[240px] w-full rounded-[26px] object-cover opacity-58"
          />
          <div className="absolute inset-x-6 top-6 h-[240px] rounded-[26px] bg-[linear-gradient(180deg,rgba(8,13,22,0.18),rgba(8,13,22,0.78))]" />
        </div>

        <div className="px-6 py-6">
          <div className="grid gap-3 md:grid-cols-3">
            {extraRows.map(([label, value]) => (
              <div
                key={label}
                className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4"
              >
                <p className="text-xs font-bold text-white/38">{label}</p>
                <p className="mt-2 text-base font-bold text-white">{value}</p>
              </div>
            ))}
          </div>

          <section className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-end justify-between gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-white/42">الصبات</p>
              </div>
              <div className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-xs font-bold text-white/58">
                {isLoadingPourSteps
                  ? "جارٍ جلب الصبات..."
                  : displayPourSteps.length > 0
                    ? `${displayPourSteps.length} صبات`
                    : "لا توجد بيانات صبات"}
              </div>
            </div>

            {displayPourSteps.length > 0 ? (
              <div className="mt-6 grid gap-3 lg:grid-cols-3">
                {displayPourSteps.map((pour, index) => (
                  <article
                    key={`${pour.name}-${index + 1}`}
                    className="overflow-hidden rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))]"
                  >
                    <div className="border-b border-white/8 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-white">
                          {getLocalizedPourName(pour.name, index)}
                        </p>
                        <span className="text-xs font-bold text-white/36">
                          {numberFormat.format(index + 1)}
                        </span>
                      </div>
                    </div>

                    <div className="px-4 py-4">
                      <div className="grid h-24 place-items-center rounded-[18px] bg-white/[0.04]">
                        <p className="text-[28px] font-bold tracking-[-0.04em] text-white">
                          {pour.volumeMl
                            ? `${numberFormat.format(pour.volumeMl)} مل`
                            : "--"}
                        </p>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-[16px] border border-white/8 bg-white/[0.025] px-3 py-3 text-center">
                          <p className="text-[11px] font-bold text-white/38">الحرارة</p>
                          <p className="mt-2 text-sm font-bold text-white">
                            {pour.temperatureC
                              ? `${numberFormat.format(pour.temperatureC)}°`
                              : "--"}
                          </p>
                        </div>
                        <div className="rounded-[16px] border border-white/8 bg-white/[0.025] px-3 py-3 text-center">
                          <p className="text-[11px] font-bold text-white/38">الثواني</p>
                          <p className="mt-2 text-sm font-bold text-white">
                            {pour.seconds
                              ? `${numberFormat.format(pour.seconds)} ث`
                              : "--"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : isLoadingPourSteps ? (
              <div className="mt-6 rounded-[20px] border border-white/8 bg-white/[0.025] px-4 py-5 text-center text-sm font-bold text-white/46">
                جارٍ سحب بيانات الصبات من xBloom...
              </div>
            ) : (
              <div className="mt-6 rounded-[20px] border border-white/8 bg-white/[0.025] px-4 py-5 text-center text-sm font-bold text-white/46">
                لا توجد بيانات تفصيلية للصبات لهذه الوصفة.
              </div>
            )}
          </section>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            {xbloomUrl ? (
              <XbloomTrackedLink
                href={xbloomUrl}
                recipeSlug={recipe.slug}
                className="rounded-full border border-white/12 bg-white/[0.06] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[0.1]"
              >
                دخول xBloom
              </XbloomTrackedLink>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ManagedRoasterPage({
  slug,
  initialRoaster,
  initialRoasters,
  initialRecipes,
}: ManagedRoasterPageProps) {
  const [selectedRecipe, setSelectedRecipe] = useState<RoasterPageRecipe | null>(null);
  const [recipeQuery, setRecipeQuery] = useState("");
  const [approvedOnly, setApprovedOnly] = useState(false);
  const [coldOnly, setColdOnly] = useState(false);
  const [hotOnly, setHotOnly] = useState(false);
  const [recipesPage, setRecipesPage] = useState(1);
  const roaster =
    initialRoaster ??
    initialRoasters.find((storedRoaster) => storedRoaster.slug === slug) ??
    {
      slug,
      name: decodeURIComponent(slug).replace(/-/g, " "),
      shortName: decodeURIComponent(slug).replace(/-/g, " "),
      description: "يمكنك إضافة وصفات لهذه المحمصة من لوحة الإدارة لاحقًا.",
      about: "",
      location: "محمصة جديدة",
      logo: "JR",
      coverImage: "",
      accent: "#A06B42",
      featured: false,
    };
  const roasterLocationLabel = roaster.location?.trim();
  const showRoasterLocation =
    !!roasterLocationLabel &&
    roasterLocationLabel !== "غير محدد" &&
    roasterLocationLabel !== "محمصة جديدة";
  const roasterDescriptionLabel = roaster.description?.trim();
  const showRoasterDescription =
    !!roasterDescriptionLabel &&
    roasterDescriptionLabel !== "محمصة جديدة قيد التحرير." &&
    roasterDescriptionLabel !== "يمكنك إضافة وصفات لهذه المحمصة من لوحة الإدارة لاحقًا.";

  const roasterRecipes = useMemo(
    () => (initialRoaster ? initialRecipes : []),
    [initialRecipes, initialRoaster],
  );
  const orderedRoasterRecipes = useMemo(
    () => orderRoasterRecipes(roasterRecipes),
    [roasterRecipes],
  );
  const filteredRoasterRecipes = useMemo(() => {
    const query = recipeQuery.trim().toLowerCase();
    return orderedRoasterRecipes.filter((recipe) => {
      const matchesApproved =
        !approvedOnly || (isManagedRoasterRecipe(recipe) && recipe.isRoasterApproved);

      const heatClass = getRecipeHeatClass(recipe);
      const heatFilterEnabled = coldOnly || hotOnly;
      const matchesHeat = !heatFilterEnabled || (coldOnly && heatClass === "cold") || (hotOnly && heatClass === "hot");

      const matchesQuery = !query || (() => {
        if (isManagedRoasterRecipe(recipe)) {
          return [
            recipe.name,
            recipe.authorName,
            recipe.brewer,
            recipe.brewType,
            recipe.ratio,
          ]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(query));
        }

        return [
          recipe.name,
          recipe.method,
          recipe.summary,
          recipe.tools.join(" "),
        ]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
      })();

      return matchesApproved && matchesHeat && matchesQuery;
    });
  }, [approvedOnly, coldOnly, hotOnly, orderedRoasterRecipes, recipeQuery]);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredRoasterRecipes.length / ROASTER_RECIPES_PER_PAGE),
  );
  const currentRecipesPage = Math.min(recipesPage, totalPages);
  const paginatedFilteredRoasterRecipes = useMemo(() => {
    const start = (currentRecipesPage - 1) * ROASTER_RECIPES_PER_PAGE;
    return filteredRoasterRecipes.slice(start, start + ROASTER_RECIPES_PER_PAGE);
  }, [currentRecipesPage, filteredRoasterRecipes]);

  const filterButtonClass = (active: boolean) =>
    `rounded-[12px] border px-3 py-2 text-xs font-bold transition ${
      active
        ? "border-white/22 bg-white/[0.12] text-[var(--page-fg)]"
        : "border-[color:var(--page-line)] bg-transparent text-[var(--page-muted)] hover:border-[color:var(--page-line-strong)] hover:text-[var(--page-fg)]"
    }`;
  const visibleCount = filteredRoasterRecipes.length;
  const totalCount = orderedRoasterRecipes.length;
  const startItemNumber =
    visibleCount === 0 ? 0 : (currentRecipesPage - 1) * ROASTER_RECIPES_PER_PAGE + 1;
  const endItemNumber = Math.min(currentRecipesPage * ROASTER_RECIPES_PER_PAGE, visibleCount);
  const visibleStart = new Intl.NumberFormat("ar-EG").format(startItemNumber);
  const visibleEnd = new Intl.NumberFormat("ar-EG").format(endItemNumber);
  const totalEnd = new Intl.NumberFormat("ar-EG").format(totalCount);

  return (
    <main className="theme-page page-shell min-h-screen">
      <NavBar tone="dark" />

      <section className="relative flex min-h-[54svh] items-end overflow-hidden px-5 pt-32 pb-20 sm:px-8">
        {roaster.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={roaster.coverImage}
            alt={`${roaster.name} كهوية محمصة`}
            className="absolute inset-0 h-full w-full scale-105 object-cover opacity-76"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-[#080D16]/34 via-[#080D16]/52 to-[#080D16]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(234,234,234,0.12),transparent_28%)]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <div className="max-w-3xl">
            {showRoasterLocation ? (
              <p className="text-sm font-bold text-[var(--page-muted)]">
                {roasterLocationLabel}
              </p>
            ) : null}
            <h1 className="mt-4 text-5xl font-bold leading-[1.1] tracking-[0] text-[var(--page-fg)] sm:text-7xl">
              {roaster.name}
            </h1>
            {showRoasterDescription ? (
              <p className="mt-6 max-w-2xl text-lg leading-9 text-[var(--page-muted)]">
                {roasterDescriptionLabel}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="theme-surface relative z-10 -mt-8 grid min-h-16 items-center gap-4 rounded-[20px] px-4 py-4 backdrop-blur-xl md:grid-cols-[1fr_auto_1fr] md:px-6">
            <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
              <div className="theme-surface-soft flex items-center gap-2 rounded-[14px] px-3 py-2 text-sm font-bold text-[var(--page-muted)]">
                <span>24 وصفة لكل صفحة</span>
              </div>

              <label className="theme-surface-soft flex h-10 w-full max-w-[260px] items-center gap-2 rounded-[14px] px-3 text-[var(--page-muted)] transition duration-200 hover:brightness-105">
                <SearchIcon />
                <input
                  value={recipeQuery}
                  onChange={(event) => {
                    setRecipeQuery(event.target.value);
                    setRecipesPage(1);
                  }}
                  placeholder="ابحث داخل المحمصة"
                  className="h-full w-full bg-transparent text-sm font-bold text-[var(--page-fg)] outline-none placeholder:text-[var(--page-soft)]"
                  aria-label="ابحث داخل المحمصة"
                />
              </label>
            </div>

            <p className="text-center text-sm font-bold text-[var(--page-muted)]">
              عرض {visibleStart}–{visibleEnd} من {totalEnd} وصفة
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
              <span className="text-xs font-bold text-[var(--page-muted)]">تصفية النتائج :</span>
              <button
                type="button"
                onClick={() => {
                  setApprovedOnly((current) => !current);
                  setRecipesPage(1);
                }}
                className={filterButtonClass(approvedOnly)}
              >
                معتمدة من المحمصة
              </button>
              <button
                type="button"
                onClick={() => {
                  setColdOnly((current) => !current);
                  setRecipesPage(1);
                }}
                className={filterButtonClass(coldOnly)}
              >
                بارد
              </button>
              <button
                type="button"
                onClick={() => {
                  setHotOnly((current) => !current);
                  setRecipesPage(1);
                }}
                className={filterButtonClass(hotOnly)}
              >
                حار
              </button>
            </div>
          </div>

          {filteredRoasterRecipes.length > 0 ? (
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginatedFilteredRoasterRecipes.map((recipe, index) => (
                <RecipeExploreCard
                  key={recipe.slug}
                  group={{
                    key: recipe.slug,
                    name: recipe.name,
                    recipes: [recipe],
                  }}
                  index={(currentRecipesPage - 1) * ROASTER_RECIPES_PER_PAGE + index}
                  roasterImage={roaster.coverImage}
                  onPreview={setSelectedRecipe}
                  onPickVariant={() => {
                    // الدمج متوقف الآن: كل وصفة تظهر ككرت مستقل.
                  }}
                />
              ))}
            </div>
          ) : totalCount > 0 ? (
            <div className="theme-surface mt-12 rounded-[26px] p-8 text-center backdrop-blur-xl">
              <h2 className="text-3xl font-bold">لا توجد نتائج مطابقة</h2>
              <p className="mt-3 text-sm font-bold text-[var(--page-muted)]">
                جرّب كلمة بحث مختلفة داخل وصفات هذه المحمصة.
              </p>
            </div>
          ) : (
            <div className="theme-surface mt-12 rounded-[26px] p-8 text-center backdrop-blur-xl">
              <h2 className="text-3xl font-bold">لا يوجد وصفة لهذه المحمصة</h2>
              <p className="mt-3 text-sm font-bold text-[var(--page-muted)]">
                يمكنك إضافة وصفات لها لاحقًا من لوحة الإدارة.
              </p>
            </div>
          )}

          {filteredRoasterRecipes.length > ROASTER_RECIPES_PER_PAGE ? (
            <div className="theme-surface mt-5 flex items-center justify-between rounded-[18px] px-4 py-3">
              <p className="text-xs font-bold text-[var(--page-muted)]">
                صفحة {new Intl.NumberFormat("ar-EG").format(currentRecipesPage)} من{" "}
                {new Intl.NumberFormat("ar-EG").format(totalPages)}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRecipesPage(Math.max(1, currentRecipesPage - 1))}
                  disabled={currentRecipesPage <= 1}
                  className="rounded-[10px] border border-[color:var(--page-line)] px-3 py-1.5 text-xs font-bold text-[var(--page-fg)] transition hover:bg-[var(--page-fg)] hover:text-[var(--page-bg)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  السابق
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRecipesPage(Math.min(totalPages, currentRecipesPage + 1))
                  }
                  disabled={currentRecipesPage >= totalPages}
                  className="rounded-[10px] border border-[color:var(--page-line)] px-3 py-1.5 text-xs font-bold text-[var(--page-fg)] transition hover:bg-[var(--page-fg)] hover:text-[var(--page-bg)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  التالي
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {selectedRecipe ? (
        <RecipePreviewModal
          recipe={selectedRecipe}
          roaster={roaster}
          onClose={() => setSelectedRecipe(null)}
        />
      ) : null}
    </main>
  );
}
