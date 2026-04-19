import mysql from "mysql2/promise";

declare global {
  var __cafMysqlPool: mysql.Pool | undefined;
}

function isSslEnabled() {
  const mode = (process.env.DB_SSL_MODE ?? "").trim().toUpperCase();
  return mode !== "" && mode !== "DISABLED" && mode !== "OFF" && mode !== "NONE";
}

function shouldRejectUnauthorizedByDefault() {
  const mode = (process.env.DB_SSL_MODE ?? "").trim().toUpperCase();
  // REQUIRED encrypts transport only; VERIFY_* enforces certificate validation.
  return mode === "VERIFY_CA" || mode === "VERIFY_IDENTITY";
}

function parseBooleanEnv(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function parsePositiveIntEnv(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

function getSslConfig() {
  if (!isSslEnabled()) {
    return undefined;
  }

  const explicitRejectUnauthorized = parseBooleanEnv(process.env.DB_SSL_REJECT_UNAUTHORIZED);
  const rejectUnauthorized =
    explicitRejectUnauthorized ?? shouldRejectUnauthorizedByDefault();
  const ca = process.env.DB_SSL_CA?.replace(/\\n/g, "\n");

  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {}),
    minVersion: "TLSv1.2",
  };
}

export function getDbPool() {
  if (!global.__cafMysqlPool) {
    const ssl = getSslConfig();
    const isProduction = process.env.NODE_ENV === "production";
    const connectionLimit =
      parsePositiveIntEnv(process.env.DB_CONNECTION_LIMIT) ??
      (isProduction ? 2 : 10);
    const maxIdle =
      parsePositiveIntEnv(process.env.DB_MAX_IDLE) ??
      Math.min(connectionLimit, isProduction ? 1 : connectionLimit);
    const idleTimeout =
      parsePositiveIntEnv(process.env.DB_IDLE_TIMEOUT_MS) ?? 60_000;
    const connectTimeout =
      parsePositiveIntEnv(process.env.DB_CONNECT_TIMEOUT_MS) ?? 10_000;

    global.__cafMysqlPool = mysql.createPool({
      host: process.env.DB_HOST ?? "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME ?? "caf",
      waitForConnections: true,
      connectionLimit,
      maxIdle,
      idleTimeout,
      connectTimeout,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      queueLimit: 0,
      charset: "utf8mb4",
      ...(ssl ? { ssl } : {}),
    });
  }

  return global.__cafMysqlPool;
}
