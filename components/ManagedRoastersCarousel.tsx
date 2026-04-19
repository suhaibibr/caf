"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchStoredRoasters,
  subscribeToStoredRoasters,
} from "@/lib/admin-roasters-storage";
import type { Roaster } from "@/lib/data";
import { RoasterCarousel } from "@/components/RoasterCarousel";

type ManagedRoastersCarouselProps = {
  initialRoasters: Roaster[];
  heading?: string;
  showSearch?: boolean;
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

export function ManagedRoastersCarousel({
  initialRoasters,
  heading,
  showSearch = false,
}: ManagedRoastersCarouselProps) {
  const [roasters, setRoasters] = useState(initialRoasters);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const nextRoasters = await fetchStoredRoasters();
        if (!cancelled) {
          setRoasters(nextRoasters);
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
  }, [initialRoasters]);

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
      <div className="theme-surface mt-7 rounded-[22px] px-6 py-10 text-center text-sm font-bold text-[var(--page-muted)]">
        لا توجد محامص مضافة حاليًا.
      </div>
    );
  }

  return (
    <div>
      {heading || showSearch ? (
        <div className="reveal mx-auto flex max-w-5xl flex-col items-center justify-center gap-4 md:flex-row md:justify-center md:gap-5">
          {heading ? (
            <h2 className="text-center text-2xl font-bold leading-tight text-[var(--page-fg)] sm:text-3xl">
              {heading}
            </h2>
          ) : null}

          {showSearch ? (
            <div className="theme-input flex h-11 w-full max-w-md items-center gap-3 rounded-[18px] px-4 text-[var(--page-soft)] transition duration-300 focus-within:border-[color:var(--page-line-strong)] md:w-[340px]">
              <SearchIcon />
              <input
                aria-label="ابحث عن محمصة"
                placeholder="ابحث عن محمصة"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-full flex-1 bg-transparent text-sm font-bold text-[var(--page-fg)] outline-none placeholder:text-[var(--page-input-placeholder)]"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {filteredRoasters.length > 0 ? (
        <RoasterCarousel roasters={filteredRoasters} />
      ) : (
        <div className="theme-surface mt-7 rounded-[22px] px-6 py-10 text-center text-sm font-bold text-[var(--page-muted)]">
          لا توجد محامص مطابقة لبحثك.
        </div>
      )}
    </div>
  );
}
