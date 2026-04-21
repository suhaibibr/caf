import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { AUTH_COOKIE_NAME, AUTH_ROLE_ADMIN } from "@/lib/auth/constants";
import { verifyAuthToken } from "@/lib/auth/token";
import { getAuthSessionWithUser } from "@/lib/auth-db";
import { isSafeRedirectPath } from "@/lib/auth/request";

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

export const dynamic = "force-dynamic";

async function getAuthenticatedAdminRedirect() {
  const cookieStore = await cookies();
  const tokenValue = cookieStore.get(AUTH_COOKIE_NAME)?.value ?? "";
  if (!tokenValue) {
    return null;
  }

  let token = null;
  try {
    token = verifyAuthToken(tokenValue);
  } catch {
    token = null;
  }
  if (!token || token.role !== AUTH_ROLE_ADMIN) {
    return null;
  }

  const sessionWithUser = await getAuthSessionWithUser(token.sid);
  if (!sessionWithUser) {
    return null;
  }

  const nowMs = Date.now();
  const expiresAt = new Date(sessionWithUser.session.expiresAt).getTime();
  if (
    sessionWithUser.session.revokedAt ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= nowMs ||
    !sessionWithUser.user.isActive ||
    sessionWithUser.user.role !== AUTH_ROLE_ADMIN
  ) {
    return null;
  }

  if (sessionWithUser.user.mustChangePassword) {
    return "/admin/change-password";
  }

  return "/admin";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const authenticatedRedirect = await getAuthenticatedAdminRedirect();
  if (authenticatedRedirect) {
    redirect(authenticatedRedirect);
  }

  const params = await searchParams;
  const requestedNext = typeof params.next === "string" ? params.next : "";
  const nextPath = isSafeRedirectPath(requestedNext) ? requestedNext : "/admin";

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_38%),linear-gradient(180deg,#0B0F1A,#070A12)] px-5 py-16 text-[#EAEAEA] sm:px-8"
    >
      <section className="mx-auto w-full max-w-md rounded-[28px] border border-white/12 bg-white/[0.04] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-8">
        <p className="text-xs font-bold tracking-[0.2em] text-white/45">
          ADMIN AUTH
        </p>
        <h1 className="mt-3 text-3xl font-bold">تسجيل دخول الإدارة</h1>
        <AdminLoginForm nextPath={nextPath} />
      </section>
    </main>
  );
}
