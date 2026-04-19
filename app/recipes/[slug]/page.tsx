import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { XbloomTrackedLink } from "@/components/XbloomTrackedLink";
import {
  difficultyLabels,
  getRecipe,
  getRoasterForRecipe,
} from "@/lib/data";
import { getRoasterBySlug } from "@/lib/roasters-db";
import { getManagedRecipeBySlug } from "@/lib/recipes-db";

type RecipePageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

function normalizeSlug(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export async function generateMetadata({
  params,
}: RecipePageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);
  const recipe = getRecipe(slug);
  const managedRecipe = recipe ? null : await getManagedRecipeBySlug(slug);

  if (!recipe && !managedRecipe) {
    return {};
  }

  return {
    title: `${recipe?.name ?? managedRecipe?.name} | كــاف`,
    description:
      recipe?.summary ??
      `وصفة ${managedRecipe?.name ?? ""} من ${managedRecipe?.authorName ?? "كــاف"}`,
  };
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { slug: rawSlug } = await params;
  const slug = normalizeSlug(rawSlug);
  const recipe = getRecipe(slug);

  if (!recipe) {
    const managedRecipe = await getManagedRecipeBySlug(slug);

    if (!managedRecipe) {
      notFound();
    }

    const roaster = managedRecipe.roasterSlug
      ? await getRoasterBySlug(managedRecipe.roasterSlug)
      : null;

    return (
      <main className="theme-page page-shell min-h-screen">
        <NavBar tone="dark" />

        <section className="relative flex min-h-[60svh] items-end overflow-hidden px-5 pt-32 pb-12 sm:px-8">
          {roaster?.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={roaster.coverImage}
              alt={managedRecipe.name}
              className="absolute inset-0 h-full w-full scale-105 object-cover opacity-70"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-[#080D16]/24 via-[#080D16]/44 to-[#080D16]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_24%,rgba(12,182,176,0.16),transparent_28%)]" />
          <div className="relative z-10 mx-auto w-full max-w-7xl">
            <div className="max-w-4xl rounded-[32px] border border-[color:var(--page-line)] bg-[var(--page-surface)] p-7 shadow-[var(--page-shadow)] backdrop-blur-xl sm:p-10">
              <p className="text-sm font-bold text-[var(--page-muted)]">
                {managedRecipe.roasterName || roaster?.name || "وصفة جديدة"}
              </p>
              <h1 className="mt-4 text-5xl font-bold leading-[1.08] text-[var(--page-fg)] sm:text-7xl">
                {managedRecipe.name}
              </h1>
              <div className="mt-6 flex flex-wrap gap-3 text-sm font-bold text-[var(--page-muted)]">
                <span>{managedRecipe.authorName}</span>
                <span>·</span>
                <span>{managedRecipe.brewer}</span>
                <span>·</span>
                <span>
                  {managedRecipe.brewType === "cold"
                    ? "وصفة باردة"
                    : managedRecipe.brewType === "filter"
                      ? "غسيل الفلتر"
                      : "وصفة حارة"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-5 lg:grid-cols-2">
              {[
                [
                  "كمية البن",
                  managedRecipe.brewType === "cold" && managedRecipe.iceGrams
                    ? `${managedRecipe.grams} جرام قهوة · ${managedRecipe.iceGrams} جرام ثلج`
                    : `${managedRecipe.grams} جرام`,
                ],
                ["الأداة", managedRecipe.brewer],
                ["النسبة", managedRecipe.ratio],
                [
                  "عدد الصبات",
                  managedRecipe.pourCount ? `${managedRecipe.pourCount}` : "غير متوفر",
                ],
                [
                  "درجة الحرارة",
                  managedRecipe.firstPourTemperature
                    ? `${managedRecipe.firstPourTemperature}°`
                    : "غير متوفرة",
                ],
                [
                  "كمية الماء",
                  managedRecipe.waterMl
                    ? `${managedRecipe.waterMl} مل`
                    : "حسب الوصفة",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="theme-surface rounded-[24px] p-6 backdrop-blur-xl"
                >
                  <p className="text-sm font-bold text-[var(--page-soft)]">{label}</p>
                  <p className="mt-3 text-2xl font-bold text-[var(--page-fg)]">{value}</p>
                </div>
              ))}
            </div>

            <div className="theme-surface mt-6 rounded-[28px] p-7 backdrop-blur-xl">
              <p className="text-sm font-bold text-[var(--page-soft)]">رابط xBloom</p>
              <XbloomTrackedLink
                href={managedRecipe.xbloomUrl}
                recipeSlug={managedRecipe.slug}
                className="mt-4 inline-flex rounded-full bg-[var(--page-card-button-bg)] px-5 py-3 text-sm font-bold text-[var(--page-card-button-text)] transition hover:brightness-105"
              >
                افتح وصفة xBloom
              </XbloomTrackedLink>
              <p className="mt-4 break-all text-sm font-bold text-[var(--page-muted)]">
                {managedRecipe.xbloomUrl}
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (!recipe) {
    notFound();
  }

  const roaster = getRoasterForRecipe(recipe);
  const formatStep = (value: number) =>
    new Intl.NumberFormat("ar-EG", {
      minimumIntegerDigits: 2,
      useGrouping: false,
    }).format(value);

  return (
    <main className="page-shell min-h-screen text-[var(--foreground)]">
      <NavBar tone="dark" />
      <section className="relative flex min-h-[60svh] items-end overflow-hidden px-5 pt-32 pb-12 sm:px-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={recipe.image}
          alt={recipe.name}
          className="absolute inset-0 h-full w-full scale-105 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/8 via-black/22 to-[var(--background)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_24%,rgba(199,169,107,0.18),transparent_28%)]" />
        <div className="relative z-10 mx-auto w-full max-w-7xl">
          <div className="glass reveal max-w-4xl rounded-[2rem] p-7 sm:p-10">
            <Link
              href={roaster ? `/roasters/${roaster.slug}` : "/roasters"}
              className="text-sm font-black text-[var(--accent)] transition hover:text-[var(--accent-2)]"
            >
              {roaster?.name}
            </Link>
            <h1 className="mt-4 text-5xl font-black leading-[1.1] tracking-[0] text-[var(--foreground)] sm:text-7xl">
              {recipe.name}
            </h1>
            <div className="mt-7 flex flex-wrap gap-3 text-sm font-black text-[var(--muted)]">
              <span>{recipe.brewTime} دقائق</span>
              <span>·</span>
              <span>{difficultyLabels[recipe.difficulty]}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <p className="glass max-w-3xl rounded-[2rem] p-7 text-2xl leading-10 text-[var(--muted)]">
            {recipe.summary}
          </p>

          <div className="mt-20 grid gap-16 lg:grid-cols-2">
            <section>
              <p className="text-sm font-black text-[var(--accent)]">
                المكونات
              </p>
              <ul className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                {recipe.ingredients.map((ingredient) => (
                  <li key={ingredient} className="py-6 text-2xl font-black">
                    {ingredient}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <p className="text-sm font-black text-[var(--accent)]">الخطوات</p>
              <ol className="mt-8 space-y-10">
                {recipe.steps.map((step, index) => (
                  <li key={step} className="grid gap-5 sm:grid-cols-[72px_1fr]">
                    <span className="text-5xl font-black text-[var(--accent)]/50">
                      {formatStep(index + 1)}
                    </span>
                    <p className="text-2xl leading-10 text-[var(--muted)]">
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
