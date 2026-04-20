import { randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  ACCOUNT_LOCK_MAX_FAILED_ATTEMPTS,
  ACCOUNT_LOCK_MINUTES,
  AUTH_COOKIE_NAME,
  AUTH_MAX_EMAIL_LENGTH,
  AUTH_MAX_PASSWORD_LENGTH,
  AUTH_ROLE_ADMIN,
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_EMAIL,
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP,
  LOGIN_RATE_LIMIT_WINDOW_MINUTES,
  REMEMBER_ME_TTL_SECONDS,
  SECURITY_EVENT_CRITICAL,
  SECURITY_EVENT_INFO,
  SECURITY_EVENT_WARNING,
  SESSION_IDLE_TIMEOUT_SECONDS,
  SESSION_TTL_SECONDS,
  type AuthTokenPayload,
} from "@/lib/auth/constants";
import { verifyAuthToken, signAuthToken } from "@/lib/auth/token";
import { hasPermission, type RbacPermission } from "@/lib/auth/rbac";
import { getClientIp, getCookieFromRequest, getUserAgent, isMutatingMethod, isTrustedOrigin } from "@/lib/auth/request";
import { verifyPassword } from "@/lib/auth/password";
import { runPeriodicLogCleanup } from "@/lib/maintenance";
import {
  cleanupExpiredAuthSessions,
  createAuthSession,
  getAuthSessionWithUser,
  getAuthUserByEmail,
  logSecurityEvent,
  markAuthUserLoginSuccess,
  recordLoginAttempt,
  revokeAuthSession,
  touchAuthSession,
  updateAuthUserFailedLogin,
  type AuthSessionRecord,
  type AuthUserRecord,
  getRecentFailedLoginCounts,
} from "@/lib/auth-db";

export type AuthenticatedAdminContext = {
  user: AuthUserRecord;
  session: AuthSessionRecord;
  token: AuthTokenPayload;
  ipAddress: string;
  userAgent: string;
};

type AuthResolution =
  | {
      ok: true;
      context: AuthenticatedAdminContext;
    }
  | {
      ok: false;
      reason: "missing-token" | "invalid-token" | "expired" | "revoked" | "not-found" | "user-agent-mismatch" | "inactive-user";
    };

