import Image from "next/image";
import Link from "next/link";
import {
  difficultyLabels,
  getRoasterForRecipe,
  methodLabels,
  type Recipe,
} from "@/lib/data";

type RecipeCardProps = {
  recipe: Recipe;
  variant?: "standard" | "masonry" | "wide";
};

export function RecipeCard({ recipe, variant = "standard" }: RecipeCardProps) {
  const roaster = getRoasterForRecipe(recipe);
  const isWide = variant === "wide";
  const isMasonry = variant === "masonry";

  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className={`group block text-right transition duration-300 hover:-translate-y-1 ${
        isWide ? "grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-center" : ""
      }`}
    >
      <div
        className={`studio-card relative overflow-hidden rounded-[2rem] bg-[var(--surface)] ${
          isWide
            ? "aspect-[16/10]"
            : isMasonry
              ? "aspect-[4/5] even:aspect-[4/3]"
              : "aspect-[4/3]"
        }`}
      >
        <Image
          src={recipe.image}
          alt={recipe.name}
          fill
          sizes="(max-width: 768px) 94vw, 33vw"
          className="object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/44 via-transparent to-transparent opacity-80" />
        <span className="glass absolute bottom-4 right-4 rounded-full px-4 py-2 text-xs font-black text-[#EAEAEA]">
          {methodLabels[recipe.method]}
        </span>
      </div>
      <div className={isWide ? "md:pr-2" : "mt-5"}>
        <p className="text-sm font-bold text-[var(--accent)]">
          {isMasonry
            ? `${recipe.brewTime} د`
            : `${roaster?.name} · ${recipe.brewTime} د · ${
                difficultyLabels[recipe.difficulty]
              }`}
        </p>
        <h3
          className={`mt-3 font-bold leading-tight tracking-[0] text-[var(--foreground)] ${
            isWide ? "text-4xl sm:text-5xl" : "text-2xl sm:text-3xl"
          }`}
        >
          {recipe.name}
        </h3>
        {!isMasonry && (
          <p className="mt-4 max-w-xl text-base leading-8 text-[var(--muted)]">
            {recipe.summary}
          </p>
        )}
      </div>
    </Link>
  );
}
