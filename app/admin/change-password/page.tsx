import type { Metadata } from "next";
import { AdminChangePasswordForm } from "@/components/AdminChangePasswordForm";
import { requireAdminPageAccess } from "@/lib/auth/session";
import { isSafeRedirectPath } from "@/lib/auth/request";

type ChangePasswordPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export const metadata: Metadata = {
  title: "تغيير كلمة المرور | لوحة الإدارة",
  description: "تحديث كلمة مرور حساب الإدارة.",
};

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage({ searchParams }: ChangePasswordPageProps) {
  await requireAdminPageAccess("/admin/change-password", undefined, {
    allowWhenMustChangePassword: true,
  });

  const params = await searchParams;
  const requestedNext = typeof params.next === "string" ? params.next : "/admin";
  const nextPath = isSafeRedirectPath(requestedNext) ? requestedNext : "/admin";

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_38%),linear-gradient(180deg,#0B0F1A,#070A12)] px-5 py-16 text-[#EAEAEA] sm:px-8"
    >
      <section className="mx-auto w-full max-w-md rounded-[28px] border border-white/12 bg-white/[0.04] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-8">
        <p className="text-xs font-bold tracking-[0.2em] text-white/45">
          SECURITY
        </p>
        <h1 className="mt-3 text-3xl font-bold">تغيير كلمة المرور</h1>
        <p className="mt-3 text-sm font-bold text-white/55">
          للحماية، يجب تعيين كلمة مرور جديدة قبل المتابعة.
        </p>

        <AdminChangePasswordForm nextPath={nextPath} />
      </section>
    </main>
  );
}

