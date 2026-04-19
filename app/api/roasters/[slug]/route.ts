import { NextResponse } from "next/server";
import { deleteRoaster, getRoasterBySlug, saveRoaster } from "@/lib/roasters-db";
import { requireAdminApi } from "@/lib/auth/session";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";
import { logAdminAudit } from "@/lib/auth-db";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_ROASTERS_MANAGE,
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { slug } = await context.params;
    const current = await getRoasterBySlug(slug);

    if (!current) {
      return NextResponse.json(
        { message: "المحمصة غير موجودة." },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      name?: string;
      image?: string;
    };

    const name = body.name?.trim() ?? current.name;
    const image = body.image?.trim() ?? current.coverImage;

    if (!name || !image) {
      return NextResponse.json(
        { message: "الاسم والصورة مطلوبان." },
        { status: 400 },
      );
    }

    await saveRoaster({
      slug: current.slug,
      name,
      shortName: name,
      description: current.description,
      about: current.about,
      location: current.location,
      logo: current.logo,
      coverImage: image,
      accent: current.accent,
      featured: Boolean(current.featured),
    });

    const updated = await getRoasterBySlug(slug);
    await logAdminAudit({
      adminUserId: auth.context.user.id,
      action: "roaster.update",
      resourceType: "roaster",
      resourceId: slug,
      path: new URL(request.url).pathname,
      method: request.method,
      ipAddress: auth.context.ipAddress,
      userAgent: auth.context.userAgent,
      details: { name, hasImageUpdate: Boolean(body.image?.trim()) },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "تعذر تحديث المحمصة.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_ROASTERS_MANAGE,
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { slug } = await context.params;
    await deleteRoaster(slug);
    await logAdminAudit({
      adminUserId: auth.context.user.id,
      action: "roaster.delete",
      resourceType: "roaster",
      resourceId: slug,
      path: new URL(request.url).pathname,
      method: request.method,
      ipAddress: auth.context.ipAddress,
      userAgent: auth.context.userAgent,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "تعذر حذف المحمصة.",
      },
      { status: 500 },
    );
  }
}
