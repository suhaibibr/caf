"use client";

import { useState } from "react";

type RecipeActionsProps = {
  title: string;
};

export function RecipeActions({ title }: RecipeActionsProps) {
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);

  const share = async () => {
    if (navigator.share) {
      await navigator.share({
        title,
        url: window.location.href,
      });
      return;
    }

    await navigator.clipboard.writeText(window.location.href);
    setShared(true);
    window.setTimeout(() => setShared(false), 1800);
  };

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => setSaved((current) => !current)}
        className="rounded-full bg-[var(--foreground)] px-6 py-3 text-sm font-bold text-[var(--background)] shadow-[0_18px_46px_rgba(0,0,0,0.18)] transition hover:scale-[1.02] hover:brightness-110"
      >
        {saved ? "تم الحفظ" : "حفظ الوصفة"}
      </button>
      <button
        type="button"
        onClick={share}
        className="glass-soft rounded-full px-6 py-3 text-sm font-bold text-[var(--foreground)] transition hover:scale-[1.02] hover:brightness-110"
      >
        {shared ? "تم النسخ" : "مشاركة"}
      </button>
    </div>
  );
}
