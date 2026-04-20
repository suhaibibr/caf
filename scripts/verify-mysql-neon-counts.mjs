import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { Pool as PgPool } from "pg";

const TABLES = [
  "roasters",
  "recipes",
  "recipe_submissions",
  "xbloom_recipe_clicks",
  "site_metrics_counter",
  "site_metrics_presence",
  "site_metrics_visited_sessions",
  "maintenance_tasks",
  "auth_users",
  "auth_sessions",
  "auth_login_attempts",
  "security_events",
  "admin_audit_logs",
];

function loadEnvFiles() {
  for (const fileName of [".env", ".env.local"]) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const index = line.indexOf("=");
      if (index <= 0) {
        continue;
      }
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

function parseBooleanEnv(value) {
  if (!value) {
    return undefined;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function normalizeSslMode(mode) {
  return String(mode ?? "").trim().toUpperCase();
}

function getMysqlSslConfig(modeInput, caInput, rejectUnauthorizedInput) {
  const mode = normalizeSslMode(modeInput);
  if (!mode || ["DISABLED", "OFF", "NONE"].includes(mode)) {
    return undefined;
  }
  const explicitRejectUnauthorized = parseBooleanEnv(rejectUnauthorizedInput);
  const rejectUnauthorized =
    explicitRejectUnauthorized ?? (mode === "VERIFY_CA" || mode === "VERIFY_IDENTITY");
  const ca = caInput ? String(caInput).replace(/\\n/g, "\n") : undefined;

  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {}),
    minVersion: "TLSv1.2",
  };
}

function quoteMysqlIdentifier(name) {
  return `\`${String(name).replace(/`/g, "``")}\``;
}

function quotePgIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function mysqlTableExists(conn, dbName, tableName) {
  const [rows] = await conn.execute(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = ?
        AND table_name = ?
      LIMIT 1
    `,
    [dbName, tableName],
  );
  return Boolean(rows?.[0]);
}

async function countMysqlTable(conn, dbName, tableName) {
  const exists = await mysqlTableExists(conn, dbName, tableName);
  if (!exists) {
    return null;
  }
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS count FROM ${quoteMysqlIdentifier(tableName)}`,
  );
  return Number(rows?.[0]?.count ?? 0);
}

async function countPgTable(pgPool, tableName) {
  const existsResult = await pgPool.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
      LIMIT 1
    `,
    [tableName],
  );
  if (!existsResult.rows[0]) {
    return null;
  }
  const countResult = await pgPool.query(
    `SELECT COUNT(*)::bigint AS count FROM ${quotePgIdentifier(tableName)}`,
  );
  return Number(countResult.rows[0]?.count ?? 0);
}

async function main() {
  loadEnvFiles();

  const sourceDbName = process.env.SOURCE_DB_NAME ?? process.env.DB_NAME ?? "caf";
  const sourceConfig = {
    host: process.env.SOURCE_DB_HOST ?? process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.SOURCE_DB_PORT ?? process.env.DB_PORT ?? 3306),
    user: process.env.SOURCE_DB_USER ?? process.env.DB_USER ?? "root",
    password: process.env.SOURCE_DB_PASSWORD ?? process.env.DB_PASSWORD ?? "",
    database: sourceDbName,
    charset: "utf8mb4",
    ssl: getMysqlSslConfig(
      process.env.SOURCE_DB_SSL_MODE ?? process.env.DB_SSL_MODE,
      process.env.SOURCE_DB_SSL_CA ?? process.env.DB_SSL_CA,
      process.env.SOURCE_DB_SSL_REJECT_UNAUTHORIZED ?? process.env.DB_SSL_REJECT_UNAUTHORIZED,
    ),
  };

  const targetUrl =
    process.env.TARGET_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";

  if (!targetUrl) {
    throw new Error("Missing DATABASE_URL/TARGET_DATABASE_URL");
  }

  let sourceConn = null;
  const targetPool = new PgPool({
    connectionString: targetUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 20_000,
  });

  try {
    try {
      sourceConn = await mysql.createConnection({
        ...sourceConfig,
        ...(sourceConfig.ssl ? { ssl: sourceConfig.ssl } : {}),
      });
    } catch (error) {
      console.error("SOURCE_CONNECTION_ERROR", {
        code: error?.code ?? "",
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }

    const rows = [];
    for (const tableName of TABLES) {
      const [sourceCount, targetCount] = await Promise.all([
        countMysqlTable(sourceConn, sourceDbName, tableName),
        countPgTable(targetPool, tableName),
      ]);
      rows.push({
        table: tableName,
        mysql: sourceCount,
        neon: targetCount,
        equal:
          sourceCount !== null && targetCount !== null
            ? sourceCount === targetCount
            : null,
      });
    }

    console.log(JSON.stringify(rows, null, 2));
  } finally {
    if (sourceConn) {
      await sourceConn.end();
    }
    await targetPool.end();
  }
}

main().catch((error) => {
  console.error("VERIFY_COUNTS_FAILED", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
