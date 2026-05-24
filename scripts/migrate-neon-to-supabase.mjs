import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
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

function parseArgs(argv) {
  const args = {
    sourceUrl: "",
    targetUrl: "",
    backupDir: "",
    skipDump: false,
    skipRestore: false,
    skipVerify: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--skip-dump") args.skipDump = true;
    else if (arg === "--skip-restore") args.skipRestore = true;
    else if (arg === "--skip-verify") args.skipVerify = true;
    else if (arg === "--source-url") args.sourceUrl = argv[i + 1] ?? "";
    else if (arg === "--target-url") args.targetUrl = argv[i + 1] ?? "";
    else if (arg === "--backup-dir") args.backupDir = argv[i + 1] ?? "";
  }
  return args;
}

function resolvePgTools() {
  const root = process.cwd();
  if (process.platform === "win32") {
    return {
      pgDump: path.join(
        root,
        "node_modules",
        "pg-dump-restore-nodejs",
        "bin",
        "win",
        "bin",
        "pg_dump.exe",
      ),
      pgRestore: path.join(
        root,
        "node_modules",
        "pg-dump-restore-nodejs",
        "bin",
        "win",
        "bin",
        "pg_restore.exe",
      ),
    };
  }
  if (process.platform === "darwin") {
    return {
      pgDump: path.join(
        root,
        "node_modules",
        "pg-dump-restore-nodejs",
        "bin",
        "macos",
        "bin",
        "pg_dump",
      ),
      pgRestore: path.join(
        root,
        "node_modules",
        "pg-dump-restore-nodejs",
        "bin",
        "macos",
        "bin",
        "pg_restore",
      ),
    };
  }
  return {
    pgDump: path.join(
      root,
      "node_modules",
      "pg-dump-restore-nodejs",
      "bin",
      "linux",
      "bin",
      "pg_dump",
    ),
    pgRestore: path.join(
      root,
      "node_modules",
      "pg-dump-restore-nodejs",
      "bin",
      "linux",
      "bin",
      "pg_restore",
    ),
  };
}

function runOrThrow(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(" ")}`);
  }
}

async function listPublicTables(connectionString) {
  const pool = new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 20000,
  });
  try {
    const result = await pool.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `,
    );
    return result.rows.map((row) => String(row.table_name));
  } finally {
    await pool.end();
  }
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function tableCountMap(connectionString, tables) {
  const pool = new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 20000,
  });
  try {
    const output = new Map();
    for (const tableName of tables) {
      const countResult = await pool.query(
        `SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(tableName)}`,
      );
      output.set(tableName, Number(countResult.rows[0]?.count ?? 0));
    }
    return output;
  } finally {
    await pool.end();
  }
}

function timestampForFolder() {
  const now = new Date();
  const two = (n) => String(n).padStart(2, "0");
  return `${now.getUTCFullYear()}${two(now.getUTCMonth() + 1)}${two(now.getUTCDate())}-${two(
    now.getUTCHours(),
  )}${two(now.getUTCMinutes())}${two(now.getUTCSeconds())}Z`;
}

async function main() {
  loadEnvFiles();
  const args = parseArgs(process.argv.slice(2));

  const sourceUrl =
    args.sourceUrl ||
    process.env.NEON_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";
  const targetUrl =
    args.targetUrl ||
    process.env.SUPABASE_DATABASE_URL?.trim() ||
    process.env.TARGET_DATABASE_URL?.trim() ||
    "";

  if (!sourceUrl) {
    throw new Error(
      "Missing source URL. Set NEON_DATABASE_URL (or DATABASE_URL_UNPOOLED / DATABASE_URL) or pass --source-url.",
    );
  }
  if (!targetUrl) {
    throw new Error(
      "Missing target URL. Set SUPABASE_DATABASE_URL (or TARGET_DATABASE_URL) or pass --target-url.",
    );
  }

  const { pgDump, pgRestore } = resolvePgTools();
  if (!fs.existsSync(pgDump) || !fs.existsSync(pgRestore)) {
    throw new Error(
      "pg_dump / pg_restore binaries are missing. Install dev dependency: pg-dump-restore-nodejs",
    );
  }

  const backupDir =
    args.backupDir || path.join(process.cwd(), "backups", `neon-to-supabase-${timestampForFolder()}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const fullDumpPath = path.join(backupDir, "neon-full.dump");
  const schemaSqlPath = path.join(backupDir, "neon-schema.sql");
  const dataSqlPath = path.join(backupDir, "neon-data.sql");

  if (!args.skipDump) {
    console.log("1) Exporting Neon with pg_dump...");
    runOrThrow(pgDump, [
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      `--dbname=${sourceUrl}`,
      `--file=${fullDumpPath}`,
    ]);
    runOrThrow(pgDump, [
      "--schema-only",
      "--no-owner",
      "--no-privileges",
      `--dbname=${sourceUrl}`,
      `--file=${schemaSqlPath}`,
    ]);
    runOrThrow(pgDump, [
      "--data-only",
      "--inserts",
      "--no-owner",
      "--no-privileges",
      `--dbname=${sourceUrl}`,
      `--file=${dataSqlPath}`,
    ]);
  } else {
    if (!fs.existsSync(fullDumpPath)) {
      throw new Error(`Dump file not found at ${fullDumpPath}. Remove --skip-dump or provide --backup-dir.`);
    }
  }

  if (!args.skipRestore) {
    console.log("2) Creating schema in Supabase...");
    runOrThrow(pgRestore, [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--schema-only",
      `--dbname=${targetUrl}`,
      fullDumpPath,
    ]);

    console.log("3) Importing data into Supabase...");
    runOrThrow(pgRestore, [
      "--no-owner",
      "--no-privileges",
      "--data-only",
      `--dbname=${targetUrl}`,
      fullDumpPath,
    ]);
  }

  if (!args.skipVerify) {
    console.log("4) Verifying row counts (Neon vs Supabase)...");
    const tables = await listPublicTables(sourceUrl);
    const sourceCounts = await tableCountMap(sourceUrl, tables);
    const targetCounts = await tableCountMap(targetUrl, tables);

    let mismatchCount = 0;
    for (const tableName of tables) {
      const sourceCount = sourceCounts.get(tableName) ?? 0;
      const targetCount = targetCounts.get(tableName) ?? 0;
      const ok = sourceCount === targetCount;
      if (!ok) mismatchCount += 1;
      console.log(
        `${ok ? "OK" : "MISMATCH"} ${tableName}: source=${sourceCount} target=${targetCount}`,
      );
    }

    if (mismatchCount > 0) {
      throw new Error(`Verification failed: ${mismatchCount} table(s) mismatch.`);
    }
  }

  console.log(`Migration flow finished. Backup folder: ${backupDir}`);
}

main().catch((error) => {
  console.error("MIGRATE_NEON_TO_SUPABASE_FAILED", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
