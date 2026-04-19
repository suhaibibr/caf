import { AuthTokenPayload } from "@/lib/auth/constants";

function getEdgeTokenSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET?.trim();
  return secret || null;
}

function base64UrlToUint8Array(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  const suffix = remainder === 0 ? "" : "=".repeat(4 - remainder);
  const binary = atob(padded + suffix);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function stringToUint8Array(value: string) {
  return new TextEncoder().encode(value);
}

function safeCompare(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a[index] ^ b[index];
  }
  return diff === 0;
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

export async function verifyAuthTokenEdge(token: string) {
  const secret = getEdgeTokenSecret();
  if (!secret) {
    return null;
  }

  const parts = token.trim().split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  if (!headerPart || !payloadPart || !signaturePart) {
    return null;
  }

  const signingInput = `${headerPart}.${payloadPart}`;

  const key = await crypto.subtle.importKey(
    "raw",
    stringToUint8Array(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const expectedSignatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    stringToUint8Array(signingInput),
  );
  const expectedSignature = new Uint8Array(expectedSignatureBuffer);
  const providedSignature = base64UrlToUint8Array(signaturePart);

  if (!safeCompare(expectedSignature, providedSignature)) {
    return null;
  }

  try {
    const payloadJson = new TextDecoder().decode(base64UrlToUint8Array(payloadPart));
    const payload = JSON.parse(payloadJson);
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

