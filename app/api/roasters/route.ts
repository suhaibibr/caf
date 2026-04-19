import { NextResponse } from "next/server";
import { listRoasters, saveRoaster } from "@/lib/roasters-db";
import { requireAdminApi } from "@/lib/auth/session";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";
import { logAdminAudit } from "@/lib/auth-db";

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request: Request) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_ROASTERS_MANAGE,
    enforceCsrf: false,
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const roasters = await listRoasters();
    return NextResponse.json(roasters);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "تعذر تحميل المحامص.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_ROASTERS_MANAGE,
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      image?: string;
    };

    const name = body.name?.trim() ?? "";
    const image = body.image?.trim() ?? "";

    if (!name || !image) {
      return NextResponse.json(
        { message: "الاسم والصورة مطلوبان." },
        { status: 400 },
      );
    }

    const existing = await listRoasters();
    const baseSlug = createSlug(name) || `roaster-${Date.now()}`;
    const slug = existing.some((roaster) => roaster.slug === baseSlug)
      ? `${baseSlug}-${Date.now()}`
      : baseSlug;

    await saveRoaster({
      slug,
      name,
      shortName: name,
      description: "",
      about: "",
      location: "",
      logo: name.slice(0, 2).toUpperCase(),
      coverImage: image,
      accent: "#A06B42",
      featured: false,
    });

    const roaster = (await listRoasters()).find((item) => item.slug === slug) ?? null;
    await logAdminAudit({
      adminUserId: auth.context.user.id,
      action: "roaster.create",
      resourceType: "roaster",
      resourceId: slug,
      path: new URL(request.url).pathname,
      method: request.method,
      ipAddress: auth.context.ipAddress,
      userAgent: auth.context.userAgent,
      details: { name },
    });
    return NextResponse.json(roaster, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "تعذر حفظ المحمصة.",
      },
      { status: 500 },
    );
  }
}
