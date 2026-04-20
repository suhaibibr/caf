import fs from "node:fs";
import path from "node:path";
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

function quotePgIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function main() {
  loadEnvFiles();
  const targetUrl =
    process.env.TARGET_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";

  if (!targetUrl) {
    throw new Error("Missing DATABASE_URL/TARGET_DATABASE_URL");
  }

  const pool = new PgPool({
    connectionString: targetUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 20_000,
  });

  try {
    const rows = [];
    for (const tableName of TABLES) {
      const existsResult = await pool.query(
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
        rows.push({ table: tableName, neon: null, exists: false });
        continue;
      }

      const countResult = await pool.query(
        `SELECT COUNT(*)::bigint AS count FROM ${quotePgIdentifier(tableName)}`,
      );
      rows.push({
        table: tableName,
        neon: Number(countResult.rows[0]?.count ?? 0),
        exists: true,
      });
    }

    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("REPORT_NEON_COUNTS_FAILED", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
