import { NextResponse } from "next/server";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";
import { requireAdminApi } from "@/lib/auth/session";
import { countSuperAdminUsers, deleteAdminUserById, getAuthUserById, logAdminAudit } from "@/lib/auth-db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_ACCOUNTS_MANAGE,
    requireSuperAdmin: true,
  });
  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const userId = Number(id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return NextResponse.json({ message: "معرف الحساب غير صالح." }, { status: 400 });
  }
  if (userId === auth.context.user.id) {
    return NextResponse.json({ message: "لا يمكن حذف حسابك الحالي." }, { status: 400 });
  }

  const target = await getAuthUserById(userId);
  if (!target || target.role !== "admin") {
    return NextResponse.json({ message: "الحساب الإداري غير موجود." }, { status: 404 });
  }

  if (target.isSuperAdmin) {
    const superCount = await countSuperAdminUsers();
    if (superCount <= 1) {
      return NextResponse.json(
        { message: "لا يمكن حذف آخر حساب بصلاحية عليا." },
        { status: 400 },
      );
    }
  }

  const deleted = await deleteAdminUserById(userId);
  if (!deleted) {
    return NextResponse.json({ message: "تعذر حذف الحساب." }, { status: 500 });
  }

  await logAdminAudit({
    adminUserId: auth.context.user.id,
    action: "admin_account.delete",
    resourceType: "auth_user",
    resourceId: String(userId),
    path: new URL(request.url).pathname,
    method: request.method,
    ipAddress: auth.context.ipAddress,
    userAgent: auth.context.userAgent,
    details: {
      email: target.email,
      wasSuperAdmin: target.isSuperAdmin,
    },
  });

  return NextResponse.json({ ok: true });
}

