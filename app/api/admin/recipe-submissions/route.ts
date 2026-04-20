import { NextResponse } from "next/server";
import { RBAC_PERMISSIONS } from "@/lib/auth/rbac";
import { requireAdminApi } from "@/lib/auth/session";
import { logAdminAudit } from "@/lib/auth-db";
import type { Roaster } from "@/lib/data";
import { MISC_RECIPES_LABEL } from "@/lib/misc-recipes-roaster";
import {
  deleteRecipeSubmissions,
  getRecipeSubmissionById,
  listRecipeSubmissions,
  setRecipeSubmissionsStatus,
  updateRecipeSubmission,
  type RecipeSubmissionRecord,
  type RecipeSubmissionStatus,
} from "@/lib/recipe-submissions-db";
import { listRoasters } from "@/lib/roasters-db";
import {
  deleteManagedRecipe,
  listManagedRecipes,
  saveManagedRecipe,
} from "@/lib/recipes-db";

type BulkActionBody =
  | {
      action: "mark-reviewed" | "delete" | "approve";
      ids: number[];
    }
  | {
      action: "update";
      ids: number[];
      payload: {
        name?: string;
        authorName?: string;
        grams?: number;
        iceGrams?: number | null;
        pourCount?: number | null;
        firstPourTemperature?: number | null;
        pourSteps?: RecipeSubmissionRecord["pourSteps"];
        brewer?: string;
        ratioInput?: string;
        roasterSlug?: string | null;
        roasterName?: string | null;
        brewType?: "hot" | "cold";
        xbloomUrl?: string;
      };
    };

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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
      return `id:${decodeURIComponent(id).trim()}`;
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

function sanitizeSubmissionInput(
  source: RecipeSubmissionRecord,
  payload: NonNullable<Extract<BulkActionBody, { action: "update" }>["payload"]>,
) {
  const name = typeof payload.name === "string" ? payload.name.trim() : source.name;
  const authorName =
    typeof payload.authorName === "string" ? payload.authorName.trim() : source.authorName;
  const grams =
    payload.grams !== undefined && payload.grams !== null ? Number(payload.grams) : source.grams;
  const brewer = typeof payload.brewer === "string" ? payload.brewer.trim() : source.brewer;
  const ratioInput =
    typeof payload.ratioInput === "string" ? payload.ratioInput.trim() : source.ratioInput;
  const brewType = payload.brewType === "cold" ? "cold" : payload.brewType === "hot" ? "hot" : source.brewType;
  const xbloomUrl =
    typeof payload.xbloomUrl === "string" ? payload.xbloomUrl.trim() : source.xbloomUrl;
  const iceGrams =
    payload.iceGrams !== undefined
      ? payload.iceGrams === null || `${payload.iceGrams}`.trim() === ""
        ? null
        : Number(payload.iceGrams)
      : source.iceGrams;
  const pourCount =
    payload.pourCount !== undefined
      ? payload.pourCount === null || `${payload.pourCount}`.trim() === ""
        ? null
        : Number(payload.pourCount)
      : source.pourCount;
  const firstPourTemperature =
    payload.firstPourTemperature !== undefined
      ? payload.firstPourTemperature === null || `${payload.firstPourTemperature}`.trim() === ""
        ? null
        : Number(payload.firstPourTemperature)
      : source.firstPourTemperature;
  const pourSteps = Array.isArray(payload.pourSteps) ? payload.pourSteps : source.pourSteps;
  const roasterSlug =
    typeof payload.roasterSlug === "string"
      ? payload.roasterSlug.trim() || null
      : payload.roasterSlug === null
        ? null
        : source.roasterSlug;
  const roasterName =
    typeof payload.roasterName === "string"
      ? payload.roasterName.trim() || null
      : payload.roasterName === null
        ? null
        : source.roasterName;

  if (!name || !authorName || !brewer || !ratioInput || !xbloomUrl) {
    throw new Error("الحقول المطلوبة غير مكتملة.");
  }
  if (!Number.isFinite(grams) || grams <= 0) {
    throw new Error("كمية البن غير صالحة.");
  }
  if (brewType === "cold" && (!Number.isFinite(iceGrams) || (iceGrams ?? 0) <= 0)) {
    throw new Error("جرامات الثلج مطلوبة للوصفة الباردة.");
  }

  return {
    name,
    authorName,
    grams,
    brewer,
    ratioInput,
    brewType,
    xbloomUrl,
    iceGrams: brewType === "cold" ? Math.round(iceGrams ?? 0) : null,
    pourCount:
      Number.isFinite(pourCount) && (pourCount ?? 0) > 0 ? Math.round(pourCount ?? 0) : null,
    firstPourTemperature:
      Number.isFinite(firstPourTemperature) && (firstPourTemperature ?? 0) > 0
        ? Number(firstPourTemperature)
        : null,
    pourSteps,
    roasterSlug,
    roasterName,
  };
}

