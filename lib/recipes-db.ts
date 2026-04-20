import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { isRecoverableDbError } from "@/lib/db-errors";

export type ManagedPourStep = {
  name: string;
  volumeMl: number | null;
  temperatureC: number | null;
  seconds: number | null;
};

export type ManagedRecipe = {
  slug: string;
  name: string;
  authorName: string;
  isRoasterApproved: boolean;
  brewer: string;
  grams: number;
  iceGrams: number | null;
  pourCount: number | null;
  firstPourTemperature: number | null;
  pourSteps: ManagedPourStep[];
  ratio: string;
  waterMl: number | null;
  roasterSlug: string | null;
  roasterName: string | null;
  mergeGroupKey: string | null;
  brewType: "hot" | "cold" | "filter";
  xbloomUrl: string;
  createdAt: string;
  updatedAt: string;
};

type ManagedRecipeRow = RowDataPacket & {
  slug: string;
  name: string;
  author_name: string;
  is_roaster_approved: number;
  brewer: string;
  grams: number;
  ice_grams: number | null;
  pour_count: number | null;
  first_pour_temperature: number | null;
  pour_profile_json: string | null;
  ratio_text: string;
  water_ml: number | null;
  roaster_slug: string | null;
  roaster_name: string | null;
  merge_group_key: string | null;
  brew_type: "hot" | "cold" | "filter";
  xbloom_url: string;
  created_at: Date | string;
  updated_at: Date | string;
};

type RecipeSlugRow = RowDataPacket & {
  slug: string;
  created_at: Date | string;
};

type CountRow = RowDataPacket & {
  count: number;
};

export type ManagedRecipeInput = {
  slug: string;
  name: string;
  authorName: string;
  isRoasterApproved: boolean;
  brewer: string;
  grams: number;
  iceGrams: number | null;
  pourCount: number | null;
  firstPourTemperature: number | null;
  pourSteps: ManagedPourStep[];
  ratio: string;
  waterMl: number | null;
  roasterSlug: string | null;
  roasterName: string | null;
  mergeGroupKey: string | null;
  brewType: "hot" | "cold" | "filter";
  xbloomUrl: string;
};

let setupPromise: Promise<void> | null = null;

