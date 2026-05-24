import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { XbloomRecipeEngine } from "@/components/XbloomRecipeEngine";

export const metadata: Metadata = {
  title: "انشاء وصفة | كــاف",
  description: "محرك وصفات xBloom لتوليد وصفات عملية وجاهزة للتنفيذ على أومني دريبر.",
};

export default function CreateRecipePage() {
  return (
    <main dir="rtl" className="theme-page page-shell min-h-screen">
      <NavBar tone="light" />

      <section className="mx-auto w-full max-w-7xl px-5 pt-28 pb-6 sm:px-8">
        <p className="text-xs font-bold tracking-[0.1em] text-[var(--page-muted)]">
          محرك وصفات xBloom
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-[-0.02em] text-[var(--page-fg)] sm:text-5xl">
          انشاء وصفة
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-[var(--page-muted)]">
          اكتب بيانات البن الأساسية فقط، وسيقوم المحرك بمحاكاة الوصفة بصيغة xBloom
          أولًا ثم ينشئ لك رابطًا مباشرًا عند التنفيذ.
        </p>
      </section>

      <XbloomRecipeEngine />
    </main>
  );
}
