import { NextResponse } from "next/server";
import {
  listTopXbloomRecipes,
  trackXbloomRecipeClick,
} from "@/lib/xbloom-clicks-db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 5);
    const top = await listTopXbloomRecipes(limit);
    return NextResponse.json({ top });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "تعذر تحميل إحصائيات xBloom.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { recipeSlug?: string };
    const recipeSlug = body.recipeSlug?.trim() ?? "";

    if (!recipeSlug || recipeSlug.length > 191) {
      return NextResponse.json(
        { message: "معرّف الوصفة غير صالح." },
        { status: 400 },
      );
    }

    await trackXbloomRecipeClick(recipeSlug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "تعذر تسجيل ضغطة xBloom.",
      },
      { status: 500 },
    );
  }
}
