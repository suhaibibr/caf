import { NextResponse } from "next/server";

function extractXbloomId(url: string) {
  try {
    const parsedUrl = new URL(url);
    const id = parsedUrl.searchParams.get("id");
    return id ? decodeURIComponent(id) : null;
  } catch {
    return null;
  }
}

function mapBrewerName(cupTypeName: string | undefined) {
  switch ((cupTypeName || "").toUpperCase()) {
    case "XPOD":
      return "xPod";
    case "OMNI":
      return "Omni";
    case "OMNI BREWER":
      return "Omni Brewer";
    case "OTHER":
      return "Other";
    default:
      return "Other";
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      url?: string;
    };

    const url = body.url?.trim() ?? "";
    if (!url) {
      return NextResponse.json(
        { message: "رابط xBloom مطلوب." },
        { status: 400 },
      );
    }

    const tableIdOfRSA = extractXbloomId(url);
    if (!tableIdOfRSA) {
      return NextResponse.json(
        { message: "تعذر قراءة id من رابط xBloom." },
        { status: 400 },
      );
    }

    const response = await fetch("https://client-api.xbloom.com/RecipeDetail.html", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tableIdOfRSA,
        interfaceVersion: 19700101,
        skey: "testskey",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: "تعذر جلب الوصفة من xBloom." },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      result?: string;
      info?: string;
      shareMemberName?: string;
      recipeVo?: {
        theName?: string;
        dose?: number;
        grandWater?: number;
        cupTypeName?: string;
        pourCount?: number;
        pourList?: Array<{
          temperature?: number;
          volume?: number;
          pausing?: number;
          theName?: string;
        }>;
      };
    };

    if (data.result !== "success" || !data.recipeVo) {
      return NextResponse.json(
        { message: data.info || "لم يتم العثور على بيانات الوصفة." },
        { status: 400 },
      );
    }

    const dose = Number(data.recipeVo.dose ?? 0);
    const ratioNumber = Number(data.recipeVo.grandWater ?? 0);
    const waterMl =
      dose > 0 && ratioNumber > 0 ? Math.round(dose * ratioNumber) : null;
    const pourCount = Number(data.recipeVo.pourCount ?? 0);
    const pourSteps =
      data.recipeVo.pourList?.map((pour, index) => ({
        name: pour.theName?.trim() || `صبة ${index + 1}`,
        volumeMl:
          Number(pour.volume ?? 0) > 0 ? Number(pour.volume ?? 0) : null,
        temperatureC:
          Number(pour.temperature ?? 0) > 0
            ? Number(pour.temperature ?? 0)
            : null,
        seconds:
          Number(pour.pausing ?? 0) > 0 ? Number(pour.pausing ?? 0) : null,
      })) ?? [];
    const firstPour = pourSteps[0];

    return NextResponse.json({
      name: data.recipeVo.theName ?? "",
      authorName: data.shareMemberName ?? "",
      grams: dose || null,
      waterMl,
      ratio: ratioNumber > 0 ? `1:${ratioNumber}` : "",
      pourCount: pourCount > 0 ? pourCount : null,
      firstPourTemperature:
        Number(firstPour?.temperatureC ?? 0) > 0
          ? Number(firstPour?.temperatureC ?? 0)
          : null,
      pourSteps,
      brewer: mapBrewerName(data.recipeVo.cupTypeName),
      rawCupType: data.recipeVo.cupTypeName ?? "OTHER",
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "تعذر الاتصال بـ xBloom.",
      },
      { status: 500 },
    );
  }
}
