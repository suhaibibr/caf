import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { isRecoverableDbError } from "@/lib/db-errors";

type XbloomClickRow = RowDataPacket & {
  recipe_slug: string;
  click_count: number;
};

export type XbloomTopRecipe = {
  recipeSlug: string;
  clicks: number;
};

let setupPromise: Promise<void> | null = null;

async function ensureIndexExists(indexName: string, sql: string) {
  const pool = getDbPool();
  void indexName;
  await pool.execute(sql);
}

async function ensureXbloomClicksTable() {
  const pool = getDbPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS xbloom_recipe_clicks (
      recipe_slug VARCHAR(191) NOT NULL PRIMARY KEY,
      click_count BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await ensureIndexExists(
    "idx_xbloom_clicks_rank",
    "CREATE INDEX IF NOT EXISTS idx_xbloom_clicks_rank ON xbloom_recipe_clicks (click_count, updated_at)",
  );
}

export async function ensureXbloomClicksReady() {
  if (!setupPromise) {
    setupPromise = ensureXbloomClicksTable().catch((error) => {
      setupPromise = null;
      throw error;
    });
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
        ON CONFLICT (recipe_slug) DO UPDATE
        SET
          click_count = xbloom_recipe_clicks.click_count + 1,
          updated_at = CURRENT_TIMESTAMP
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
