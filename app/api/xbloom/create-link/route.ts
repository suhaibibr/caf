import { NextResponse } from "next/server";
import { createXbloomRecipeLink } from "@/lib/xbloom-create-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateLinkBody = {
  recipe?: unknown;
  source?: unknown;
};

async function readJsonSafely<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readJsonSafely<CreateLinkBody>(request);
  if (!body || !body.recipe) {
    return NextResponse.json(
      { message: "بيانات الوصفة مطلوبة لتوليد رابط xBloom." },
      { status: 400 },
    );
  }

  try {
    const url = await createXbloomRecipeLink({
      recipe: body.recipe,
      source: body.source,
    });

    return NextResponse.json({ ok: true, url });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "تعذر إنشاء رابط الوصفة عبر bloom.",
      },
      { status: 500 },
    );
  }
}
