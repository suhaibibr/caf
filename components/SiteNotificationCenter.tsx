"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  RECIPE_ADDED_EVENT,
  readPendingNotification,
  type RecipeAddedNotification,
} from "@/lib/site-notifications";

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    >
      <path d="M12 5.2a4 4 0 0 0-4 4v2.1c0 1.1-.4 2.1-1.1 3l-1.1 1.4h12.4l-1.1-1.4a4.8 4.8 0 0 1-1.1-3V9.2a4 4 0 0 0-4-4Z" />
      <path d="M10.3 18.2a2 2 0 0 0 3.4 0" />
    </svg>
  );
}

export function SiteNotificationCenter() {
  const pathname = usePathname();
  const [notification, setNotification] = useState<RecipeAddedNotification | null>(() =>
    readPendingNotification(),
  );
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleRecipeAdded = (event: Event) => {
      const customEvent = event as CustomEvent<RecipeAddedNotification>;
      if (!customEvent.detail) {
        return;
      }

      setNotification(customEvent.detail);
    };

    window.addEventListener(RECIPE_ADDED_EVENT, handleRecipeAdded);

    return () => {
      window.removeEventListener(RECIPE_ADDED_EVENT, handleRecipeAdded);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!notification) {
      return;
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setNotification(null);
    }, 5200);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [notification]);

  if (pathname !== "/") {
    return null;
  }

  if (!notification) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-5 left-5 z-[220] w-[min(360px,calc(100vw-2.5rem))]">
      <div className="rounded-[22px] border border-[color:var(--page-line)] bg-[var(--notification-bg)] p-4 text-[var(--page-fg)] shadow-[0_28px_90px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[color:var(--page-line)] bg-[var(--page-surface-soft)] text-[var(--page-muted)]">
            <BellIcon />
          </span>
          <div className="min-w-0 text-right">
            <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--page-soft)]">
              تمت إضافة وصفة جديدة
            </p>
            <p className="mt-2 truncate text-base font-bold text-[var(--page-fg)]">
              {notification.recipeName}
            </p>
            <p className="mt-1 text-sm font-bold text-[var(--page-muted)]">
              {notification.authorName} · {notification.roasterName}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
