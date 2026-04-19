import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { AUTH_ROLE_ADMIN, AUTH_MAX_EMAIL_LENGTH, SECURITY_EVENT_WARNING } from "@/lib/auth/constants";
import { requireAdminApi } from "@/lib/auth/session";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";
import { getAuthUserByEmail, listAdminUsers, logAdminAudit, logSecurityEvent, upsertAuthUser } from "@/lib/auth-db";
import { hashPassword } from "@/lib/auth/password";

type CreateAdminBody = {
  email?: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function generateRandomPassword(length = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let result = "";
  for (let index = 0; index < length; index += 1) {
    const randomIndex = randomInt(0, chars.length);
    result += chars[randomIndex];
  }
  return result;
}

export async function GET(request: Request) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_ACCOUNTS_MANAGE,
    requireSuperAdmin: true,
    enforceCsrf: false,
  });
  if (!auth.ok) {
    return auth.response;
  }

  const admins = await listAdminUsers();
  return NextResponse.json({
    admins: admins.map((admin) => ({
      ...admin,
      isCurrentUser: admin.id === auth.context.user.id,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_ACCOUNTS_MANAGE,
    requireSuperAdmin: true,
  });
  if (!auth.ok) {
    return auth.response;
  }

  let body: CreateAdminBody;
  try {
    body = (await request.json()) as CreateAdminBody;
  } catch {
    return NextResponse.json({ message: "بيانات الطلب غير صالحة." }, { status: 400 });
  }

  const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
  if (!email || email.length > AUTH_MAX_EMAIL_LENGTH || !isValidEmail(email)) {
    return NextResponse.json({ message: "البريد الإلكتروني غير صالح." }, { status: 400 });
  }

  const existing = await getAuthUserByEmail(email);
  if (existing) {
    await logSecurityEvent({
      userId: auth.context.user.id,
      eventType: "admin.accounts.create_existing_email",
      severity: SECURITY_EVENT_WARNING,
      path: new URL(request.url).pathname,
      method: request.method,
      ipAddress: auth.context.ipAddress,
      userAgent: auth.context.userAgent,
      details: { email },
    });
    return NextResponse.json({ message: "هذا البريد مستخدم بالفعل." }, { status: 409 });
  }

  const generatedPassword = generateRandomPassword(15);
  const passwordHash = await hashPassword(generatedPassword);

  await upsertAuthUser({
    email,
    passwordHash,
    role: AUTH_ROLE_ADMIN,
    isActive: true,
    isSuperAdmin: false,
    mustChangePassword: true,
  });

  const created = await getAuthUserByEmail(email);

  await logAdminAudit({
    adminUserId: auth.context.user.id,
    action: "admin_account.create",
    resourceType: "auth_user",
    resourceId: created ? String(created.id) : null,
    path: new URL(request.url).pathname,
    method: request.method,
    ipAddress: auth.context.ipAddress,
    userAgent: auth.context.userAgent,
    details: {
      email,
      mustChangePassword: true,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      admin: created
        ? {
            id: created.id,
            email: created.email,
            role: created.role,
            isActive: created.isActive,
            isSuperAdmin: created.isSuperAdmin,
            mustChangePassword: created.mustChangePassword,
            lastLoginAt: created.lastLoginAt,
          }
        : null,
      generatedPassword,
      message: "تم إنشاء الحساب الإداري بنجاح.",
    },
    { status: 201 },
  );
}
