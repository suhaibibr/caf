"use client";

import { useMemo, useState } from "react";
import { RecipeCard } from "@/components/RecipeCard";
import { RoasterCard } from "@/components/RoasterCard";
import {
  difficultyLabels,
  methodLabels,
  recipes,
  roasters,
  type BrewMethod,
  type Difficulty,
} from "@/lib/data";

const methods: Array<"All" | BrewMethod> = [
  "All",
  "Espresso",
  "Filter",
  "Cold Brew",
];

const difficulties: Array<"All" | Difficulty> = [
  "All",
  "Easy",
  "Medium",
  "Advanced",
];

const times = [
  { label: "أي وقت", value: 0 },
  { label: "أقل من 4 دقائق", value: 4 },
  { label: "أقل من 6 دقائق", value: 6 },
  { label: "تحضير طويل", value: 12 },
];

export function SearchExplorer() {
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<(typeof methods)[number]>("All");
  const [difficulty, setDifficulty] =
    useState<(typeof difficulties)[number]>("All");
  const [time, setTime] = useState(0);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const roaster = roasters.find((item) => item.slug === recipe.roasterSlug);
      const haystack = [
        recipe.name,
        recipe.summary,
        recipe.method,
        methodLabels[recipe.method],
        difficultyLabels[recipe.difficulty],
        roaster?.name,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (method === "All" || recipe.method === method) &&
        (difficulty === "All" || recipe.difficulty === difficulty) &&
        (!time || recipe.brewTime <= time)
      );
    });
  }, [difficulty, method, normalizedQuery, time]);

  const filteredRoasters = useMemo(() => {
    return roasters.filter((roaster) =>
      [roaster.name, roaster.description, roaster.location]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [normalizedQuery]);

  return (
    <section
      id="recipes"
      className="relative overflow-hidden bg-[var(--surface)] py-24 sm:py-32"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(139,94,60,0.16),transparent_32%),radial-gradient(circle_at_82%_70%,rgba(255,255,255,0.28),transparent_28%)] dark:bg-[radial-gradient(circle_at_18%_12%,rgba(139,94,60,0.2),transparent_32%)]" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="reveal glass rounded-[2rem] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="text-right">
              <p className="text-sm font-bold text-[var(--accent)]">
                البحث والفلاتر
              </p>
              <h2 className="mt-3 max-w-3xl text-4xl font-bold tracking-[0] text-[var(--foreground)] sm:text-5xl">
                اختر الوصفة حسب المزاج، الوقت، وطريقة التحضير.
              </h2>
            </div>
            <div className="w-full max-w-xl">
              <label className="sr-only" htmlFor="search">
                البحث في الوصفات والمحامص
              </label>
              <input
                id="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث عن وصفة، محمصة، أو طريقة تحضير"
                className="glass-soft h-14 w-full rounded-full px-6 text-base text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4">
            <FilterRow
              label="التحضير"
              options={methods}
              value={method}
              onChange={setMethod}
              format={(option) =>
                option === "All" ? "الكل" : methodLabels[option]
              }
            />
            <FilterRow
              label="الصعوبة"
              options={difficulties}
              value={difficulty}
              onChange={setDifficulty}
              format={(option) =>
                option === "All" ? "الكل" : difficultyLabels[option]
              }
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="ms-2 min-w-20 text-sm font-bold text-[var(--muted)]">
                الوقت
              </span>
              {times.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setTime(option.value)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition hover:scale-[1.02] ${
                    time === option.value
                      ? "bg-[var(--foreground)] text-[var(--background)]"
                      : "glass-soft text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="reveal mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredRecipes.map((recipe) => (
            <RecipeCard key={recipe.slug} recipe={recipe} />
          ))}
        </div>

        {filteredRoasters.length > 0 && normalizedQuery && (
          <div className="reveal mt-16">
            <h3 className="text-2xl font-bold text-[var(--foreground)]">
              محامص مطابقة
            </h3>
            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredRoasters.map((roaster) => (
                <RoasterCard key={roaster.slug} roaster={roaster} />
              ))}
            </div>
          </div>
        )}

        {filteredRecipes.length === 0 && (
          <p className="glass-soft mt-12 rounded-3xl p-6 text-base text-[var(--muted)]">
            لا توجد وصفات مطابقة لهذا البحث حاليًا.
          </p>
        )}
      </div>
    </section>
  );
}

type FilterRowProps<T extends string> = {
  label: string;
  options: T[];
  value: T;
  onChange: (value: T) => void;
  format: (value: T) => string;
};

function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
  format,
}: FilterRowProps<T>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="ms-2 min-w-20 text-sm font-bold text-[var(--muted)]">
        {label}
      </span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-full px-4 py-2 text-sm font-bold transition hover:scale-[1.02] ${
            value === option
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "glass-soft text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          {format(option)}
        </button>
      ))}
    </div>
  );
}
