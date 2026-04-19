import { NextResponse } from "next/server";
import { setAuthCookieOnResponse } from "@/lib/auth/cookies";
import { getClientIp, getUserAgent, isSafeRedirectPath, isTrustedOrigin } from "@/lib/auth/request";
import { tryAuthenticateAdminLogin } from "@/lib/auth/session";
import { logSecurityEvent } from "@/lib/auth-db";
import { SECURITY_EVENT_WARNING } from "@/lib/auth/constants";
import {
  getDbErrorCode,
  isDbConnectionExhaustedError,
  isRecoverableDbError,
} from "@/lib/db-errors";

type LoginBody = {
  email?: string;
  password?: string;
  rememberMe?: boolean;
  nextPath?: string;
};

export async function POST(request: Request) {
  const ipAddress = getClientIp(request);
  const userAgent = getUserAgent(request);
  const pathname = new URL(request.url).pathname;

  if (!isTrustedOrigin(request)) {
    await logSecurityEvent({
      eventType: "security.csrf_blocked_login",
      severity: SECURITY_EVENT_WARNING,
      path: pathname,
      method: "POST",
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { message: "طلب غير موثوق." },
      { status: 403 },
    );
  }

  try {
    let body: LoginBody;
    try {
      body = (await request.json()) as LoginBody;
    } catch {
      return NextResponse.json(
        { message: "بيانات الطلب غير صالحة." },
        { status: 400 },
      );
    }

    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const rememberMe = Boolean(body.rememberMe);
    const requestedNext = typeof body.nextPath === "string" ? body.nextPath : "";
    const safeNextPath = isSafeRedirectPath(requestedNext) ? requestedNext : "/admin";

    const loginResult = await tryAuthenticateAdminLogin({
      email,
      password,
      rememberMe,
      path: pathname,
      method: "POST",
      ipAddress,
      userAgent,
    });

    if (!loginResult.ok) {
      return NextResponse.json(
        { message: loginResult.message },
        { status: loginResult.status },
      );
    }

    const response = NextResponse.json({
      ok: true,
      redirectTo: loginResult.user.mustChangePassword
        ? `/admin/change-password?next=${encodeURIComponent(safeNextPath)}`
        : safeNextPath,
    });
    setAuthCookieOnResponse(response, loginResult.token, loginResult.maxAgeSeconds);
    return response;
  } catch (error) {
    if (isDbConnectionExhaustedError(error)) {
      return NextResponse.json(
        { message: "الخادم مزدحم حالياً بسبب ضغط قاعدة البيانات. حاول بعد دقيقة." },
        { status: 503 },
      );
    }

    if (isRecoverableDbError(error)) {
      return NextResponse.json(
        { message: "تعذر الاتصال بقاعدة البيانات حالياً. حاول مرة أخرى." },
        { status: 503 },
      );
    }

    const code = getDbErrorCode(error);
    console.error("Unexpected login failure.", {
      code: code || "unknown",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { message: "تعذر إتمام تسجيل الدخول الآن." },
      { status: 500 },
    );
  }
}
