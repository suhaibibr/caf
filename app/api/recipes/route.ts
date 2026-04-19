import { NextResponse } from "next/server";
import type { Roaster } from "@/lib/data";
import { listRoasters } from "@/lib/roasters-db";
import {
  getManagedRecipeBySlug,
  listManagedRecipes,
  saveManagedRecipe,
} from "@/lib/recipes-db";
import { requireAdminApi } from "@/lib/auth/session";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";
import { logAdminAudit } from "@/lib/auth-db";

function createSlug(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || `recipe-${Date.now()}`;
}

function parseRatioField(value: string) {
  const normalized = value.trim();
  const waterMatch = normalized.match(/(\d+(?:\.\d+)?)\s*ml/i);
  const ratioMatch = normalized.match(/1\s*:\s*\d+(?:\.\d+)?/i);

  return {
    waterMl: waterMatch ? Math.round(Number(waterMatch[1])) : null,
    ratio: ratioMatch ? ratioMatch[0].replace(/\s+/g, "") : normalized,
  };
}

function normalizeXbloomUrl(value: string) {
  const raw = value.trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    const id = parsed.searchParams.get("id");

    if (id) {
      try {
        return `id:${decodeURIComponent(id).trim()}`;
      } catch {
        return `id:${id.trim()}`;
      }
    }

    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "");
    const query = parsed.searchParams.toString();
    return `${host}${path}${query ? `?${query}` : ""}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

function resolveRoaster(roasters: Roaster[], slug: string | null, name: string | null) {
  if (slug) {
    return roasters.find((roaster) => roaster.slug === slug) ?? null;
  }

  if (!name) {
    return null;
  }

  const normalized = name.trim();
  if (!normalized) {
    return null;
  }

  return (
    roasters.find(
      (roaster) =>
        roaster.name === normalized || roaster.shortName === normalized,
    ) ?? null
  );
}

export async function GET(request: Request) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_RECIPES_MANAGE,
    enforceCsrf: false,
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const recipes = await listManagedRecipes();
    return NextResponse.json(recipes);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "تعذر تحميل الوصفات.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_RECIPES_MANAGE,
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      authorName?: string;
      isRoasterApproved?: boolean;
      brewer?: string;
      grams?: number;
      iceGrams?: number | null;
      pourCount?: number | null;
      firstPourTemperature?: number | null;
      pourSteps?: Array<{
        name?: string;
        volumeMl?: number | null;
        temperatureC?: number | null;
        seconds?: number | null;
      }>;
      ratioInput?: string;
      roasterSlug?: string | null;
      roasterName?: string | null;
      mergeWithRecipeSlug?: string | null;
      mergeGroupKey?: string | null;
      brewType?: "hot" | "cold" | "filter";
      xbloomUrl?: string;
    };

    const name = body.name?.trim() ?? "";
    const authorName = body.authorName?.trim() ?? "";
    const isRoasterApproved = Boolean(body.isRoasterApproved);
    const brewer = body.brewer?.trim() ?? "";
    const grams = Number(body.grams);
    const ratioInput = body.ratioInput?.trim() ?? "";
    const xbloomUrl = body.xbloomUrl?.trim() ?? "";
    const brewType = body.brewType;
    const rawIceGrams = body.iceGrams;
    const rawPourCount = body.pourCount;
    const rawFirstPourTemperature = body.firstPourTemperature;
    const mergeWithRecipeSlug =
      typeof body.mergeWithRecipeSlug === "string"
        ? body.mergeWithRecipeSlug.trim()
        : "";
    const mergeGroupKeyInput =
      typeof body.mergeGroupKey === "string" ? body.mergeGroupKey.trim() : "";
    const hasIceValue = rawIceGrams !== null && rawIceGrams !== undefined && `${rawIceGrams}`.trim() !== "";
    const iceGrams = hasIceValue ? Number(rawIceGrams) : null;
    const hasPourCountValue =
      rawPourCount !== null &&
      rawPourCount !== undefined &&
      `${rawPourCount}`.trim() !== "";
    const pourCount = hasPourCountValue ? Number(rawPourCount) : null;
    const hasFirstTempValue =
      rawFirstPourTemperature !== null &&
      rawFirstPourTemperature !== undefined &&
      `${rawFirstPourTemperature}`.trim() !== "";
    const firstPourTemperature = hasFirstTempValue
      ? Number(rawFirstPourTemperature)
      : null;
    const pourSteps = Array.isArray(body.pourSteps)
      ? body.pourSteps.map((step, index) => ({
          name: step.name?.trim() || `صبة ${index + 1}`,
          volumeMl:
            step.volumeMl !== null &&
            step.volumeMl !== undefined &&
            Number.isFinite(Number(step.volumeMl))
              ? Number(step.volumeMl)
              : null,
          temperatureC:
            step.temperatureC !== null &&
            step.temperatureC !== undefined &&
            Number.isFinite(Number(step.temperatureC))
              ? Number(step.temperatureC)
              : null,
          seconds:
            step.seconds !== null &&
            step.seconds !== undefined &&
            Number.isFinite(Number(step.seconds))
              ? Number(step.seconds)
              : null,
        }))
      : [];

    if (
      !name ||
      !authorName ||
      !brewer ||
      !Number.isFinite(grams) ||
      grams <= 0 ||
      !ratioInput ||
      !xbloomUrl ||
      !brewType
    ) {
      return NextResponse.json(
        { message: "الحقول المطلوبة غير مكتملة." },
        { status: 400 },
      );
    }

    if (brewType === "cold" && (!Number.isFinite(iceGrams) || (iceGrams ?? 0) <= 0)) {
      return NextResponse.json(
        { message: "جرامات الثلج مطلوبة للوصفة الباردة." },
        { status: 400 },
      );
    }

    const roasters = await listRoasters();
    const matchedRoaster = resolveRoaster(
      roasters,
      body.roasterSlug ?? null,
      body.roasterName ?? null,
    );
    const { waterMl, ratio } = parseRatioField(ratioInput);
    const existing = await listManagedRecipes();
    const incomingKey = normalizeXbloomUrl(xbloomUrl);
    const duplicateRecipe = existing.find(
      (recipe) => normalizeXbloomUrl(recipe.xbloomUrl) === incomingKey,
    );

    if (duplicateRecipe) {
      return NextResponse.json(
        {
          message: `هذا الرابط مضاف مسبقًا في وصفة "${duplicateRecipe.name}".`,
        },
        { status: 409 },
      );
    }

    let mergeGroupKey: string | null = mergeGroupKeyInput || null;
    if (mergeWithRecipeSlug) {
      const linkedRecipe = await getManagedRecipeBySlug(mergeWithRecipeSlug);
      if (!linkedRecipe) {
        return NextResponse.json(
          { message: "الوصفة المراد الدمج معها غير موجودة." },
          { status: 404 },
        );
      }

      mergeGroupKey =
        linkedRecipe.mergeGroupKey?.trim() || linkedRecipe.slug;
    }

    const baseSlug = createSlug(name);
    const slug = existing.some((recipe) => recipe.slug === baseSlug)
      ? `${baseSlug}-${Date.now()}`
      : baseSlug;

    await saveManagedRecipe({
      slug,
      name,
      authorName,
      isRoasterApproved,
      brewer,
      grams,
      iceGrams: brewType === "cold" ? Math.round(iceGrams ?? 0) : null,
      pourCount:
        Number.isFinite(pourCount) && (pourCount ?? 0) > 0
          ? Math.round(pourCount ?? 0)
          : null,
      firstPourTemperature:
        Number.isFinite(firstPourTemperature) && (firstPourTemperature ?? 0) > 0
          ? Number(firstPourTemperature)
          : null,
      pourSteps,
      ratio,
      waterMl,
      roasterSlug: matchedRoaster?.slug ?? null,
      roasterName: matchedRoaster?.name ?? body.roasterName?.trim() ?? null,
      mergeGroupKey,
      brewType,
      xbloomUrl,
    });

    const created = (await listManagedRecipes()).find((recipe) => recipe.slug === slug);
    await logAdminAudit({
      adminUserId: auth.context.user.id,
      action: "recipe.create",
      resourceType: "recipe",
      resourceId: slug,
      path: new URL(request.url).pathname,
      method: request.method,
      ipAddress: auth.context.ipAddress,
      userAgent: auth.context.userAgent,
      details: {
        name,
        roasterSlug: matchedRoaster?.slug ?? null,
        brewType,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "تعذر حفظ الوصفة الآن.",
      },
      { status: 500 },
    );
  }
}
