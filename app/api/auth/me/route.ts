import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/session";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";

export async function GET(request: Request) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_DASHBOARD_READ,
    enforceCsrf: false,
  });
  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({
    id: auth.context.user.id,
    email: auth.context.user.email,
    role: auth.context.user.role,
    isSuperAdmin: auth.context.user.isSuperAdmin,
    mustChangePassword: auth.context.user.mustChangePassword,
    lastLoginAt: auth.context.user.lastLoginAt,
  });
}
