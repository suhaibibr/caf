import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

type HashParts = {
  salt: Buffer;
  hash: Buffer;
};

function toBase64Url(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  const padded = remainder === 0 ? normalized : `${normalized}${"=".repeat(4 - remainder)}`;
  return Buffer.from(padded, "base64");
}

function parseHash(storedHash: string): HashParts | null {
  const parts = storedHash.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return null;
  }

  const [, nValue, rValue, pValue, saltValue, hashValue] = parts;
  if (
    Number(nValue) !== SCRYPT_N ||
    Number(rValue) !== SCRYPT_R ||
    Number(pValue) !== SCRYPT_P
  ) {
    return null;
  }

  try {
    return {
      salt: fromBase64Url(saltValue),
      hash: fromBase64Url(hashValue),
    };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    toBase64Url(salt),
    toBase64Url(hash),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string) {
  const parsed = parseHash(storedHash);
  if (!parsed) {
    return false;
  }

  const derived = scryptSync(password, parsed.salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  if (derived.length !== parsed.hash.length) {
    return false;
  }

  return timingSafeEqual(derived, parsed.hash);
}
