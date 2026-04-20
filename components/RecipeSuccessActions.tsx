"use client";

import Link from "next/link";
import { useState } from "react";

type RecipeSuccessActionsProps = {
  recipePath: string | null;
  from: "admin" | "guest";
};

export function RecipeSuccessActions({ recipePath, from }: RecipeSuccessActionsProps) {
  const [shareState, setShareState] = useState<"idle" | "copied" | "error">("idle");

  const shareRecipe = async () => {
    if (!recipePath) {
      return;
    }

    const url = new URL(recipePath, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "وصفة جديدة | كــاف",
          text: "تمت إضافة هذه الوصفة في كــاف",
          url,
        });
        return;
      } catch {
        // Fall back to clipboard when share sheet is closed or unavailable.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 2000);
    } catch {
      setShareState("error");
      window.setTimeout(() => setShareState("idle"), 2200);
    }
  };

  return (
    <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
      {recipePath ? (
        <>
          <Link
            href={recipePath}
            className="rounded-full bg-[#0F172A] px-6 py-3 text-sm font-bold text-white transition hover:scale-[1.02] dark:bg-[#EAEAEA] dark:text-[#0B0F1A]"
          >
            الانتقال للوصفة
          </Link>
          <button
            type="button"
            onClick={() => {
              void shareRecipe();
            }}
            className="rounded-full border border-black/12 bg-white px-6 py-3 text-sm font-bold text-black/78 transition hover:scale-[1.02] dark:border-white/12 dark:bg-white/[0.06] dark:text-[#EAEAEA]"
          >
            {shareState === "copied"
              ? "تم نسخ رابط الوصفة"
              : shareState === "error"
                ? "تعذر النسخ"
                : "مشاركة الوصفة"}
          </button>
        </>
      ) : null}
      <Link
        href={from === "admin" ? "/admin/recipes" : "/"}
        className="rounded-full border border-black/12 px-6 py-3 text-sm font-bold text-black/70 transition hover:bg-black hover:text-white dark:border-white/12 dark:text-[#EAEAEA]/72 dark:hover:bg-[#EAEAEA] dark:hover:text-[#0B0F1A]"
      >
        {from === "admin" ? "العودة لإدارة الوصفات" : "العودة للرئيسية"}
      </Link>
    </div>
  );
}
