import fs from "node:fs";
import path from "node:path";
import { Pool as PgPool } from "pg";

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

async function main() {
  loadEnvFiles();
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing. Configure Neon first.");
  }

  const pool = new PgPool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 20_000,
  });

  await pool.query(
    "UPDATE auth_users SET failed_login_attempts = 0, locked_until = NULL",
  );
  await pool.query(
    "DELETE FROM auth_login_attempts WHERE created_at >= (NOW() - INTERVAL '1 day')",
  );

  const result = await pool.query(
    "SELECT COUNT(*) AS count FROM auth_login_attempts",
  );
  const remaining = Number(result.rows[0]?.count ?? 0);
  console.log(`Auth locks reset done. Remaining attempts rows: ${remaining}`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
