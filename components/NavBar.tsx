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
      <nav className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-12 sm:px-16">
        <Link
          href="/"
          className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--page-fg)]"
          aria-label="العودة للرئيسية"
        >
          كــاف
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--page-muted)] transition hover:text-[var(--page-fg)]"
            href="/roasters"
          >
            المحامص
          </Link>
          <Link
            className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--page-muted)] transition hover:text-[var(--page-fg)]"
            href="/#recipes"
          >
            الوصفات
          </Link>
          <span
            className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--page-muted)]"
          >
            المجتمع
          </span>
          <span
            className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--page-muted)]"
          >
            عن المشروع
          </span>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle tone={tone} />
          <Link
            href="/roasters"
            className="text-[12px] font-bold uppercase tracking-[0.18em] text-[var(--page-fg)] transition hover:text-[var(--page-muted)]"
          >
            ابدأ
          </Link>
        </div>
      </nav>
    </header>
  );
}
