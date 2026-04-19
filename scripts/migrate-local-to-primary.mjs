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

function normalizeSslMode(mode) {
  return (mode ?? "").trim().toUpperCase();
}

function getSslConfig(modeInput, caInput, rejectUnauthorizedInput) {
  const mode = normalizeSslMode(modeInput);
  if (!mode || ["DISABLED", "OFF", "NONE"].includes(mode)) {
    return undefined;
  }

  const explicitRejectUnauthorized = parseBooleanEnv(rejectUnauthorizedInput);
  const rejectUnauthorized =
    explicitRejectUnauthorized ?? (mode === "VERIFY_CA" || mode === "VERIFY_IDENTITY");
  const ca = caInput?.replace(/\\n/g, "\n");

  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {}),
    minVersion: "TLSv1.2",
  };
}

function toDbConfig(prefixes, defaults) {
  const read = (keySuffix) => {
    for (const prefix of prefixes) {
      const value = process.env[`${prefix}${keySuffix}`];
      if (value !== undefined && value !== "") {
        return value;
      }
    }
    return undefined;
  };

  const host = read("HOST") ?? defaults.host;
  const port = Number(read("PORT") ?? defaults.port);
  const user = read("USER") ?? defaults.user;
  const password = read("PASSWORD") ?? defaults.password;
  const database = read("NAME") ?? defaults.database;
  const sslMode = read("SSL_MODE") ?? defaults.sslMode;
  const sslCa = read("SSL_CA") ?? defaults.sslCa;
  const sslRejectUnauthorized =
    read("SSL_REJECT_UNAUTHORIZED") ?? defaults.sslRejectUnauthorized;

  return {
    host,
    port,
    user,
    password,
    database,
    ssl: getSslConfig(sslMode, sslCa, sslRejectUnauthorized),
  };
}

function maskValue(value) {
  if (!value) {
    return "";
  }
  if (value.length <= 4) {
    return "*".repeat(value.length);
  }
  return `${"*".repeat(Math.max(3, value.length - 4))}${value.slice(-4)}`;
}

function quoteIdentifier(name) {
  return `\`${String(name).replace(/`/g, "``")}\``;
}

function normalizeRowValue(value) {
  if (value instanceof Date) {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value;
  }
  return value;
}

async function fetchTableNames(connection, database) {
  const [rows] = await connection.execute(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = ?
      ORDER BY table_name
    `,
    [database],
  );
  return rows.map((row) => row.table_name);
}

async function copyTable(sourceConn, targetConn, tableName) {
  const tableId = quoteIdentifier(tableName);
  const [createRows] = await sourceConn.query(`SHOW CREATE TABLE ${tableId}`);
  const createSql = createRows?.[0]?.["Create Table"];
  if (!createSql) {
    throw new Error(`Could not read CREATE TABLE for ${tableName}`);
  }

  await targetConn.query(`DROP TABLE IF EXISTS ${tableId}`);
  await targetConn.query(createSql);

  const [rows] = await sourceConn.query(`SELECT * FROM ${tableId}`);
  if (!Array.isArray(rows) || rows.length === 0) {
    return 0;
  }

  const columns = Object.keys(rows[0]);
  if (columns.length === 0) {
    return 0;
  }

  const columnSql = columns.map((name) => quoteIdentifier(name)).join(", ");
  const batchSize = 300;
  let inserted = 0;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const placeholders = batch
      .map(
        () =>
          `(${columns
            .map(() => "?")
            .join(",")})`,
      )
      .join(", ");
    const values = batch.flatMap((row) =>
      columns.map((columnName) => normalizeRowValue(row[columnName])),
    );
    const insertSql = `INSERT INTO ${tableId} (${columnSql}) VALUES ${placeholders}`;
    await targetConn.query(insertSql, values);
    inserted += batch.length;
  }

  return inserted;
}

async function main() {
  loadEnvFiles();
  const dryRun = process.argv.includes("--dry-run");

  const source = toDbConfig(["SOURCE_DB_", "LOCAL_DB_"], {
    host: "127.0.0.1",
    port: 3306,
    user: "root",
    password: "",
    database: "caf",
    sslMode: "DISABLED",
    sslCa: "",
    sslRejectUnauthorized: "",
  });

  const target = toDbConfig(["TARGET_DB_", "DB_"], {
    host: "127.0.0.1",
    port: 3306,
    user: "root",
    password: "",
    database: "caf",
    sslMode: "DISABLED",
    sslCa: "",
    sslRejectUnauthorized: "",
  });

  if (
    source.host === target.host &&
    source.port === target.port &&
    source.user === target.user &&
    source.database === target.database
  ) {
    throw new Error("Source and target appear to be the same database. Aborting.");
  }

  console.log("Migration source:");
  console.log(
    `  ${source.user}@${source.host}:${source.port}/${source.database} (password=${maskValue(source.password)})`,
  );
  console.log("Migration target:");
  console.log(
    `  ${target.user}@${target.host}:${target.port}/${target.database} (password=${maskValue(target.password)})`,
  );
  if (dryRun) {
    console.log("Mode: DRY RUN (no changes will be made).");
  }

  const sourceConn = await mysql.createConnection({
    host: source.host,
    port: source.port,
    user: source.user,
    password: source.password,
    database: source.database,
    charset: "utf8mb4",
    ...(source.ssl ? { ssl: source.ssl } : {}),
  });

  const targetConn = await mysql.createConnection({
    host: target.host,
    port: target.port,
    user: target.user,
    password: target.password,
    database: target.database,
    charset: "utf8mb4",
    ...(target.ssl ? { ssl: target.ssl } : {}),
  });

  try {
    const tableNames = await fetchTableNames(sourceConn, source.database);
    if (tableNames.length === 0) {
      throw new Error(`No tables found in source database: ${source.database}`);
    }

    console.log(`Found ${tableNames.length} tables in source.`);
    for (const tableName of tableNames) {
      const [countRows] = await sourceConn.query(
        `SELECT COUNT(*) AS total FROM ${quoteIdentifier(tableName)}`,
      );
      const total = Number(countRows?.[0]?.total ?? 0);
      console.log(`  - ${tableName}: ${total} rows`);
    }

    if (dryRun) {
      return;
    }

    await targetConn.query("SET FOREIGN_KEY_CHECKS = 0");
    try {
      let totalInserted = 0;
      for (const tableName of tableNames) {
        const inserted = await copyTable(sourceConn, targetConn, tableName);
        totalInserted += inserted;
        console.log(`Copied ${tableName}: ${inserted} rows`);
      }
      console.log(`Migration completed. Total inserted rows: ${totalInserted}`);
    } finally {
      await targetConn.query("SET FOREIGN_KEY_CHECKS = 1");
    }
  } finally {
    await sourceConn.end();
    await targetConn.end();
  }
}

main().catch((error) => {
  console.error("Migration failed.");
  console.error(error);
  process.exit(1);
});
