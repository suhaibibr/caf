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

function parseArgValue(name) {
  const prefixed = `--${name}=`;
  const withValue = process.argv.find((arg) => arg.startsWith(prefixed));
  if (withValue) {
    return withValue.slice(prefixed.length).trim();
  }

  const exactIndex = process.argv.findIndex((arg) => arg === `--${name}`);
  if (exactIndex === -1) {
    return "";
  }
  return String(process.argv[exactIndex + 1] ?? "").trim();
}

function quotePgIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function decodeMysqlEscapedChar(char) {
  switch (char) {
    case "0":
      return "\0";
    case "b":
      return "\b";
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    case "Z":
      return "\u001a";
    default:
      return char;
  }
}

function extractInsertStatements(sqlText) {
  const statements = [];
  let searchIndex = 0;

  while (true) {
    const start = sqlText.indexOf("INSERT INTO `", searchIndex);
    if (start === -1) {
      break;
    }

    let inSingleQuote = false;
    let escaped = false;
    let end = -1;

    for (let index = start; index < sqlText.length; index += 1) {
      const char = sqlText[index];

      if (inSingleQuote) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (char === "\\") {
          escaped = true;
          continue;
        }
        if (char === "'") {
          inSingleQuote = false;
        }
        continue;
      }

      if (char === "'") {
        inSingleQuote = true;
        continue;
      }

      if (char === ";") {
        end = index;
        break;
      }
    }

    if (end === -1) {
      throw new Error("Unterminated INSERT statement found in SQL dump.");
    }

    statements.push(sqlText.slice(start, end + 1));
    searchIndex = end + 1;
  }

  return statements;
}

function parseSqlStringLiteral(text, startIndex) {
  let index = startIndex + 1;

  while (index < text.length) {
    const char = text[index];

    if (char === "\\") {
      const next = text[index + 1];
      if (next === undefined) {
        index += 1;
        break;
      }
      decodeMysqlEscapedChar(next);
      index += 2;
      continue;
    }

    if (char === "'") {
      if (text[index + 1] === "'") {
        index += 2;
        continue;
      }
      return index + 1;
    }

    index += 1;
  }

  throw new Error("Unterminated SQL string literal in INSERT values.");
}

function countTuples(valuesSql) {
  let count = 0;
  let index = 0;

  while (index < valuesSql.length) {
    const char = valuesSql[index];
    if (char === "'") {
      index = parseSqlStringLiteral(valuesSql, index);
      continue;
    }
    if (char === "(") {
      count += 1;
    }
    index += 1;
  }

  return count;
}

function countRowsByTableFromDump(sqlText) {
  const counts = new Map();
  const statements = extractInsertStatements(sqlText);

  for (const statement of statements) {
    const match = statement.match(
      /^INSERT INTO\s+`([^`]+)`\s*\(([\s\S]*?)\)\s*VALUES\s*([\s\S]*);$/i,
    );
    if (!match) {
      continue;
    }
    const tableName = match[1];
    const rowsCount = countTuples(match[3]);
    counts.set(tableName, (counts.get(tableName) ?? 0) + rowsCount);
  }

  return counts;
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

  const sourceSqlFile =
    parseArgValue("source-sql-file") ||
    process.env.SOURCE_SQL_FILE?.trim() ||
    "img/caf.sql";
  const resolvedSqlFile = path.resolve(process.cwd(), sourceSqlFile);
  if (!fs.existsSync(resolvedSqlFile)) {
    throw new Error(`SQL dump file not found: ${resolvedSqlFile}`);
  }

  const targetUrl =
    process.env.TARGET_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";
  if (!targetUrl) {
    throw new Error("Missing DATABASE_URL/TARGET_DATABASE_URL");
  }

  const sqlText = fs.readFileSync(resolvedSqlFile, "utf8");
  const dumpCounts = countRowsByTableFromDump(sqlText);

  const pgPool = new PgPool({
    connectionString: targetUrl,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 20_000,
  });

  try {
    const report = [];
    for (const table of TABLES) {
      const source = dumpCounts.get(table) ?? 0;
      const neon = await countPgTable(pgPool, table);
      report.push({
        table,
        source_dump: source,
        neon,
        equal: neon === null ? false : source === neon,
      });
    }
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await pgPool.end();
  }
}

main().catch((error) => {
  console.error("VERIFY_DUMP_NEON_COUNTS_FAILED", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
