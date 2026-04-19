"use client";

import { useEffect, useRef, useState } from "react";
import { AdminLogoutButton } from "@/components/AdminLogoutButton";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

export function AdminUserMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onEscape);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-3 rounded-[18px] border border-black/8 bg-white/70 py-2 pr-2 pl-3 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
      >
        <div className="grid h-8 w-8 place-items-center rounded-full bg-black text-xs font-bold text-white dark:bg-[#EAEAEA] dark:text-[#0B0F1A]">
          ا
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-bold">الاداري</p>
          <p className="text-xs text-black/42 dark:text-[#EAEAEA]/42">إداري</p>
        </div>
        <span className="text-black/45 dark:text-[#EAEAEA]/55">
          <ChevronIcon open={open} />
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 z-50 mt-2 w-48 rounded-[16px] border border-black/10 bg-white p-3 shadow-[0_18px_60px_rgba(0,0,0,0.14)] dark:border-white/10 dark:bg-[#0F1420]">
          <AdminLogoutButton />
        </div>
      ) : null}
    </div>
  );
}
