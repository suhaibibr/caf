import { createHmac, timingSafeEqual } from "crypto";
import { AuthTokenPayload, getAuthTokenSecret } from "@/lib/auth/constants";

type JwtHeader = {
  alg: "HS256";
  typ: "JWT";
};

const JWT_HEADER: JwtHeader = {
  alg: "HS256",
  typ: "JWT",
};

function toBase64Url(value: string | Buffer) {
  const raw = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  return raw
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  const suffix = remainder === 0 ? "" : "=".repeat(4 - remainder);
  return Buffer.from(padded + suffix, "base64");
}

function signSegment(input: string, secret: string) {
  return createHmac("sha256", secret).update(input).digest();
}

function isValidPayload(value: unknown): value is AuthTokenPayload {
  if (!value || typeof value !== "object") {
    return false;
  }
  const payload = value as Partial<AuthTokenPayload>;
  return (
    Number.isFinite(payload.uid) &&
    (payload.role === "admin" || payload.role === "user") &&
    typeof payload.sid === "string" &&
    Number.isFinite(payload.iat) &&
    Number.isFinite(payload.exp)
  );
}

export function signAuthToken(payload: AuthTokenPayload) {
  const secret = getAuthTokenSecret();
  const headerEncoded = toBase64Url(JSON.stringify(JWT_HEADER));
  const payloadEncoded = toBase64Url(JSON.stringify(payload));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;
  const signature = signSegment(signingInput, secret);
  return `${signingInput}.${toBase64Url(signature)}`;
}

export function verifyAuthToken(token: string) {
  const secret = getAuthTokenSecret();
  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  if (!headerPart || !payloadPart || !signaturePart) {
    return null;
  }

  const signingInput = `${headerPart}.${payloadPart}`;
  const expectedSignature = signSegment(signingInput, secret);
  const providedSignature = fromBase64Url(signaturePart);

  if (expectedSignature.length !== providedSignature.length) {
    return null;
  }
  if (!timingSafeEqual(expectedSignature, providedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadPart).toString("utf8"));
    if (!isValidPayload(payload)) {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSeconds) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

