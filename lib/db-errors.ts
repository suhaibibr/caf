const RECOVERABLE_DB_ERROR_CODES = new Set([
  "ER_ACCESS_DENIED_ERROR",
  "ER_DBACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ECONNRESET",
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
  "ER_CON_COUNT_ERROR",
  "ER_USER_LIMIT_REACHED",
  "ER_TOO_MANY_USER_CONNECTIONS",
  "EAI_AGAIN",
  "53300",
  "57P01",
  "57P03",
  "08000",
  "08001",
  "08006",
  "08P01",
  "XX000",
]);

const CONNECTION_EXHAUSTED_CODES = new Set([
  "ER_CON_COUNT_ERROR",
  "ER_USER_LIMIT_REACHED",
  "ER_TOO_MANY_USER_CONNECTIONS",
]);

export function getDbErrorCode(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  return typeof code === "string" ? code : "";
}

function getNestedErrorCode(error: unknown): string {
  const direct = getDbErrorCode(error);
  if (direct) {
    return direct;
  }

  if (typeof error !== "object" || error === null) {
    return "";
  }

  const nested =
    "cause" in error ? (error as { cause?: unknown }).cause : undefined;
  if (nested) {
    const nestedCode = getNestedErrorCode(nested);
    if (nestedCode) {
      return nestedCode;
    }
  }

  return "";
}

function hasRecoverableDbMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toUpperCase();
  return (
    message.includes("ENOTFOUND") ||
    message.includes("ECONNREFUSED") ||
    message.includes("ECONNRESET") ||
    message.includes("ENETUNREACH") ||
    message.includes("ETIMEDOUT") ||
    message.includes("EHOSTUNREACH") ||
    message.includes("PROTOCOL_CONNECTION_LOST") ||
    message.includes("GETADDRINFO") ||
    message.includes("TOO MANY CLIENTS") ||
    message.includes("EXCEEDED THE COMPUTE TIME QUOTA") ||
    message.includes("THE DATABASE SYSTEM IS STARTING UP")
  );
}

export function isRecoverableDbError(error: unknown) {
  const code = getNestedErrorCode(error);
  return (code !== "" && RECOVERABLE_DB_ERROR_CODES.has(code)) || hasRecoverableDbMessage(error);
}

export function isDbConnectionExhaustedError(error: unknown) {
  const code = getNestedErrorCode(error);
  return code !== "" && CONNECTION_EXHAUSTED_CODES.has(code);
}