export async function GET(request: Request) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_RECIPES_MANAGE,
    enforceCsrf: false,
  });
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "pending") as RecipeSubmissionStatus;
  const normalizedStatus: RecipeSubmissionStatus =
    status === "approved" || status === "reviewed" || status === "rejected" ? status : "pending";

  const submissions = await listRecipeSubmissions(normalizedStatus);
  return NextResponse.json({ submissions });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi(request, {
    permission: RBAC_PERMISSIONS.ADMIN_RECIPES_MANAGE,
  });
  if (!auth.ok) {
    return auth.response;
  }

  let body: BulkActionBody;
  try {
    body = (await request.json()) as BulkActionBody;
  } catch {
    return NextResponse.json({ message: "بيانات الطلب غير صالحة." }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ message: "لا توجد وصفات محددة." }, { status: 400 });
  }

  if (body.action === "mark-reviewed") {
    const affected = await setRecipeSubmissionsStatus({
      ids,
      status: "reviewed",
      reviewedBy: auth.context.user.id,
    });
    await logAdminAudit({
      adminUserId: auth.context.user.id,
      action: "recipe_submission.mark_reviewed",
      resourceType: "recipe_submission",
      path: new URL(request.url).pathname,
      method: request.method,
      ipAddress: auth.context.ipAddress,
      userAgent: auth.context.userAgent,
      details: { ids, affected },
    });
    return NextResponse.json({ ok: true, affected });
  }

  if (body.action === "delete") {
    const submissionsToDelete = await Promise.all(
      ids.map((id) => getRecipeSubmissionById(id)),
    );
    const existingRecipes = await listManagedRecipes();
    const recipeSlugByXbloomKey = new Map(
      existingRecipes.map((recipe) => [normalizeXbloomUrl(recipe.xbloomUrl), recipe.slug]),
    );
    const recipeSlugsToDelete = new Set<string>();

    submissionsToDelete.forEach((submission) => {
      if (!submission) {
        return;
      }
      const matchedSlug = recipeSlugByXbloomKey.get(
        normalizeXbloomUrl(submission.xbloomUrl),
      );
      if (matchedSlug) {
        recipeSlugsToDelete.add(matchedSlug);
      }
    });

    for (const recipeSlug of recipeSlugsToDelete) {
      await deleteManagedRecipe(recipeSlug);
    }

    const affected = await deleteRecipeSubmissions(ids);
    await logAdminAudit({
      adminUserId: auth.context.user.id,
      action: "recipe_submission.delete",
      resourceType: "recipe_submission",
      path: new URL(request.url).pathname,
      method: request.method,
      ipAddress: auth.context.ipAddress,
      userAgent: auth.context.userAgent,
      details: {
        ids,
        affected,
        deletedRecipeSlugs: [...recipeSlugsToDelete],
      },
    });
    return NextResponse.json({
      ok: true,
      affected,
      deletedRecipes: recipeSlugsToDelete.size,
    });
  }

  if (body.action === "update") {
    if (ids.length !== 1) {
      return NextResponse.json({ message: "تعديل البيانات يحتاج وصفة واحدة فقط." }, { status: 400 });
    }
    const submission = await getRecipeSubmissionById(ids[0]);
    if (!submission) {
      return NextResponse.json({ message: "الوصفة غير موجودة." }, { status: 404 });
    }
    const normalized = sanitizeSubmissionInput(submission, body.payload ?? {});
    await updateRecipeSubmission({
      id: submission.id,
      ...normalized,
    });
    await logAdminAudit({
      adminUserId: auth.context.user.id,
      action: "recipe_submission.update",
      resourceType: "recipe_submission",
      resourceId: String(submission.id),
      path: new URL(request.url).pathname,
      method: request.method,
      ipAddress: auth.context.ipAddress,
      userAgent: auth.context.userAgent,
      details: { name: normalized.name },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "approve") {
    const existingRecipes = await listManagedRecipes();
    const existingSlugs = new Set(existingRecipes.map((recipe) => recipe.slug));
    const existingXbloom = new Set(
      existingRecipes.map((recipe) => normalizeXbloomUrl(recipe.xbloomUrl)),
    );
    const roasters = await listRoasters();
    const approvedIds: number[] = [];
    const skipped: Array<{ id: number; reason: string }> = [];

    for (const id of ids) {
      const submission = await getRecipeSubmissionById(id);
      if (!submission) {
        skipped.push({ id, reason: "غير موجودة" });
        continue;
      }

      const normalizedXbloom = normalizeXbloomUrl(submission.xbloomUrl);
      if (existingXbloom.has(normalizedXbloom)) {
        skipped.push({ id, reason: "رابط xBloom موجود مسبقًا" });
        continue;
      }

      const baseSlug = createSlug(submission.name) || `recipe-${Date.now()}`;
      let slug = baseSlug;
      let counter = 1;
      while (existingSlugs.has(slug)) {
        counter += 1;
        slug = `${baseSlug}-${counter}`;
      }
      existingSlugs.add(slug);
      existingXbloom.add(normalizedXbloom);

      const { waterMl, ratio } = parseRatioField(submission.ratioInput);
      const fallbackRoasterName = submission.roasterName?.trim() || null;
      const matchedRoaster = resolveRoaster(
        roasters,
        submission.roasterSlug,
        fallbackRoasterName,
      );
      const resolvedRoasterName = matchedRoaster?.name ?? fallbackRoasterName ?? MISC_RECIPES_LABEL;

      await saveManagedRecipe({
        slug,
        name: submission.name,
        authorName: submission.authorName,
        isRoasterApproved: Boolean(matchedRoaster),
        brewer: submission.brewer,
        grams: submission.grams,
        iceGrams: submission.brewType === "cold" ? submission.iceGrams : null,
        pourCount: submission.pourCount,
        firstPourTemperature: submission.firstPourTemperature,
        pourSteps: submission.pourSteps,
        ratio,
        waterMl,
        roasterSlug: matchedRoaster?.slug ?? null,
        roasterName: resolvedRoasterName,
        mergeGroupKey: null,
        brewType: submission.brewType,
        xbloomUrl: submission.xbloomUrl,
      });

      approvedIds.push(id);
    }

    if (approvedIds.length > 0) {
      await setRecipeSubmissionsStatus({
        ids: approvedIds,
        status: "approved",
        reviewedBy: auth.context.user.id,
      });
    }

    await logAdminAudit({
      adminUserId: auth.context.user.id,
      action: "recipe_submission.approve",
      resourceType: "recipe_submission",
      path: new URL(request.url).pathname,
      method: request.method,
      ipAddress: auth.context.ipAddress,
      userAgent: auth.context.userAgent,
      details: {
        ids,
        approvedIds,
        skipped,
      },
    });

    return NextResponse.json({
      ok: true,
      approved: approvedIds.length,
      skipped,
    });
  }

  return NextResponse.json({ message: "إجراء غير معروف." }, { status: 400 });
}
