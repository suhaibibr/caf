import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, AUTH_ROLE_ADMIN } from "@/lib/auth/constants";
import { verifyAuthToken } from "@/lib/auth/token";

function buildLoginUrl(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return url;
}

export function proxy(request: NextRequest) {
  const tokenValue = request.cookies.get(AUTH_COOKIE_NAME)?.value ?? "";
  if (!tokenValue) {
    return NextResponse.redirect(buildLoginUrl(request));
  }

  let token = null;
  try {
    token = verifyAuthToken(tokenValue);
  } catch {
    token = null;
  }

  if (!token) {
    return NextResponse.redirect(buildLoginUrl(request));
  }

  if (token.role !== AUTH_ROLE_ADMIN) {
    const deniedUrl = request.nextUrl.clone();
    deniedUrl.pathname = "/access-denied";
    deniedUrl.search = "";
    return NextResponse.redirect(deniedUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

