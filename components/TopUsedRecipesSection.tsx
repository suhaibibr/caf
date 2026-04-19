"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { XbloomTrackedLink } from "@/components/XbloomTrackedLink";

export type TopRecipeUsageCard = {
  slug: string;
  name: string;
  roasterName: string;
  href: string;
  xbloomUrl: string;
  image: string;
  shortLabel: string;
  clicks: number;
};

type TopUsedRecipesSectionProps = {
  initialItems: TopRecipeUsageCard[];
  catalog: Omit<TopRecipeUsageCard, "clicks">[];
};

type TopClickEntry = {
  recipeSlug: string;
  clicks: number;
};

const REFRESH_MS = 12000;

export function TopUsedRecipesSection({
  initialItems,
  catalog,
}: TopUsedRecipesSectionProps) {
  const [items, setItems] = useState(initialItems);

  const catalogMap = useMemo(
    () => new Map(catalog.map((item) => [item.slug, item])),
    [catalog],
  );

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const response = await fetch("/api/xbloom-clicks?limit=5", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { top?: TopClickEntry[] };
        if (!Array.isArray(payload.top) || cancelled) {
          return;
        }

        const next = payload.top
          .map((entry) => {
            const base = catalogMap.get(entry.recipeSlug);
            if (!base) {
              return null;
            }

            return {
              ...base,
              clicks: entry.clicks,
            };
          })
          .filter((entry): entry is TopRecipeUsageCard => entry !== null);

        if (next.length > 0) {
          setItems(next);
        }
      } catch {
        // Ignore refresh errors to keep UI stable.
      }
    };

    const interval = window.setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [catalogMap]);

  return (
    <section className="relative px-5 pb-12 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="reveal px-0 py-1">
          <div className="relative flex flex-wrap items-end justify-between gap-3 px-1">
            <h2 className="text-xl font-black tracking-tight text-[var(--page-fg)] sm:text-2xl">
              اعلى 5 وصفات استخدام
            </h2>
          </div>

          {items.length > 0 ? (
            <ol className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-1 touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:gap-2 lg:overflow-visible lg:pr-0">
              {items.map((recipe, index) => (
                <li
                  key={recipe.slug}
                  className={`group relative shrink-0 snap-start ${
                    index === 0
                      ? "w-[274px] sm:w-[286px] lg:w-[206px]"
                      : "w-[232px] sm:w-[244px] lg:w-[184px]"
                  }`}
                >
                  <article
                    className={`relative isolate block overflow-hidden rounded-[18px] border bg-white/[0.05] shadow-[0_14px_36px_rgba(0,0,0,0.44)] backdrop-blur-xl transition duration-300 ease-out hover:scale-[1.02] hover:brightness-110 ${
                      index === 0
                        ? "h-[298px] border-[#EAC999]/44 shadow-[0_16px_42px_rgba(0,0,0,0.48),0_0_20px_rgba(255,210,130,0.16)] lg:h-[236px]"
                        : "h-[268px] border-white/14 lg:h-[214px]"
                    }`}
                  >
                    <span className="pointer-events-none absolute -bottom-6 left-2 z-10 text-[88px] font-black leading-none tracking-[-0.05em] text-white/16 lg:text-[62px]">
                      {index + 1}
                    </span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={recipe.image}
                      alt={recipe.name}
                      className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.04] group-hover:brightness-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,8,14,0.28)_0%,rgba(6,8,14,0.62)_46%,rgba(4,6,11,0.96)_100%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,255,255,0.18),transparent_30%)]" />
                    <div className="absolute inset-1.5 rounded-[14px] border border-white/10" />
                    <div className="absolute inset-x-3 bottom-3 z-20">
                      <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white/88 backdrop-blur-xl lg:text-[8px]">
                        {recipe.shortLabel}
                      </span>
                      <Link
                        href={recipe.href}
                        className="mt-1.5 block line-clamp-2 text-[16px] font-black leading-[1.15] tracking-[0.01em] text-white lg:text-[13px]"
                      >
                        {recipe.name}
                      </Link>
                      <p className="mt-0.5 truncate text-[10px] font-bold text-white/64 lg:text-[9px]">
                        {recipe.roasterName}
                      </p>
                      <XbloomTrackedLink
                        href={recipe.xbloomUrl}
                        recipeSlug={recipe.slug}
                        className="mt-2 inline-flex items-center rounded-full border border-white/20 bg-black/25 px-2 py-0.5 text-[10px] font-bold text-white/84 backdrop-blur-xl transition duration-200 hover:bg-white/[0.16] lg:text-[9px]"
                      >
                        دخول xBloom
                      </XbloomTrackedLink>
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm font-bold text-[var(--page-muted)]">
              لا توجد إحصائيات ضغطات xBloom حتى الآن.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
