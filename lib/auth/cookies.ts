import type { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, ADMIN_COOKIE_PATH } from "@/lib/auth/constants";

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function buildAuthCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: ADMIN_COOKIE_PATH,
    maxAge: maxAgeSeconds,
  };
}

export function buildAuthCookieClearOptions() {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: ADMIN_COOKIE_PATH,
    expires: new Date(0),
    maxAge: 0,
  };
}

export function setAuthCookieOnResponse(
  response: NextResponse,
  token: string,
  maxAgeSeconds: number,
) {
  response.cookies.set(AUTH_COOKIE_NAME, token, buildAuthCookieOptions(maxAgeSeconds));
}

export function clearAuthCookieOnResponse(
  response: NextResponse,
) {
  response.cookies.set(AUTH_COOKIE_NAME, "", buildAuthCookieClearOptions());
}
