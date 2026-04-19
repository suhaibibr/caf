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

    global.__cafMysqlPool = mysql.createPool({
      host: process.env.DB_HOST ?? "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME ?? "caf",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: "utf8mb4",
      ...(ssl ? { ssl } : {}),
    });
  }

  return global.__cafMysqlPool;
}
