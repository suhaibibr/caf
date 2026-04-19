"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type RandomRecipeItem = {
  slug: string;
  name: string;
  image: string | null;
  href: string;
  sourceLabel: string;
  prepTimeLabel: string;
};

type RandomRecipePickerProps = {
  recipes: RandomRecipeItem[];
};

const CARD_WIDTH = 220;
const CARD_GAP = 14;
const SPIN_DURATION_MS = 3200;

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3;
}

function DiceIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="4"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="9" cy="9" r="1.3" fill="currentColor" />
      <circle cx="15" cy="15" r="1.3" fill="currentColor" />
      <circle cx="15" cy="9" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function RandomRecipePicker({ recipes }: RandomRecipePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState<RandomRecipeItem | null>(null);
  const [trackItems, setTrackItems] = useState<RandomRecipeItem[]>([]);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [centerIndex, setCenterIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const hasRecipes = recipes.length > 0;

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const startRoll = () => {
    if (!hasRecipes || isRolling) {
      return;
    }

    const baseItems =
      recipes.length >= 10
        ? recipes
        : Array.from({ length: 10 }, (_, index) => recipes[index % recipes.length]);

    const winner = baseItems[Math.floor(Math.random() * baseItems.length)];
    const loops = Math.max(8, Math.ceil(70 / baseItems.length));
    const rolledItems = Array.from({ length: loops }, () => shuffle(baseItems)).flat();
    const minWinnerIndex = Math.floor(rolledItems.length * 0.62);
    const winnerCandidates = rolledItems
      .map((item, index) => (item.slug === winner.slug ? index : -1))
      .filter((index) => index >= minWinnerIndex);
    const resolvedWinnerIndex =
      winnerCandidates[0] ?? Math.max(0, rolledItems.length - 5);

    setTrackItems(rolledItems);
    setWinnerIndex(resolvedWinnerIndex);
    setResult(null);
    setIsRolling(true);
    setIsOpen(true);
    setOffset(0);
    setCenterIndex(0);

    window.requestAnimationFrame(() => {
      const viewportWidth = viewportRef.current?.clientWidth ?? 920;
      const step = CARD_WIDTH + CARD_GAP;
      const centerOffset = (viewportWidth - CARD_WIDTH) / 2;
      const targetOffset = Math.max(0, resolvedWinnerIndex * step - centerOffset);
      const startTime = performance.now();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / SPIN_DURATION_MS);
        const eased = easeOutCubic(progress);
        const nextOffset = targetOffset * eased;

        setOffset(nextOffset);
        setCenterIndex(Math.round((nextOffset + centerOffset) / step));

        if (progress < 1) {
          rafRef.current = window.requestAnimationFrame(tick);
          return;
        }

        setOffset(targetOffset);
        setCenterIndex(resolvedWinnerIndex);
        setResult(winner);
        setIsRolling(false);
        rafRef.current = null;
      };

      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = window.requestAnimationFrame(tick);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={startRoll}
        disabled={!hasRecipes || isRolling}
        className="inline-flex items-center gap-2 rounded-[14px] border border-[#EAEAEA]/28 bg-[radial-gradient(circle_at_top_left,rgba(234,234,234,0.18),rgba(255,255,255,0.05)_42%),linear-gradient(135deg,rgba(11,18,34,0.92),rgba(8,13,22,0.96))] px-6 py-2.5 text-[12px] font-bold text-[#EAEAEA] shadow-[0_12px_36px_rgba(0,0,0,0.42)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
      >
        <DiceIcon />
        <span>وصفة عشوائية</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(17,24,39,0.82),rgba(2,6,23,0.94)_52%)] px-4 backdrop-blur-md animate-[picker-backdrop-in_220ms_ease_forwards]">
          <div className="w-full max-w-[1140px] rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(15,23,42,0.92)_0%,rgba(2,6,23,0.96)_100%)] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.58)] animate-[picker-panel-in_260ms_cubic-bezier(0.18,0.9,0.3,1)_forwards] sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-xs font-bold text-white/48">Slot Machine</p>
                <h3 className="mt-1 text-2xl font-bold text-white">
                  {isRolling ? "جاري اختيار وصفتك..." : "تم اختيار وصفتك!"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isRolling) {
                    return;
                  }
                  setIsOpen(false);
                }}
                disabled={isRolling}
                className="rounded-[12px] border border-white/14 px-3 py-2 text-xs font-bold text-white/68 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                إغلاق
              </button>
            </div>

            <div
              ref={viewportRef}
              className="relative mt-5 overflow-hidden rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(17,24,39,0.62)_0%,rgba(3,7,18,0.8)_100%)] px-3 py-4 sm:px-4"
            >
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-[#030712] via-[#030712]/86 to-transparent" />
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-[#030712] via-[#030712]/86 to-transparent" />
              <div className="pointer-events-none absolute inset-x-6 top-2 h-px bg-gradient-to-l from-transparent via-white/26 to-transparent" />
              <div className="pointer-events-none absolute inset-x-6 bottom-2 h-px bg-gradient-to-l from-transparent via-white/18 to-transparent" />
              <div className="pointer-events-none absolute inset-y-2 left-1/2 z-10 w-[220px] -translate-x-1/2 rounded-[18px] border border-[#EAEAEA]/54 bg-transparent shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_0_68px_rgba(234,234,234,0.24)]" />

              <div
                className="flex will-change-transform"
                style={{
                  gap: `${CARD_GAP}px`,
                  transform: `translate3d(${-offset}px, 0, 0)`,
                }}
              >
                {trackItems.map((recipe, index) => {
                  const distance = Math.abs(index - centerIndex);
                  const isWinner = !isRolling && winnerIndex === index;
                  const isCentered = distance === 0;

                  let visualClass = "scale-[0.88] opacity-45 blur-[1.35px]";
                  if (distance <= 1) {
                    visualClass = "scale-[0.95] opacity-72 blur-[0.6px]";
                  }
                  if (isCentered) {
                    visualClass = "scale-[1.03] opacity-100 blur-0";
                  }
                  if (isWinner) {
                    visualClass =
                      "scale-[1.06] opacity-100 blur-0 border-[#EAEAEA]/62 shadow-[0_18px_62px_rgba(234,234,234,0.34)]";
                  }

                  return (
                    <article
                      key={`${recipe.slug}-${index}`}
                      className={`relative h-[276px] w-[220px] shrink-0 overflow-hidden rounded-[20px] border border-white/18 transition duration-300 ${visualClass}`}
                    >
                      {recipe.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={recipe.image}
                          alt={recipe.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_28%),linear-gradient(180deg,rgba(20,31,53,0.84)_0%,rgba(8,13,22,0.98)_100%)]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/8 via-black/34 to-black/84" />
                      <div className="absolute inset-x-0 bottom-0 p-3 text-right">
                        <p className="line-clamp-2 text-[15px] font-bold leading-6 text-white">
                          {recipe.name}
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-white/74">
                          {recipe.prepTimeLabel}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-white/72">
                {isRolling
                  ? "الدوران مستمر..."
                  : result
                    ? `تم اختيار: ${result.name}`
                    : "اضغط زر الاختيار."}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={startRoll}
                  disabled={!hasRecipes || isRolling}
                  className="rounded-[12px] border border-white/22 bg-white/[0.04] px-4 py-2 text-xs font-bold text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  إعادة الاختيار
                </button>
                {result ? (
                  <Link
                    href={result.href}
                    className="rounded-[12px] bg-[linear-gradient(135deg,#EAEAEA,#B8C0CD)] px-4 py-2 text-xs font-bold text-[#080D16] transition hover:brightness-110"
                  >
                    افتح الوصفة
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
