"use client";

import { useSyncExternalStore } from "react";
import {
  applyTheme,
  persistTheme,
  resolvePreferredTheme,
  THEME_STORAGE_KEY,
  THEME_CHANGE_EVENT,
  type SiteTheme,
} from "@/lib/theme";

type ThemeToggleProps = {
  tone?: "light" | "dark";
};

function SunIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      className="h-4 w-4"
    >
      <path
        d="M18.2 14.2A7.6 7.6 0 0 1 9.8 5.8a7.8 7.8 0 1 0 8.4 8.4Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function ThemeToggle({ tone = "light" }: ThemeToggleProps) {
  const theme = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      const onThemeChange = () => onStoreChange();
      const onStorage = (event: StorageEvent) => {
        if (!event.key || event.key === THEME_STORAGE_KEY) {
          onStoreChange();
        }
      };
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const onMediaChange = () => onStoreChange();

      window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
      window.addEventListener("storage", onStorage);
      media.addEventListener("change", onMediaChange);

      return () => {
        window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
        window.removeEventListener("storage", onStorage);
        media.removeEventListener("change", onMediaChange);
      };
    },
    () => resolvePreferredTheme(),
    () => "light" as SiteTheme,
  );
  const isDarkTone = tone === "dark";

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    persistTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
      className={`grid h-10 w-10 place-items-center rounded-full border transition ${
        isDarkTone
          ? "border-white/12 bg-white/[0.06] text-[#EAEAEA]/78 hover:bg-white/[0.12] hover:text-[#EAEAEA]"
          : "border-black/8 bg-white/70 text-black/62 hover:bg-white hover:text-black"
      }`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
