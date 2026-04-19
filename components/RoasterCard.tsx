import { getRecipesByRoaster, type Roaster } from "@/lib/data";

type RoasterCardProps = {
  roaster: Roaster;
  priority?: boolean;
  index?: number;
  className?: string;
};

export function RoasterCard({
  roaster,
  priority = false,
  className = "",
}: RoasterCardProps) {
  const recipeCount = roaster.recipeCount ?? getRecipesByRoaster(roaster.slug).length;
  const approvedRecipeCount = roaster.approvedRecipeCount ?? 0;
  const recipeCountLabel = new Intl.NumberFormat("ar-EG").format(recipeCount);
  const approvedRecipeCountLabel = new Intl.NumberFormat("ar-EG").format(approvedRecipeCount);

  return (
    <a
      href={`/roasters/${roaster.slug}`}
      className={`theme-card group relative flex h-full min-h-[232px] flex-col overflow-hidden rounded-[22px] transition duration-300 hover:-translate-y-1 ${className}`}
    >
      <div className="relative h-[122px] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={roaster.coverImage}
          alt={roaster.name}
          className="h-full w-full object-cover opacity-76 saturate-[0.86] transition duration-300 group-hover:scale-[1.06] group-hover:opacity-95"
          loading={priority ? "eager" : "lazy"}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-black/50 dark:via-[#020617]/8 dark:to-[#080D16]/72" />
      </div>

      <div className="relative flex flex-1 flex-col items-center px-4 pb-4 pt-3 text-center">
        <h3 className="text-[17px] font-bold leading-tight text-[var(--page-fg)]">
          {roaster.name}
        </h3>
        <p
          dir="rtl"
          className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold text-[var(--page-muted)]"
        >
          <span>{recipeCountLabel}</span>
          <span>وصفة</span>
          <span className="text-[var(--page-soft)]">|</span>
          <span>{approvedRecipeCountLabel}</span>
          <span>معتمدة</span>
        </p>

        <div className="mt-auto pt-3">
          <div className="rounded-full border border-[color:var(--page-line-strong)] bg-[var(--page-card-button-bg)] px-4 py-2 text-center text-[12px] font-bold text-[var(--page-card-button-text)] transition duration-300 group-hover:scale-[1.02] group-hover:brightness-110">
            وصفات المحمصة
          </div>
        </div>
      </div>
    </a>
  );
}
