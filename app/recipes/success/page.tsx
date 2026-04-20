import type { Metadata } from "next";
import { RecipeSuccessActions } from "@/components/RecipeSuccessActions";

type RecipeSuccessPageProps = {
  searchParams: Promise<{
    slug?: string | string[] | undefined;
    from?: string | string[] | undefined;
  }>;
};

export const metadata: Metadata = {
  title: "تمت إضافة الوصفة | كــاف",
  description: "تمت إضافة الوصفة بنجاح ويمكنك الانتقال إليها أو مشاركتها.",
};

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function RecipeSuccessPage({ searchParams }: RecipeSuccessPageProps) {
  const params = await searchParams;
  const slug = firstQueryValue(params.slug).trim();
  const fromValue = firstQueryValue(params.from).trim().toLowerCase();
  const from = fromValue === "admin" ? "admin" : "guest";
  const safeSlug = slug.replace(/[/?#]/g, "").trim();
  const recipePath = safeSlug ? `/recipes/${encodeURIComponent(safeSlug)}` : null;

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-[#F6F6F3] px-5 py-10 text-[#141414] dark:bg-[#0B0F1A] dark:text-[#EAEAEA]"
    >
      <section className="w-full max-w-xl rounded-[28px] border border-black/10 bg-white/88 p-7 text-center shadow-[0_30px_90px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-white/[0.04] sm:p-9">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#16A34A]/14 text-[#15803D] dark:bg-[#16A34A]/18 dark:text-[#4ADE80]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8">
            <path
              d="m5 12 4.2 4.2L19 6.5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.3"
            />
          </svg>
        </div>

        <h1 className="mt-5 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
          تم إضافة وصفتك بنجاح
        </h1>
        <p className="mt-3 text-sm font-bold text-black/50 dark:text-[#EAEAEA]/55">
          {recipePath
            ? "يمكنك الآن الانتقال للوصفة مباشرة أو مشاركة الرابط."
            : "تمت العملية بنجاح، لكن لم يصل رابط الوصفة بشكل صحيح."}
        </p>

        <RecipeSuccessActions recipePath={recipePath} from={from} />
      </section>
    </main>
  );
}
