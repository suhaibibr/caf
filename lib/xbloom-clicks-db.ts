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
}

export async function ensureXbloomClicksReady() {
  if (!setupPromise) {
    setupPromise = ensureXbloomClicksTable();
  }

  await setupPromise;
}

export async function trackXbloomRecipeClick(recipeSlug: string) {
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
}

export async function listTopXbloomRecipes(limit = 5) {
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
}
