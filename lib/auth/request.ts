const FORWARDED_SPLIT_REGEX = /\s*,\s*/;

function firstHeaderValue(value: string | null) {
  if (!value) {
    return "";
  }
  return value.split(FORWARDED_SPLIT_REGEX)[0]?.trim() ?? "";
}

export function getClientIp(request: Request) {
  const forwardedFor = firstHeaderValue(request.headers.get("x-forwarded-for"));
  const realIp = firstHeaderValue(request.headers.get("x-real-ip"));
  const fallback = firstHeaderValue(request.headers.get("cf-connecting-ip"));
  const chosen = forwardedFor || realIp || fallback || "unknown";
  return chosen.slice(0, 64);
}

export function getUserAgent(request: Request) {
  return (request.headers.get("user-agent") ?? "").slice(0, 512);
}

export function getCookieFromRequest(request: Request, cookieName: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return "";
  }

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawName, ...rest] = part.trim().split("=");
    if (!rawName || rawName !== cookieName) {
      continue;
    }

    const rawValue = rest.join("=");
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return "";
}

function normalizeOriginFromRequest(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const host = forwardedHost || request.headers.get("host") || requestUrl.host;
  const forwardedProto = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  const protocol = (forwardedProto || requestUrl.protocol.replace(":", "")).toLowerCase();
  return `${protocol}://${host}`.toLowerCase();
}

/**
 * CSRF protection for cookie-based auth:
 * mutating requests must originate from the same site origin.
 */
export function isTrustedOrigin(request: Request) {
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");
  const expectedOrigin = normalizeOriginFromRequest(request);
  const allowedOrigin = process.env.APP_ORIGIN?.trim().toLowerCase() || "";

  const candidates: string[] = [];
  if (originHeader) {
    candidates.push(originHeader);
  }
  if (!originHeader && refererHeader) {
    candidates.push(refererHeader);
  }

  if (candidates.length === 0) {
    return false;
  }

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      const candidateOrigin = parsed.origin.toLowerCase();
      if (candidateOrigin === expectedOrigin) {
        return true;
      }
      if (allowedOrigin && candidateOrigin === allowedOrigin) {
        return true;
      }
    } catch {}
  }

  return false;
}

export function isMutatingMethod(method: string) {
  const normalized = method.toUpperCase();
  return (
    normalized === "POST" ||
    normalized === "PUT" ||
    normalized === "PATCH" ||
    normalized === "DELETE"
  );
}

export function isSafeRedirectPath(value: string) {
  if (!value.startsWith("/")) {
    return false;
  }
  if (value.startsWith("//")) {
    return false;
  }
  if (value.startsWith("/api/")) {
    return false;
  }
  return true;
}

