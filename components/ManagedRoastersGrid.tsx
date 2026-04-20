"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchStoredRoasters,
  subscribeToStoredRoasters,
} from "@/lib/admin-roasters-storage";
import type { Roaster } from "@/lib/data";
import {
  MISC_RECIPES_ROASTER_SLUG,
  appendMiscRecipesRoaster,
} from "@/lib/misc-recipes-roaster";
import { RoasterCard } from "@/components/RoasterCard";

type ManagedRoastersGridProps = {
  initialRoasters: Roaster[];
};

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

export function ManagedRoastersGrid({
  initialRoasters,
}: ManagedRoastersGridProps) {
  const initialMiscRoaster =
    initialRoasters.find((roaster) => roaster.slug === MISC_RECIPES_ROASTER_SLUG) ?? null;
  const [roasters, setRoasters] = useState(initialRoasters);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const nextRoasters = await fetchStoredRoasters();
        if (!cancelled) {
          setRoasters(
            appendMiscRecipesRoaster(nextRoasters, {
              recipeCount: initialMiscRoaster?.recipeCount ?? 0,
              approvedRecipeCount: initialMiscRoaster?.approvedRecipeCount ?? 0,
            }),
          );
        }
      } catch {
        if (!cancelled) {
          setRoasters(initialRoasters);
        }
      }
    };

    void load();

    const unsubscribe = subscribeToStoredRoasters(() => {
      void load();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [initialRoasters, initialMiscRoaster?.approvedRecipeCount, initialMiscRoaster?.recipeCount]);

  const filteredRoasters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return roasters;
    }

    return roasters.filter((roaster) =>
      [roaster.name, roaster.shortName, roaster.location]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  }, [query, roasters]);

  if (roasters.length === 0) {
    return (
      <div className="theme-surface rounded-[24px] px-6 py-12 text-center text-sm font-bold text-[var(--page-muted)]">
        لا توجد محامص لعرضها الآن.
      </div>
    );
  }

  return (
    <div>
      <div className="theme-input mb-6 flex h-11 w-full max-w-md items-center gap-3 rounded-[18px] px-4 text-[var(--page-soft)] transition duration-300 focus-within:border-[color:var(--page-line-strong)]">
        <SearchIcon />
        <input
          aria-label="ابحث عن محمصة"
          placeholder="ابحث عن محمصة"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-full flex-1 bg-transparent text-sm font-bold text-[var(--page-fg)] outline-none placeholder:text-[var(--page-input-placeholder)]"
        />
      </div>

      {filteredRoasters.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredRoasters.map((roaster, index) => (
            <div key={roaster.slug}>
              <RoasterCard roaster={roaster} priority={index === 0} />
            </div>
          ))}
        </div>
      ) : (
        <div className="theme-surface rounded-[24px] px-6 py-12 text-center text-sm font-bold text-[var(--page-muted)]">
          لا توجد محامص مطابقة لبحثك.
        </div>
      )}
    </div>
  );
}