function normalizeSlug(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function repairMojibake(value: string) {
  try {
    return Buffer.from(value, "latin1").toString("utf8");
  } catch {
    return value;
  }
}

function slugCandidates(value: string) {
  const candidates = new Set<string>();
  const normalized = normalizeSlug(value);
  candidates.add(value);
  candidates.add(normalized);
  candidates.add(repairMojibake(value));
  candidates.add(repairMojibake(normalized));
  return [...candidates].filter(Boolean);
}

function mapRecipeRow(row: ManagedRecipeRow): ManagedRecipe {
  let pourSteps: ManagedPourStep[] = [];
  if (row.pour_profile_json) {
    try {
      const parsed = JSON.parse(row.pour_profile_json) as ManagedPourStep[];
      if (Array.isArray(parsed)) {
        pourSteps = parsed;
      }
    } catch {}
  }

  return {
    slug: row.slug,
    name: row.name,
    authorName: row.author_name,
    isRoasterApproved: Boolean(row.is_roaster_approved),
    brewer: row.brewer,
    grams: Number(row.grams),
    iceGrams: row.ice_grams === null ? null : Number(row.ice_grams),
    pourCount: row.pour_count === null ? null : Number(row.pour_count),
    firstPourTemperature:
      row.first_pour_temperature === null
        ? null
        : Number(row.first_pour_temperature),
    pourSteps,
    ratio: row.ratio_text,
    waterMl: row.water_ml === null ? null : Number(row.water_ml),
    roasterSlug: row.roaster_slug,
    roasterName: row.roaster_name,
    mergeGroupKey: row.merge_group_key,
    brewType: row.brew_type,
    xbloomUrl: row.xbloom_url,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

async function ensureColumnExists(columnName: string, sql: string) {
  const pool = getDbPool();
  void columnName;
  await pool.execute(sql);
}

async function ensureIndexExists(indexName: string, sql: string) {
  const pool = getDbPool();
  void indexName;
  await pool.execute(sql);
}

async function ensureRecipesTable() {
  const pool = getDbPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS recipes (
      slug VARCHAR(191) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      author_name VARCHAR(255) NOT NULL,
      is_roaster_approved SMALLINT NOT NULL DEFAULT 0,
      brewer VARCHAR(255) NOT NULL,
      grams NUMERIC(8,2) NOT NULL,
      ice_grams INT NULL,
      pour_count INT NULL,
      first_pour_temperature NUMERIC(6,2) NULL,
      pour_profile_json TEXT NULL,
      ratio_text VARCHAR(64) NOT NULL,
      water_ml INT NULL,
      roaster_slug VARCHAR(191) NULL,
      roaster_name VARCHAR(255) NULL,
      merge_group_key VARCHAR(191) NULL,
      brew_type VARCHAR(16) NOT NULL CHECK (brew_type IN ('hot', 'cold', 'filter')),
      xbloom_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.execute(
    "CREATE INDEX IF NOT EXISTS idx_recipes_roaster_slug ON recipes (roaster_slug)",
  );

  await ensureColumnExists(
    "is_roaster_approved",
    "ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_roaster_approved SMALLINT NOT NULL DEFAULT 0",
  );
  await ensureColumnExists(
    "ice_grams",
    "ALTER TABLE recipes ADD COLUMN IF NOT EXISTS ice_grams INT NULL",
  );
  await ensureColumnExists(
    "pour_count",
    "ALTER TABLE recipes ADD COLUMN IF NOT EXISTS pour_count INT NULL",
  );
  await ensureColumnExists(
    "first_pour_temperature",
    "ALTER TABLE recipes ADD COLUMN IF NOT EXISTS first_pour_temperature NUMERIC(6,2) NULL",
  );
  await ensureColumnExists(
    "pour_profile_json",
    "ALTER TABLE recipes ADD COLUMN IF NOT EXISTS pour_profile_json TEXT NULL",
  );
  await ensureColumnExists(
    "merge_group_key",
    "ALTER TABLE recipes ADD COLUMN IF NOT EXISTS merge_group_key VARCHAR(191) NULL",
  );
  await ensureIndexExists(
    "idx_recipes_updated_created",
    "CREATE INDEX IF NOT EXISTS idx_recipes_updated_created ON recipes (updated_at, created_at)",
  );
  await ensureIndexExists(
    "idx_recipes_created_at",
    "CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON recipes (created_at)",
  );

  const [slugRows] = await pool.query<RecipeSlugRow[]>(
    "SELECT slug, created_at FROM recipes ORDER BY created_at ASC",
  );
  const usedSlugs = new Set(slugRows.map((row) => row.slug));

  for (const row of slugRows) {
    if (/^[a-z0-9-]+$/.test(row.slug)) {
      continue;
    }

    usedSlugs.delete(row.slug);
    const timestamp = Math.floor(new Date(row.created_at).getTime() / 1000);
    let candidate = `recipe-${timestamp}`;
    let counter = 1;

    while (usedSlugs.has(candidate)) {
      counter += 1;
      candidate = `recipe-${timestamp}-${counter}`;
    }

    await pool.execute<ResultSetHeader>(
      "UPDATE recipes SET slug = ? WHERE slug = ?",
      [candidate, row.slug],
    );
    usedSlugs.add(candidate);
  }

  // Normalize known coffee-origin transliteration in existing records.
  await pool.execute<ResultSetHeader>(
    `
      UPDATE recipes
      SET name = REPLACE(name, 'جوجي', 'قوجي')
      WHERE name LIKE '%جوجي%'
    `,
  );
}

export async function ensureRecipesReady() {
  if (!setupPromise) {
    setupPromise = ensureRecipesTable().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }

  await setupPromise;
}

export async function listManagedRecipes() {
  try {
    await ensureRecipesReady();
    const pool = getDbPool();
    const [rows] = await pool.query<ManagedRecipeRow[]>(
      "SELECT * FROM recipes ORDER BY updated_at DESC, created_at DESC",
    );
    return rows.map(mapRecipeRow);
  } catch (error) {
    if (!isRecoverableDbError(error)) {
      throw error;
    }
    console.error("Database unavailable in listManagedRecipes, returning empty list.");
    return [];
  }
}

export async function listManagedRecipesBySlugs(slugs: string[]) {
  try {
    await ensureRecipesReady();
    const normalized = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
    if (normalized.length === 0) {
      return [];
    }

    const pool = getDbPool();
    const placeholders = normalized.map(() => "?").join(", ");
    const [rows] = await pool.query<ManagedRecipeRow[]>(
      `
        SELECT *
        FROM recipes
        WHERE slug IN (${placeholders})
      `,
      normalized,
    );
    const recipeBySlug = new Map(rows.map((row) => [row.slug, mapRecipeRow(row)]));

    return normalized
      .map((slug) => recipeBySlug.get(slug))
      .filter((recipe): recipe is ManagedRecipe => recipe !== undefined);
  } catch (error) {
    if (!isRecoverableDbError(error)) {
      throw error;
    }
    console.error("Database unavailable in listManagedRecipesBySlugs, returning empty list.");
    return [];
  }
}

export async function countManagedRecipes() {
  try {
    await ensureRecipesReady();
    const pool = getDbPool();
    const [rows] = await pool.query<CountRow[]>("SELECT COUNT(*) AS count FROM recipes");
    return Number(rows[0]?.count ?? 0);
  } catch (error) {
    if (!isRecoverableDbError(error)) {
      throw error;
    }
    console.error("Database unavailable in countManagedRecipes, returning 0.");
    return 0;
  }
}

export async function listManagedRecipesRandom(limit = 8) {
  try {
    await ensureRecipesReady();
    const pool = getDbPool();
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const [rows] = await pool.query<ManagedRecipeRow[]>(
      `
        SELECT *
        FROM recipes
        ORDER BY RANDOM()
        LIMIT ?
      `,
      [safeLimit],
    );
    return rows.map(mapRecipeRow);
  } catch (error) {
    if (!isRecoverableDbError(error)) {
      throw error;
    }
    console.error("Database unavailable in listManagedRecipesRandom, returning empty list.");
    return [];
  }
}

export async function listManagedRecipesByRoaster(roasterSlug: string) {
  try {
    await ensureRecipesReady();
    const pool = getDbPool();
    for (const candidate of slugCandidates(roasterSlug)) {
      const [rows] = await pool.execute<ManagedRecipeRow[]>(
        "SELECT * FROM recipes WHERE roaster_slug = ? ORDER BY updated_at DESC, created_at DESC",
        [candidate],
      );

      if (rows.length > 0) {
        return rows.map(mapRecipeRow);
      }
    }
    return [];
  } catch (error) {
    if (!isRecoverableDbError(error)) {
      throw error;
    }
    console.error("Database unavailable in listManagedRecipesByRoaster, returning empty list.");
    return [];
  }
}

export async function getManagedRecipeBySlug(slug: string) {
  try {
    await ensureRecipesReady();
    const pool = getDbPool();
    for (const candidate of slugCandidates(slug)) {
      const [rows] = await pool.execute<ManagedRecipeRow[]>(
        "SELECT * FROM recipes WHERE slug = ? LIMIT 1",
        [candidate],
      );

      if (rows[0]) {
        return mapRecipeRow(rows[0]);
      }
    }
    return null;
  } catch (error) {
    if (!isRecoverableDbError(error)) {
      throw error;
    }
    console.error("Database unavailable in getManagedRecipeBySlug, returning null.");
    return null;
  }
}

export async function saveManagedRecipe(input: ManagedRecipeInput) {
  await ensureRecipesReady();
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO recipes (
        slug,
        name,
        author_name,
        is_roaster_approved,
        brewer,
        grams,
        ice_grams,
        pour_count,
        first_pour_temperature,
        pour_profile_json,
        ratio_text,
        water_ml,
        roaster_slug,
        roaster_name,
        merge_group_key,
        brew_type,
        xbloom_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (slug) DO UPDATE
      SET
        name = EXCLUDED.name,
        author_name = EXCLUDED.author_name,
        is_roaster_approved = EXCLUDED.is_roaster_approved,
        brewer = EXCLUDED.brewer,
        grams = EXCLUDED.grams,
        ice_grams = EXCLUDED.ice_grams,
        pour_count = EXCLUDED.pour_count,
        first_pour_temperature = EXCLUDED.first_pour_temperature,
        pour_profile_json = EXCLUDED.pour_profile_json,
        ratio_text = EXCLUDED.ratio_text,
        water_ml = EXCLUDED.water_ml,
        roaster_slug = EXCLUDED.roaster_slug,
        roaster_name = EXCLUDED.roaster_name,
        merge_group_key = EXCLUDED.merge_group_key,
        brew_type = EXCLUDED.brew_type,
        xbloom_url = EXCLUDED.xbloom_url,
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      input.slug,
      input.name,
      input.authorName,
      input.isRoasterApproved ? 1 : 0,
      input.brewer,
      input.grams,
      input.iceGrams,
      input.pourCount,
      input.firstPourTemperature,
      JSON.stringify(input.pourSteps ?? []),
      input.ratio,
      input.waterMl,
      input.roasterSlug,
      input.roasterName,
      input.mergeGroupKey,
      input.brewType,
      input.xbloomUrl,
    ],
  );
}

export async function deleteManagedRecipe(slug: string) {
  await ensureRecipesReady();
  const pool = getDbPool();
  for (const candidate of slugCandidates(slug)) {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM recipes WHERE slug = ?",
      [candidate],
    );

    if (result.affectedRows > 0) {
      return;
    }
  }
}
