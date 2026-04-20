import { NextResponse } from "next/server";
import { getDbErrorCode, isRecoverableDbError } from "@/lib/db-errors";
import { isNeonConfigured, pingNeon } from "@/lib/neon";

export async function GET() {
  if (!isNeonConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        message: "DATABASE_URL غير مضبوط بعد. اربط Neon أولاً.",
      },
      { status: 503 },
    );
  }

  try {
    const data = await pingNeon();
    return NextResponse.json({
      ok: true,
      driver: "pg",
      provider: "neon-postgres",
      ...data,
    });
  } catch (error) {
    if (isRecoverableDbError(error)) {
      return NextResponse.json(
        {
          ok: false,
          code: getDbErrorCode(error) || "recoverable-db-error",
          message: "تعذر الاتصال بـ Neon حالياً.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        code: getDbErrorCode(error) || "unknown",
        message:
          error instanceof Error ? error.message : "Unknown Neon connection error",
      },
      { status: 500 },
    );
  }
}
