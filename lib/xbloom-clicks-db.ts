import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";

type XbloomClickRow = RowDataPacket & {
  recipe_slug: string;
  click_count: number;
};

export type XbloomTopRecipe = {
  recipeSlug: string;
  clicks: number;
};

let setupPromise: Promise<void> | null = null;
const RECOVERABLE_DB_ERROR_CODES = new Set([
  "ER_ACCESS_DENIED_ERROR",
  "ER_DBACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "PROTOCOL_CONNECTION_LOST",
]);

function isRecoverableDbError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  return typeof code === "string" && RECOVERABLE_DB_ERROR_CODES.has(code);
}

async function ensureIndexExists(indexName: string, sql: string) {
  const pool = getDbPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `
      SELECT INDEX_NAME
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'xbloom_recipe_clicks'
        AND index_name = ?
      LIMIT 1
    `,
    [indexName],
  );

  if (!rows[0]) {
    await pool.execute(sql);
  }
}

async function ensureXbloomClicksTable() {
  const pool = getDbPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS xbloom_recipe_clicks (
      recipe_slug VARCHAR(191) NOT NULL PRIMARY KEY,
      click_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await ensureIndexExists(
    "idx_xbloom_clicks_rank",
    "ALTER TABLE xbloom_recipe_clicks ADD INDEX idx_xbloom_clicks_rank (click_count, updated_at)",
  );
}

export async function ensureXbloomClicksReady() {
  if (!setupPromise) {
    setupPromise = ensureXbloomClicksTable();
  }

  await setupPromise;
}

export async function trackXbloomRecipeClick(recipeSlug: string) {
  try {
    await ensureXbloomClicksReady();
    const normalized = recipeSlug.trim();
    if (!normalized) {
      return;
    }

    const pool = getDbPool();
    await pool.execute<ResultSetHeader>(
      `
        INSERT INTO xbloom_recipe_clicks (recipe_slug, click_count)
        VALUES (?, 1)
        ON DUPLICATE KEY UPDATE
          click_count = click_count + 1
      `,
      [normalized],
    );
  } catch (error) {
    if (!isRecoverableDbError(error)) {
      throw error;
    }
    console.error("Database unavailable in trackXbloomRecipeClick, skipping click tracking.");
  }
}

export async function listTopXbloomRecipes(limit = 5) {
  try {
    await ensureXbloomClicksReady();
    const pool = getDbPool();
    const safeLimit = Math.max(1, Math.min(20, Math.floor(limit)));

    const [rows] = await pool.query<XbloomClickRow[]>(
      `
        SELECT recipe_slug, click_count
        FROM xbloom_recipe_clicks
        ORDER BY click_count DESC, updated_at DESC
        LIMIT ?
      `,
      [safeLimit],
    );

    return rows.map((row) => ({
      recipeSlug: row.recipe_slug,
      clicks: Number(row.click_count ?? 0),
    }));
  } catch (error) {
    if (!isRecoverableDbError(error)) {
      throw error;
    }
    console.error("Database unavailable in listTopXbloomRecipes, returning empty list.");
    return [];
  }
}
