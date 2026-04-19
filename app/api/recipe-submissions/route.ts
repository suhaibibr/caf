import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { getClientIp, isTrustedOrigin } from "@/lib/auth/request";
import { createRecipeSubmission, ensureRecipeSubmissionsReady } from "@/lib/recipe-submissions-db";

type SubmissionBody = {
  name?: string;
  authorName?: string;
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
  brewer?: string;
  ratioInput?: string;
  roasterSlug?: string | null;
  roasterName?: string | null;
  brewType?: "hot" | "cold";
  xbloomUrl?: string;
};

type CountRow = RowDataPacket & {
  count: number;
};

function sanitizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function isValidXbloomUrl(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const protocol = parsed.protocol.toLowerCase();
    return (
      (protocol === "https:" || protocol === "http:") &&
      host.includes("xbloom")
    );
  } catch {
    return false;
  }
}

async function isIpRateLimited(ipAddress: string) {
  await ensureRecipeSubmissionsReady();
  const pool = getDbPool();
  const [rows] = await pool.execute<CountRow[]>(
    `
      SELECT COUNT(*) AS count
      FROM recipe_submissions
      WHERE submitter_ip = ?
        AND created_at >= (NOW() - INTERVAL 10 MINUTE)
    `,
    [ipAddress],
  );
  return Number(rows[0]?.count ?? 0) >= 10;
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) {
    return NextResponse.json(
      { message: "طلب غير موثوق." },
      { status: 403 },
    );
  }

  const ipAddress = getClientIp(request);
  if (await isIpRateLimited(ipAddress)) {
    return NextResponse.json(
      { message: "تم تجاوز الحد المسموح للإرسال. حاول لاحقًا." },
      { status: 429 },
    );
  }

  let body: SubmissionBody;
  try {
    body = (await request.json()) as SubmissionBody;
  } catch {
    return NextResponse.json(
      { message: "بيانات الطلب غير صالحة." },
      { status: 400 },
    );
  }

  const name = sanitizeText(body.name, 255);
  const authorName = sanitizeText(body.authorName, 255);
  const brewer = sanitizeText(body.brewer, 255);
  const ratioInput = sanitizeText(body.ratioInput, 128);
  const roasterSlug = sanitizeText(body.roasterSlug, 191) || null;
  const roasterName = sanitizeText(body.roasterName, 255) || null;
  const xbloomUrl = sanitizeText(body.xbloomUrl, 2000);
  const grams = Number(body.grams);
  const brewType = body.brewType === "cold" ? "cold" : body.brewType === "hot" ? "hot" : "";
  const hasIceValue =
    body.iceGrams !== null &&
    body.iceGrams !== undefined &&
    `${body.iceGrams}`.trim() !== "";
  const iceGrams = hasIceValue ? Number(body.iceGrams) : null;
  const hasPourCountValue =
    body.pourCount !== null &&
    body.pourCount !== undefined &&
    `${body.pourCount}`.trim() !== "";
  const pourCount = hasPourCountValue ? Number(body.pourCount) : null;
  const hasFirstTempValue =
    body.firstPourTemperature !== null &&
    body.firstPourTemperature !== undefined &&
    `${body.firstPourTemperature}`.trim() !== "";
  const firstPourTemperature = hasFirstTempValue ? Number(body.firstPourTemperature) : null;

  const pourSteps = Array.isArray(body.pourSteps)
    ? body.pourSteps.map((step, index) => ({
        name: sanitizeText(step.name, 64) || `صبة ${index + 1}`,
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
    !ratioInput ||
    !brewType ||
    !Number.isFinite(grams) ||
    grams <= 0 ||
    !xbloomUrl ||
    !isValidXbloomUrl(xbloomUrl)
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

  const submissionId = await createRecipeSubmission({
    name,
    authorName,
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
    brewer,
    ratioInput,
    roasterSlug,
    roasterName,
    brewType,
    xbloomUrl,
    submitterIp: ipAddress,
  });

  return NextResponse.json(
    {
      ok: true,
      message: "تم إرسال الوصفة للمراجعة.",
      submissionId,
    },
    { status: 201 },
  );
}

