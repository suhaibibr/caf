import { NextResponse } from "next/server";
import { AUTH_MAX_PASSWORD_LENGTH, AUTH_MIN_PASSWORD_LENGTH, SECURITY_EVENT_INFO, SECURITY_EVENT_WARNING } from "@/lib/auth/constants";
import { requireAdminApi } from "@/lib/auth/session";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { updateAuthUserPassword, logSecurityEvent } from "@/lib/auth-db";

type ChangePasswordBody = {
  currentPassword?: string;
  newPassword?: string;
};

export async function POST(request: Request) {
  const auth = await requireAdminApi(request, {
    allowWhenMustChangePassword: true,
  });
  if (!auth.ok) {
    return auth.response;
  }

  let body: ChangePasswordBody;
  try {
    body = (await request.json()) as ChangePasswordBody;
  } catch {
    return NextResponse.json(
      { message: "بيانات الطلب غير صالحة." },
      { status: 400 },
    );
  }

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { message: "كلمة المرور الحالية والجديدة مطلوبة." },
      { status: 400 },
    );
  }
  if (newPassword.length < AUTH_MIN_PASSWORD_LENGTH || newPassword.length > AUTH_MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      {
        message: `كلمة المرور الجديدة يجب أن تكون بين ${AUTH_MIN_PASSWORD_LENGTH} و ${AUTH_MAX_PASSWORD_LENGTH} حرفًا.`,
      },
      { status: 400 },
    );
  }

  const isCurrentValid = await verifyPassword(currentPassword, auth.context.user.passwordHash);
  if (!isCurrentValid) {
    await logSecurityEvent({
      userId: auth.context.user.id,
      eventType: "auth.change_password.invalid_current",
      severity: SECURITY_EVENT_WARNING,
      path: new URL(request.url).pathname,
      method: request.method,
      ipAddress: auth.context.ipAddress,
      userAgent: auth.context.userAgent,
    });
    return NextResponse.json(
      { message: "كلمة المرور الحالية غير صحيحة." },
      { status: 401 },
    );
  }

  const isSamePassword = await verifyPassword(newPassword, auth.context.user.passwordHash);
  if (isSamePassword) {
    return NextResponse.json(
      { message: "اختر كلمة مرور جديدة مختلفة عن الحالية." },
      { status: 400 },
    );
  }

  const newHash = await hashPassword(newPassword);
  await updateAuthUserPassword({
    userId: auth.context.user.id,
    passwordHash: newHash,
    mustChangePassword: false,
  });

  await logSecurityEvent({
    userId: auth.context.user.id,
    eventType: "auth.change_password.success",
    severity: SECURITY_EVENT_INFO,
    path: new URL(request.url).pathname,
    method: request.method,
    ipAddress: auth.context.ipAddress,
    userAgent: auth.context.userAgent,
  });

  return NextResponse.json({ ok: true });
}

