import { attachDatabasePool } from "@vercel/functions";
import { Pool, type QueryResult, type QueryResultRow } from "pg";

declare global {
  var __cafNeonPool: Pool | undefined;
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

export function isNeonConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function getDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Configure Neon first.");
  }
  return connectionString;
}

export function getNeonPool() {
  if (!global.__cafNeonPool) {
    const isProduction = process.env.NODE_ENV === "production";
    const max =
      parsePositiveIntEnv(process.env.PG_CONNECTION_LIMIT) ??
      (isProduction ? 4 : 10);
    const idleTimeoutMillis =
      parsePositiveIntEnv(process.env.PG_IDLE_TIMEOUT_MS) ?? 5_000;
    const connectionTimeoutMillis =
      parsePositiveIntEnv(process.env.PG_CONNECT_TIMEOUT_MS) ?? 10_000;

    global.__cafNeonPool = new Pool({
      connectionString: getDatabaseUrl(),
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      allowExitOnIdle: false,
    });
    attachDatabasePool(global.__cafNeonPool);
  }

  return global.__cafNeonPool;
}

export async function queryNeon<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  const pool = getNeonPool();
  return pool.query<T>(text, params);
}

export async function pingNeon() {
  const result = await queryNeon<{ now: string; database: string }>(
    "SELECT NOW()::text AS now, current_database() AS database",
  );
  return result.rows[0] ?? null;
}

export type NeonQueryResult<T extends QueryResultRow = QueryResultRow> = QueryResult<T>;
