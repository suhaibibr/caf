import { queryNeon } from "@/lib/neon";

type UsageOverviewRow = {
  database: string;
  total_bytes: string | number;
  sampled_at: string;
};

type UsageTablesCountRow = {
  count: string | number;
};

type UsageTableRow = {
  table_name: string;
  total_bytes: string | number;
  estimated_rows: string | number;
};

export type DatabaseUsageTable = {
  name: string;
  sizeBytes: number;
  estimatedRows: number;
};

export type DatabaseUsageSnapshot = {
  database: string;
  totalBytes: number;
  tablesCount: number;
  sampledAt: string;
  topTables: DatabaseUsageTable[];
};

function toSafeNumber(value: string | number | null | undefined) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return numeric;
}

export async function getDatabaseUsageSnapshot(
  topTablesLimit = 6,
): Promise<DatabaseUsageSnapshot | null> {
  const safeLimit = Math.max(1, Math.min(12, Math.floor(topTablesLimit)));

  const [overviewResult, tablesCountResult, topTablesResult] = await Promise.all([
    queryNeon<UsageOverviewRow>(
      `
        SELECT
          current_database() AS database,
          pg_database_size(current_database())::bigint AS total_bytes,
          NOW()::text AS sampled_at
      `,
    ),
    queryNeon<UsageTablesCountRow>(
      `
        SELECT COUNT(*)::bigint AS count
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
      `,
    ),
    queryNeon<UsageTableRow>(
      `
        SELECT
          schemaname || '.' || relname AS table_name,
          pg_total_relation_size(format('%I.%I', schemaname, relname))::bigint AS total_bytes,
          COALESCE(n_live_tup, 0)::bigint AS estimated_rows
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(format('%I.%I', schemaname, relname)) DESC
        LIMIT $1
      `,
      [safeLimit],
    ),
  ]);

  const overview = overviewResult.rows[0];
  if (!overview) {
    return null;
  }

  return {
    database: overview.database,
    totalBytes: toSafeNumber(overview.total_bytes),
    tablesCount: toSafeNumber(tablesCountResult.rows[0]?.count ?? 0),
    sampledAt: overview.sampled_at,
    topTables: topTablesResult.rows.map((row) => ({
      name: row.table_name,
      sizeBytes: toSafeNumber(row.total_bytes),
      estimatedRows: toSafeNumber(row.estimated_rows),
    })),
  };
}
