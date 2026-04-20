import { attachDatabasePool } from "@vercel/functions";
import mysql from "mysql2/promise";
import { Pool as PgPool } from "pg";

type QueryParams = readonly unknown[] | unknown[] | undefined;

export type DbResultHeader = {
  affectedRows: number;
  insertId: number;
};

export type DbPool = {
  query<T = unknown>(sql: string, params?: QueryParams): Promise<[T]>;
  execute<T = unknown>(sql: string, params?: QueryParams): Promise<[T]>;
};

declare global {
  var __cafMysqlPool: mysql.Pool | undefined;
  var __cafPostgresPool: PgPool | undefined;
  var __cafDbCompatPool: DbPool | undefined;
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

function isMysqlSslEnabled() {
  const mode = (process.env.DB_SSL_MODE ?? "").trim().toUpperCase();
  return mode !== "" && mode !== "DISABLED" && mode !== "OFF" && mode !== "NONE";
}

function shouldRejectUnauthorizedByDefault() {
  const mode = (process.env.DB_SSL_MODE ?? "").trim().toUpperCase();
  return mode === "VERIFY_CA" || mode === "VERIFY_IDENTITY";
}

function getMysqlSslConfig() {
  if (!isMysqlSslEnabled()) {
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

function hasPostgresUrl() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function allowMysqlFallback() {
  const value = process.env.ALLOW_MYSQL_FALLBACK?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function getPostgresPool() {
  if (!global.__cafPostgresPool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set. Configure Neon PostgreSQL first.");
    }

    const isProduction = process.env.NODE_ENV === "production";
    const max =
      parsePositiveIntEnv(process.env.PG_CONNECTION_LIMIT) ??
      (isProduction ? 4 : 10);
    const idleTimeoutMillis =
      parsePositiveIntEnv(process.env.PG_IDLE_TIMEOUT_MS) ?? 5_000;
    const connectionTimeoutMillis =
      parsePositiveIntEnv(process.env.PG_CONNECT_TIMEOUT_MS) ?? 10_000;

    global.__cafPostgresPool = new PgPool({
      connectionString,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      allowExitOnIdle: false,
    });
    attachDatabasePool(global.__cafPostgresPool);
  }

  return global.__cafPostgresPool;
}

function getMysqlPool() {
  if (!global.__cafMysqlPool) {
    const ssl = getMysqlSslConfig();
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

function convertMysqlPlaceholdersToPg(sql: string) {
  let index = 0;
  let result = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (char === "'" && !inDoubleQuote) {
      result += char;
      if (inSingleQuote && next === "'") {
        result += next;
        i += 1;
      } else {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      result += char;
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote && char === "?") {
      index += 1;
      result += `$${index}`;
      continue;
    }

    result += char;
  }

  return result.replace(/\bRAND\(\)/gi, "RANDOM()");
}

function looksLikeReadQuery(sql: string) {
  const normalized = sql.trim().toUpperCase();
  return normalized.startsWith("SELECT") || normalized.startsWith("WITH");
}

function hasReturning(sql: string) {
  return /\bRETURNING\b/i.test(sql);
}

function extractInsertId(row: unknown) {
  if (!row || typeof row !== "object") {
    return 0;
  }

  const candidate =
    ("insert_id" in row && (row as { insert_id?: unknown }).insert_id) ||
    ("insertId" in row && (row as { insertId?: unknown }).insertId) ||
    ("id" in row && (row as { id?: unknown }).id);

  const value = Number(candidate);
  return Number.isFinite(value) ? value : 0;
}

function createPostgresCompatPool(): DbPool {
  return {
    async query<T = unknown>(sql: string, params?: QueryParams) {
      const pg = getPostgresPool();
      const result = await pg.query(
        convertMysqlPlaceholdersToPg(sql),
        params ? [...params] : [],
      );
      return [result.rows as unknown as T];
    },
    async execute<T = unknown>(sql: string, params?: QueryParams) {
      const pg = getPostgresPool();
      const result = await pg.query(
        convertMysqlPlaceholdersToPg(sql),
        params ? [...params] : [],
      );

      if (looksLikeReadQuery(sql) || hasReturning(sql)) {
        return [result.rows as unknown as T];
      }

      const header: DbResultHeader = {
        affectedRows: Number(result.rowCount ?? 0),
        insertId: extractInsertId(result.rows[0]),
      };
      return [header as unknown as T];
    },
  };
}

function createMysqlCompatPool(): DbPool {
  type MysqlCompatFn = (sql: string, values?: unknown) => Promise<[unknown, unknown]>;

  return {
    async query<T = unknown>(sql: string, params?: QueryParams) {
      const pool = getMysqlPool();
      const queryFn = pool.query.bind(pool) as unknown as MysqlCompatFn;
      const [rows] = await queryFn(sql, params ? [...params] : undefined);
      return [rows as T];
    },
    async execute<T = unknown>(sql: string, params?: QueryParams) {
      const pool = getMysqlPool();
      const executeFn = pool.execute.bind(pool) as unknown as MysqlCompatFn;
      const [rows] = await executeFn(sql, params ? [...params] : undefined);
      return [rows as T];
    },
  };
}

export function getDbPool(): DbPool {
  if (!global.__cafDbCompatPool) {
    if (hasPostgresUrl()) {
      global.__cafDbCompatPool = createPostgresCompatPool();
    } else if (allowMysqlFallback()) {
      global.__cafDbCompatPool = createMysqlCompatPool();
    } else {
      throw new Error(
        "DATABASE_URL is required. MySQL fallback is disabled unless ALLOW_MYSQL_FALLBACK=1.",
      );
    }
  }
  return global.__cafDbCompatPool;
}
