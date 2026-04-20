"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

type NavBarProps = {
  tone?: "light" | "dark";
};

export function NavBar({ tone = "light" }: NavBarProps) {
  return (
    <header
      className="absolute inset-x-0 top-0 z-50 border-b border-[color:var(--page-line)] bg-[var(--page-surface)] backdrop-blur-xl"
    >
      <nav className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between gap-2 px-4 sm:px-8 md:px-12">
        <Link
          href="/"
          className="whitespace-nowrap text-[16px] font-bold tracking-[0] text-[var(--page-fg)] sm:text-[12px] sm:tracking-[0.18em]"
          aria-label="العودة للرئيسية"
        >
          كــاف
        </Link>

        <div className="flex items-center gap-3 sm:gap-5 md:gap-8">
          <Link
            className="text-[11px] font-bold tracking-[0.08em] text-[var(--page-muted)] transition hover:text-[var(--page-fg)] sm:text-[12px] sm:tracking-[0.18em]"
            href="/roasters"
          >
            المحامص
          </Link>
          <Link
            className="text-[11px] font-bold tracking-[0.08em] text-[var(--page-muted)] transition hover:text-[var(--page-fg)] sm:text-[12px] sm:tracking-[0.18em]"
            href="/#recipes"
          >
            الوصفات
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle tone={tone} />
          <Link
            href="/roasters"
            className="hidden text-[12px] font-bold tracking-[0.18em] text-[var(--page-fg)] transition hover:text-[var(--page-muted)] sm:inline-flex"
          >
            ابدأ
          </Link>
        </div>
      </nav>
    </header>
  );
}
