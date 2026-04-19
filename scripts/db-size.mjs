import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

function loadEnvFiles() {
  const envFiles = [".env", ".env.local"];
  for (const fileName of envFiles) {
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

function isSslEnabled() {
  const mode = (process.env.DB_SSL_MODE ?? "").trim().toUpperCase();
  return mode !== "" && mode !== "DISABLED" && mode !== "OFF" && mode !== "NONE";
}

function shouldRejectUnauthorizedByDefault() {
  const mode = (process.env.DB_SSL_MODE ?? "").trim().toUpperCase();
  return mode === "VERIFY_CA" || mode === "VERIFY_IDENTITY";
}

function parseBooleanEnv(value) {
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

  const explicitRejectUnauthorized = parseBooleanEnv(
    process.env.DB_SSL_REJECT_UNAUTHORIZED,
  );
  const rejectUnauthorized =
    explicitRejectUnauthorized ?? shouldRejectUnauthorizedByDefault();
  const ca = process.env.DB_SSL_CA?.replace(/\\n/g, "\n");

  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {}),
    minVersion: "TLSv1.2",
  };
}

async function main() {
  loadEnvFiles();
  const database = process.env.DB_NAME ?? "caf";
  const ssl = getSslConfig();
  const pool = mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
    charset: "utf8mb4",
    ...(ssl ? { ssl } : {}),
  });

  const [rows] = await pool.execute(
    `
      SELECT
        table_schema AS db_name,
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
      FROM information_schema.tables
      WHERE table_schema = ?
      GROUP BY table_schema
    `,
    [database],
  );

  const [tableRows] = await pool.execute(
    `
      SELECT
        table_name AS table_name,
        ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb
      FROM information_schema.tables
      WHERE table_schema = ?
      ORDER BY (data_length + index_length) DESC
    `,
    [database],
  );

  const totalMb = Number(rows?.[0]?.size_mb ?? 0);
  const totalGb = totalMb / 1024;

  console.log(`DB: ${database}`);
  console.log(`TOTAL_MB: ${totalMb.toFixed(2)}`);
  console.log(`TOTAL_GB: ${totalGb.toFixed(4)}`);
  console.log("TABLES_MB:");
  for (const row of tableRows) {
    const tableName =
      row.table_name ?? row.TABLE_NAME ?? row.tableName ?? row.TABLE_NAME;
    console.log(`${tableName}: ${Number(row.size_mb ?? row.SIZE_MB ?? 0).toFixed(2)}`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