type LoginResult =
  | {
      ok: true;
      token: string;
      maxAgeSeconds: number;
      user: AuthUserRecord;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

function getNowMs() {
  return Date.now();
}

function randomSessionId() {
  return randomBytes(24)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function toIsoFromNow(seconds: number) {
  return new Date(getNowMs() + seconds * 1000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isEmailFormatValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function resolveTokenSession(input: {
  tokenValue: string;
  path: string;
  method: string;
  ipAddress: string;
  userAgent: string;
}) {
  let token: AuthTokenPayload | null = null;
  try {
    token = verifyAuthToken(input.tokenValue);
  } catch {
    token = null;
  }
  if (!token) {
    await logSecurityEvent({
      eventType: "auth.invalid_token",
      severity: SECURITY_EVENT_WARNING,
      path: input.path,
      method: input.method,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return { ok: false, reason: "invalid-token" } satisfies AuthResolution;
  }

  const sessionWithUser = await getAuthSessionWithUser(token.sid);
  if (!sessionWithUser) {
    await logSecurityEvent({
      userId: token.uid,
      eventType: "auth.session_not_found",
      severity: SECURITY_EVENT_WARNING,
      path: input.path,
      method: input.method,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      details: { sid: token.sid },
    });
    return { ok: false, reason: "not-found" } satisfies AuthResolution;
  }

  const { session, user } = sessionWithUser;
  const now = getNowMs();
  const sessionExpiresAtMs = new Date(session.expiresAt).getTime();
  const sessionLastSeenMs = new Date(session.lastSeenAt).getTime();
  const idleCutoff = now - SESSION_IDLE_TIMEOUT_SECONDS * 1000;

  if (session.userId !== token.uid || user.id !== token.uid) {
    await revokeAuthSession(session.sessionId, "token-user-mismatch");
    await logSecurityEvent({
      userId: user.id,
      eventType: "auth.token_user_mismatch",
      severity: SECURITY_EVENT_CRITICAL,
      path: input.path,
      method: input.method,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      details: { tokenUserId: token.uid, sessionUserId: session.userId, sid: session.sessionId },
    });
    return { ok: false, reason: "invalid-token" } satisfies AuthResolution;
  }

  if (session.revokedAt) {
    return { ok: false, reason: "revoked" } satisfies AuthResolution;
  }
  if (!Number.isFinite(sessionExpiresAtMs) || sessionExpiresAtMs <= now) {
    await revokeAuthSession(session.sessionId, "expired");
    return { ok: false, reason: "expired" } satisfies AuthResolution;
  }
  if (!Number.isFinite(sessionLastSeenMs) || sessionLastSeenMs < idleCutoff) {
    await revokeAuthSession(session.sessionId, "idle-timeout");
    return { ok: false, reason: "expired" } satisfies AuthResolution;
  }
  if (!user.isActive) {
    await revokeAuthSession(session.sessionId, "inactive-user");
    return { ok: false, reason: "inactive-user" } satisfies AuthResolution;
  }

  if (session.userAgent && input.userAgent && session.userAgent !== input.userAgent) {
    // Session hijacking defense: if a stolen cookie is replayed from a different
    // browser fingerprint, revoke the session immediately.
    await revokeAuthSession(session.sessionId, "user-agent-mismatch");
    await logSecurityEvent({
      userId: user.id,
      eventType: "auth.user_agent_mismatch",
      severity: SECURITY_EVENT_CRITICAL,
      path: input.path,
      method: input.method,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      details: {
        sid: session.sessionId,
        storedUserAgent: session.userAgent,
        requestUserAgent: input.userAgent,
      },
    });
    return { ok: false, reason: "user-agent-mismatch" } satisfies AuthResolution;
  }

  if (session.ipAddress && input.ipAddress && session.ipAddress !== input.ipAddress) {
    await logSecurityEvent({
      userId: user.id,
      eventType: "auth.ip_changed",
      severity: SECURITY_EVENT_WARNING,
      path: input.path,
      method: input.method,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      details: {
        sid: session.sessionId,
        previousIp: session.ipAddress,
        currentIp: input.ipAddress,
      },
    });
  }

  await touchAuthSession(session.sessionId);

  return {
    ok: true,
    context: {
      user,
      session,
      token,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  } satisfies AuthResolution;
}

export async function tryAuthenticateAdminLogin(input: {
  email: string;
  password: string;
  rememberMe: boolean;
  path: string;
  method: string;
  ipAddress: string;
  userAgent: string;
}): Promise<LoginResult> {
  void runPeriodicLogCleanup();

  const normalizedEmail = normalizeEmail(input.email);
  const password = input.password;

  if (
    !normalizedEmail ||
    normalizedEmail.length > AUTH_MAX_EMAIL_LENGTH ||
    !isEmailFormatValid(normalizedEmail)
  ) {
    return {
      ok: false,
      status: 400,
      message: "صيغة البريد الإلكتروني غير صحيحة.",
    };
  }

  if (!password || password.length > AUTH_MAX_PASSWORD_LENGTH) {
    return {
      ok: false,
      status: 400,
      message: "بيانات تسجيل الدخول غير صحيحة.",
    };
  }

  const windowStartIso = new Date(
    getNowMs() - LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();
  const recentFailed = await getRecentFailedLoginCounts({
    ipAddress: input.ipAddress,
    email: normalizedEmail,
    sinceIso: windowStartIso,
  });

  if (
    recentFailed.ipCount >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_IP ||
    recentFailed.emailCount >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS_PER_EMAIL
  ) {
    await recordLoginAttempt({
      email: normalizedEmail,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      wasSuccess: false,
      reason: "rate-limit",
    });
    await logSecurityEvent({
      eventType: "auth.rate_limited",
      severity: SECURITY_EVENT_WARNING,
      path: input.path,
      method: input.method,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      details: {
        email: normalizedEmail,
        ipCount: recentFailed.ipCount,
        emailCount: recentFailed.emailCount,
      },
    });
    return {
      ok: false,
      status: 429,
      message: "تم تجاوز الحد المسموح لمحاولات الدخول. حاول لاحقًا.",
    };
  }

  const user = await getAuthUserByEmail(normalizedEmail);
  if (!user) {
    await recordLoginAttempt({
      email: normalizedEmail,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      wasSuccess: false,
      reason: "user-not-found",
    });
    return {
      ok: false,
      status: 401,
      message: "بيانات تسجيل الدخول غير صحيحة.",
    };
  }

  if (!user.isActive) {
    await recordLoginAttempt({
      email: normalizedEmail,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      wasSuccess: false,
      reason: "inactive-user",
    });
    await logSecurityEvent({
      userId: user.id,
      eventType: "auth.inactive_user_login_attempt",
      severity: SECURITY_EVENT_WARNING,
      path: input.path,
      method: input.method,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return {
      ok: false,
      status: 403,
      message: "الحساب غير مفعل.",
    };
  }

  if (user.lockedUntil) {
    const lockedUntilMs = new Date(user.lockedUntil).getTime();
    if (Number.isFinite(lockedUntilMs) && lockedUntilMs > getNowMs()) {
      await recordLoginAttempt({
        email: normalizedEmail,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        wasSuccess: false,
        reason: "account-locked",
      });
      return {
        ok: false,
        status: 423,
        message: "الحساب مقفل مؤقتًا بسبب محاولات فاشلة متكررة.",
      };
    }
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) {
    const nextAttempts = user.failedLoginAttempts + 1;
    const shouldLock = nextAttempts >= ACCOUNT_LOCK_MAX_FAILED_ATTEMPTS;
    const lockedUntilIso = shouldLock
      ? new Date(getNowMs() + ACCOUNT_LOCK_MINUTES * 60 * 1000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ")
      : null;

    await updateAuthUserFailedLogin({
      userId: user.id,
      failedAttempts: nextAttempts,
      lockedUntilIso,
    });
    await recordLoginAttempt({
      email: normalizedEmail,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      wasSuccess: false,
      reason: shouldLock ? "invalid-password-locked" : "invalid-password",
    });
    if (shouldLock) {
      await logSecurityEvent({
        userId: user.id,
        eventType: "auth.account_locked",
        severity: SECURITY_EVENT_WARNING,
        path: input.path,
        method: input.method,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        details: { failedAttempts: nextAttempts },
      });
    }
    return {
      ok: false,
      status: 401,
      message: "بيانات تسجيل الدخول غير صحيحة.",
    };
  }

  if (user.role !== AUTH_ROLE_ADMIN) {
    await recordLoginAttempt({
      email: normalizedEmail,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      wasSuccess: false,
      reason: "non-admin-login",
    });
    await logSecurityEvent({
      userId: user.id,
      eventType: "auth.non_admin_login_attempt",
      severity: SECURITY_EVENT_WARNING,
      path: input.path,
      method: input.method,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    return {
      ok: false,
      status: 403,
      message: "ليس لديك صلاحية للوصول إلى لوحة الإدارة.",
    };
  }

  const maxAgeSeconds = input.rememberMe ? REMEMBER_ME_TTL_SECONDS : SESSION_TTL_SECONDS;
  const sessionId = randomSessionId();
  const expiresAtIso = toIsoFromNow(maxAgeSeconds);
  try {
    await createAuthSession({
      sessionId,
      userId: user.id,
      rememberMe: input.rememberMe,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      expiresAtIso,
    });
  } catch {
    return {
      ok: false,
      status: 500,
      message: "تعذر إنشاء جلسة الدخول. حاول مرة أخرى.",
    };
  }

  const nowSeconds = Math.floor(getNowMs() / 1000);
  const tokenPayload: AuthTokenPayload = {
    uid: user.id,
    role: user.role,
    sid: sessionId,
    iat: nowSeconds,
    exp: nowSeconds + maxAgeSeconds,
  };
  let token = "";
  try {
    token = signAuthToken(tokenPayload);
  } catch {
    return {
      ok: false,
      status: 500,
      message: "تعذر إعداد جلسة الدخول. تحقق من إعدادات الخادم.",
    };
  }

  await markAuthUserLoginSuccess(user.id);

  await recordLoginAttempt({
    email: normalizedEmail,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    wasSuccess: true,
    reason: "success",
  });
  await logSecurityEvent({
    userId: user.id,
    eventType: "auth.login_success",
    severity: SECURITY_EVENT_INFO,
    path: input.path,
    method: input.method,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    details: { rememberMe: input.rememberMe },
  });
  void cleanupExpiredAuthSessions().catch(() => {
    // Cleanup is best-effort and should not break successful login.
  });

  return {
    ok: true,
    token,
    maxAgeSeconds,
    user: {
      ...user,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date().toISOString(),
    },
  };
}

export async function logoutFromRequest(request: Request) {
  const tokenValue = getCookieFromRequest(request, AUTH_COOKIE_NAME);
  if (!tokenValue) {
    return;
  }
  let token: AuthTokenPayload | null = null;
  try {
    token = verifyAuthToken(tokenValue);
  } catch {
    token = null;
  }
  if (!token) {
    return;
  }
  await revokeAuthSession(token.sid, "logout");
}

type RequireAdminApiOptions = {
  permission?: RbacPermission;
  enforceCsrf?: boolean;
  requireSuperAdmin?: boolean;
  allowWhenMustChangePassword?: boolean;
};

export async function requireAdminApi(
  request: Request,
  options?: RequireAdminApiOptions,
): Promise<
  | { ok: true; context: AuthenticatedAdminContext }
  | { ok: false; response: NextResponse<{ message: string }> }
> {
  void runPeriodicLogCleanup();

  const path = new URL(request.url).pathname;
  const method = request.method.toUpperCase();
  const ipAddress = getClientIp(request);
  const userAgent = getUserAgent(request);
  const enforceCsrf =
    options?.enforceCsrf ?? isMutatingMethod(method);

  if (enforceCsrf && !isTrustedOrigin(request)) {
    // Cookie-based auth requires CSRF checks on state-changing requests.
    await logSecurityEvent({
      eventType: "security.csrf_blocked",
      severity: SECURITY_EVENT_WARNING,
      path,
      method,
      ipAddress,
      userAgent,
    });
    return {
      ok: false,
      response: NextResponse.json(
        { message: "طلب غير موثوق." },
        { status: 403 },
      ),
    };
  }

  const tokenValue = getCookieFromRequest(request, AUTH_COOKIE_NAME);
  if (!tokenValue) {
    await logSecurityEvent({
      eventType: "auth.missing_cookie",
      severity: SECURITY_EVENT_WARNING,
      path,
      method,
      ipAddress,
      userAgent,
    });
    return {
      ok: false,
      response: NextResponse.json(
        { message: "يجب تسجيل الدخول أولًا." },
        { status: 401 },
      ),
    };
  }

  const auth = await resolveTokenSession({
    tokenValue,
    path,
    method,
    ipAddress,
    userAgent,
  });
  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "انتهت الجلسة أو أنها غير صالحة." },
        { status: 401 },
      ),
    };
  }

  if (auth.context.user.role !== AUTH_ROLE_ADMIN) {
    await logSecurityEvent({
      userId: auth.context.user.id,
      eventType: "auth.forbidden_api_access",
      severity: SECURITY_EVENT_WARNING,
      path,
      method,
      ipAddress,
      userAgent,
    });
    return {
      ok: false,
      response: NextResponse.json(
        { message: "ليس لديك صلاحية للوصول." },
        { status: 403 },
      ),
    };
  }

  if (auth.context.user.mustChangePassword && !options?.allowWhenMustChangePassword) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "يجب تغيير كلمة المرور قبل متابعة استخدام لوحة الإدارة." },
        { status: 403 },
      ),
    };
  }

  if (options?.requireSuperAdmin && !auth.context.user.isSuperAdmin) {
    await logSecurityEvent({
      userId: auth.context.user.id,
      eventType: "auth.super_admin_required",
      severity: SECURITY_EVENT_WARNING,
      path,
      method,
      ipAddress,
      userAgent,
    });
    return {
      ok: false,
      response: NextResponse.json(
        { message: "هذه الصفحة متاحة لصلاحية أعلى فقط." },
        { status: 403 },
      ),
    };
  }

  if (options?.permission && !hasPermission(auth.context.user.role, options.permission)) {
    await logSecurityEvent({
      userId: auth.context.user.id,
      eventType: "auth.permission_denied",
      severity: SECURITY_EVENT_WARNING,
      path,
      method,
      ipAddress,
      userAgent,
      details: { permission: options.permission },
    });
    return {
      ok: false,
      response: NextResponse.json(
        { message: "ليس لديك صلاحية لتنفيذ هذا الإجراء." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, context: auth.context };
}

type RequireAdminPageOptions = {
  requireSuperAdmin?: boolean;
  allowWhenMustChangePassword?: boolean;
};

export async function requireAdminPageAccess(
  pathname: string,
  permission?: RbacPermission,
  options?: RequireAdminPageOptions,
) {
  void runPeriodicLogCleanup();

  const cookieStore = await cookies();
  const headerStore = await headers();

  const tokenValue = cookieStore.get(AUTH_COOKIE_NAME)?.value ?? "";
  if (!tokenValue) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  const ipAddress =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headerStore.get("x-real-ip") ||
    "unknown";
  const userAgent = headerStore.get("user-agent") ?? "";

  const auth = await resolveTokenSession({
    tokenValue,
    path: pathname,
    method: "GET",
    ipAddress: ipAddress.slice(0, 64),
    userAgent: userAgent.slice(0, 512),
  });
  if (!auth.ok) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  if (auth.context.user.role !== AUTH_ROLE_ADMIN) {
    redirect("/access-denied");
  }

  if (
    auth.context.user.mustChangePassword &&
    pathname !== "/admin/change-password" &&
    !options?.allowWhenMustChangePassword
  ) {
    redirect(`/admin/change-password?next=${encodeURIComponent(pathname)}`);
  }

  if (options?.requireSuperAdmin && !auth.context.user.isSuperAdmin) {
    redirect("/access-denied");
  }

  if (permission && !hasPermission(auth.context.user.role, permission)) {
    redirect("/access-denied");
  }

  return auth.context;
}
