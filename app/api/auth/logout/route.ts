import { NextResponse } from "next/server";
import { clearAuthCookieOnResponse } from "@/lib/auth/cookies";
import { getClientIp, getUserAgent, isTrustedOrigin } from "@/lib/auth/request";
import { logoutFromRequest } from "@/lib/auth/session";
import { logSecurityEvent } from "@/lib/auth-db";
import { SECURITY_EVENT_WARNING } from "@/lib/auth/constants";

export async function POST(request: Request) {
  const ipAddress = getClientIp(request);
  const userAgent = getUserAgent(request);
  const pathname = new URL(request.url).pathname;

  if (!isTrustedOrigin(request)) {
    await logSecurityEvent({
      eventType: "security.csrf_blocked_logout",
      severity: SECURITY_EVENT_WARNING,
      path: pathname,
      method: "POST",
      ipAddress,
      userAgent,
    });
    return NextResponse.json(
      { message: "طلب غير موثوق." },
      { status: 403 },
    );
  }

  await logoutFromRequest(request);
  const response = NextResponse.json({ ok: true });
  clearAuthCookieOnResponse(response);
  return response;
}

