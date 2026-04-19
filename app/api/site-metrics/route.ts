import { NextResponse } from "next/server";
import { getSiteMetrics, trackSiteSession } from "@/lib/site-metrics-db";
import { requireAdminApi } from "@/lib/auth/session";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";

export async function GET(request: Request) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_ANALYTICS_READ,
    enforceCsrf: false,
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const metrics = await getSiteMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "تعذر تحميل الإحصائيات.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { sessionId?: string };
    const sessionId = body.sessionId?.trim() ?? "";

    if (!sessionId || sessionId.length > 191) {
      return NextResponse.json(
        { message: "معرف الجلسة غير صالح." },
        { status: 400 },
      );
    }

    await trackSiteSession(sessionId);
    const metrics = await getSiteMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "تعذر تحديث الإحصائيات.",
      },
      { status: 500 },
    );
  }
}
