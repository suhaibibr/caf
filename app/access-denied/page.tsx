import Link from "next/link";

export const metadata = {
  title: "غير مصرح | كــاف",
  description: "لا تملك الصلاحية للوصول إلى هذه الصفحة.",
};

export default function AccessDeniedPage() {
  return (
    <main
      dir="rtl"
      className="grid min-h-screen place-items-center bg-[linear-gradient(180deg,#0B0F1A,#070A12)] px-5 text-[#EAEAEA]"
    >
      <section className="w-full max-w-lg rounded-[28px] border border-white/12 bg-white/[0.04] p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-10">
        <p className="text-xs font-bold tracking-[0.18em] text-white/45">
          ACCESS DENIED
        </p>
        <h1 className="mt-4 text-3xl font-bold">غير مصرح لك بالدخول</h1>
        <p className="mt-3 text-sm font-bold text-white/55">
          حسابك مسجل، لكن لا يملك صلاحية الوصول إلى لوحة الإدارة.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-[14px] border border-white/12 px-5 py-3 text-sm font-bold text-white/85 transition hover:bg-white/[0.08] hover:text-white"
          >
            العودة للرئيسية
          </Link>
          <Link
            href="/login"
            className="rounded-[14px] border border-white/12 bg-white px-5 py-3 text-sm font-bold text-[#0B0F1A] transition hover:brightness-95"
          >
            تسجيل الدخول
          </Link>
        </div>
      </section>
    </main>
  );
}

