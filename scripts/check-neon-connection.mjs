import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

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

loadEnvFiles();

const connectionString =
  process.env.NEON_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error("NEON_DATABASE_URL is missing. Add your Neon connection string first.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  max: 1,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 10_000,
});

try {
  const result = await pool.query(
    "SELECT NOW()::text AS now, current_database() AS database, version() AS version",
  );
  const row = result.rows[0];
  console.log("Neon connection OK");
  console.log(`Database: ${row.database}`);
  console.log(`Time: ${row.now}`);
  console.log(`Version: ${String(row.version).split(" ").slice(0, 2).join(" ")}`);
} finally {
  await pool.end();
}
