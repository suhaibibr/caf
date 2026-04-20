import { NextResponse } from "next/server";
import type { Roaster } from "@/lib/data";
import {
  MISC_RECIPES_LABEL,
  isMiscRecipesName,
  isMiscRecipesSlug,
} from "@/lib/misc-recipes-roaster";
import { listRoasters } from "@/lib/roasters-db";
import {
  deleteManagedRecipe,
  getManagedRecipeBySlug,
  listManagedRecipes,
  saveManagedRecipe,
} from "@/lib/recipes-db";
import { requireAdminApi } from "@/lib/auth/session";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";
import { logAdminAudit } from "@/lib/auth-db";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

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

  if (isMiscRecipesName(normalized)) {
    return (
      roasters.find(
        (roaster) =>
          isMiscRecipesSlug(roaster.slug) ||
          isMiscRecipesName(roaster.name) ||
          isMiscRecipesName(roaster.shortName),
      ) ?? null
    );
  }

  return (
    roasters.find(
      (roaster) =>
        roaster.name === normalized || roaster.shortName === normalized,
    ) ?? null
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_RECIPES_MANAGE,
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { slug } = await context.params;
    const currentRecipe = await getManagedRecipeBySlug(slug);

    if (!currentRecipe) {
      return NextResponse.json(
        { message: "الوصفة المحددة غير موجودة." },
        { status: 404 },
      );
    }

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

    const hasName = typeof body.name === "string";
    const hasAuthor = typeof body.authorName === "string";
    const hasBrewer = typeof body.brewer === "string";
    const hasRatioInput = typeof body.ratioInput === "string";
    const hasBrewType = body.brewType === "hot" || body.brewType === "cold" || body.brewType === "filter";
    const hasXbloom = typeof body.xbloomUrl === "string";
    const hasGrams = body.grams !== undefined && body.grams !== null;
    const hasIceGrams = body.iceGrams !== undefined;
    const hasPourCount = body.pourCount !== undefined;
    const hasFirstTemp = body.firstPourTemperature !== undefined;
    const hasPourSteps = Array.isArray(body.pourSteps);
    const hasApproved = typeof body.isRoasterApproved === "boolean";
    const hasRoasterFields = "roasterSlug" in body || "roasterName" in body;
    const hasMergeFields = "mergeWithRecipeSlug" in body || "mergeGroupKey" in body;

    const name = hasName ? body.name?.trim() ?? "" : currentRecipe.name;
    const authorName = hasAuthor ? body.authorName?.trim() ?? "" : currentRecipe.authorName;
    const brewer = hasBrewer ? body.brewer?.trim() ?? "" : currentRecipe.brewer;
    const grams = hasGrams ? Number(body.grams) : currentRecipe.grams;
    const xbloomUrl = hasXbloom ? body.xbloomUrl?.trim() ?? "" : currentRecipe.xbloomUrl;
    const brewType = hasBrewType ? body.brewType : currentRecipe.brewType;

    const iceGrams =
      hasIceGrams
        ? body.iceGrams === null || `${body.iceGrams}`.trim() === ""
          ? null
          : Number(body.iceGrams)
        : currentRecipe.iceGrams;
    const pourCount =
      hasPourCount
        ? body.pourCount === null || `${body.pourCount}`.trim() === ""
          ? null
          : Number(body.pourCount)
        : currentRecipe.pourCount;
    const firstPourTemperature =
      hasFirstTemp
        ? body.firstPourTemperature === null || `${body.firstPourTemperature}`.trim() === ""
          ? null
          : Number(body.firstPourTemperature)
        : currentRecipe.firstPourTemperature;

    const pourSteps = hasPourSteps
      ? (body.pourSteps ?? []).map((step, index) => ({
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
      : currentRecipe.pourSteps;

    if (!name || !authorName || !brewer || !Number.isFinite(grams) || grams <= 0 || !xbloomUrl || !brewType) {
      return NextResponse.json(
        { message: "الحقول المطلوبة غير مكتملة." },
        { status: 400 },
      );
    }

    let ratio = currentRecipe.ratio;
    let waterMl = currentRecipe.waterMl;
    if (hasRatioInput) {
      const ratioInput = body.ratioInput?.trim() ?? "";
      if (!ratioInput) {
        return NextResponse.json(
          { message: "النسبة مطلوبة." },
          { status: 400 },
        );
      }
      const parsedRatio = parseRatioField(ratioInput);
      ratio = parsedRatio.ratio;
      waterMl = parsedRatio.waterMl;
    }

    if (brewType === "cold" && (!Number.isFinite(iceGrams) || (iceGrams ?? 0) <= 0)) {
      return NextResponse.json(
        { message: "جرامات الثلج مطلوبة للوصفة الباردة." },
        { status: 400 },
      );
    }

    let roasterSlug = currentRecipe.roasterSlug;
    let roasterName = currentRecipe.roasterName;
    if (hasRoasterFields) {
      const requestedSlug =
        typeof body.roasterSlug === "string" && body.roasterSlug.trim()
          ? body.roasterSlug.trim()
          : null;
      const requestedName =
        typeof body.roasterName === "string" && body.roasterName.trim()
          ? body.roasterName.trim()
          : null;

      if (!requestedSlug && !requestedName) {
        roasterSlug = null;
        roasterName = MISC_RECIPES_LABEL;
      } else {
        const roasters = await listRoasters();
        const matched = resolveRoaster(roasters, requestedSlug, requestedName);
        roasterSlug = matched?.slug ?? requestedSlug;
        roasterName = matched?.name ?? requestedName;
      }
    }

    let mergeGroupKey = currentRecipe.mergeGroupKey;
    if (hasMergeFields) {
      const requestedMergeWithSlug =
        typeof body.mergeWithRecipeSlug === "string"
          ? body.mergeWithRecipeSlug.trim()
          : "";
      const requestedMergeKey =
        typeof body.mergeGroupKey === "string"
          ? body.mergeGroupKey.trim()
          : "";

      if (requestedMergeWithSlug) {
        const mergeTarget = await getManagedRecipeBySlug(requestedMergeWithSlug);
        if (!mergeTarget || mergeTarget.slug === currentRecipe.slug) {
          return NextResponse.json(
            { message: "الوصفة المراد الدمج معها غير موجودة." },
            { status: 404 },
          );
        }

        mergeGroupKey = mergeTarget.mergeGroupKey?.trim() || mergeTarget.slug;
      } else if (requestedMergeKey) {
        mergeGroupKey = requestedMergeKey;
      } else {
        mergeGroupKey = null;
      }
    }

    const allRecipes = await listManagedRecipes();
    const incomingKey = normalizeXbloomUrl(xbloomUrl);
    const duplicateRecipe = allRecipes.find(
      (recipe) =>
        recipe.slug !== currentRecipe.slug &&
        normalizeXbloomUrl(recipe.xbloomUrl) === incomingKey,
    );

    if (duplicateRecipe) {
      return NextResponse.json(
        {
          message: `هذا الرابط مضاف مسبقًا في وصفة "${duplicateRecipe.name}".`,
        },
        { status: 409 },
      );
    }

    await saveManagedRecipe({
      slug: currentRecipe.slug,
      name,
      authorName,
      isRoasterApproved: hasApproved ? body.isRoasterApproved ?? false : currentRecipe.isRoasterApproved,
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
      roasterSlug,
      roasterName,
      mergeGroupKey,
      brewType,
      xbloomUrl,
    });

    const updated = await getManagedRecipeBySlug(currentRecipe.slug);
    await logAdminAudit({
      adminUserId: auth.context.user.id,
      action: "recipe.update",
      resourceType: "recipe",
      resourceId: currentRecipe.slug,
      path: new URL(request.url).pathname,
      method: request.method,
      ipAddress: auth.context.ipAddress,
      userAgent: auth.context.userAgent,
      details: {
        name,
        roasterSlug,
        brewType,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "تعذر تعديل الوصفة.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_RECIPES_MANAGE,
  });
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { slug } = await context.params;
    await deleteManagedRecipe(slug);
    await logAdminAudit({
      adminUserId: auth.context.user.id,
      action: "recipe.delete",
      resourceType: "recipe",
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
          error instanceof Error ? error.message : "تعذر حذف الوصفة.",
      },
      { status: 500 },
    );
  }
}
