const RECOVERABLE_DB_ERROR_CODES = new Set([
  "ER_ACCESS_DENIED_ERROR",
  "ER_DBACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "PROTOCOL_CONNECTION_LOST",
  "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR",
  "ER_CON_COUNT_ERROR",
  "ER_USER_LIMIT_REACHED",
  "ER_TOO_MANY_USER_CONNECTIONS",
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

export function isRecoverableDbError(error: unknown) {
  const code = getDbErrorCode(error);
  return code !== "" && RECOVERABLE_DB_ERROR_CODES.has(code);
}

export function isDbConnectionExhaustedError(error: unknown) {
  const code = getDbErrorCode(error);
  return code !== "" && CONNECTION_EXHAUSTED_CODES.has(code);
}
