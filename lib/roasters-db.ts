import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { isRecoverableDbError } from "@/lib/db-errors";
import { ensureRecipesReady } from "@/lib/recipes-db";
import {
  getRoaster,
  getRecipesByRoaster,
  roasters as seedRoasters,
  type Roaster,
} from "@/lib/data";

type RoasterRow = RowDataPacket & {
  slug: string;
  name: string;
  short_name: string;
  description: string;
  about: string;
  location: string;
  logo: string;
  cover_image: string;
  accent: string;
  featured: number;
};

type RecipeCountRow = RowDataPacket & {
  roaster_slug: string | null;
  total_count: number;
  approved_count: number;
};

type ManagedRecipeCounts = {
  total: number;
  approved: number;
};

type RoasterInput = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  about: string;
  location: string;
  logo: string;
  coverImage: string;
  accent: string;
  featured: boolean;
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

function mapRoasterRow(row: RoasterRow): Roaster {
  return {
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    description: row.description,
    about: row.about,
    location: row.location,
    logo: row.logo,
    coverImage: row.cover_image,
    accent: row.accent,
    featured: Boolean(row.featured),
  };
}

async function getManagedRecipeCountMap() {
  await ensureRecipesReady();
  const pool = getDbPool();
  const [rows] = await pool.query<RecipeCountRow[]>(`
    SELECT
      roaster_slug,
      COUNT(*) AS total_count,
      SUM(CASE WHEN is_roaster_approved = 1 THEN 1 ELSE 0 END) AS approved_count
    FROM recipes
    WHERE roaster_slug IS NOT NULL AND roaster_slug <> ''
    GROUP BY roaster_slug
  `);

  const countMap = new Map<string, ManagedRecipeCounts>();
  for (const row of rows) {
    if (row.roaster_slug) {
      countMap.set(row.roaster_slug, {
        total: Number(row.total_count ?? 0),
        approved: Number(row.approved_count ?? 0),
      });
    }
  }

  return countMap;
}

function withRecipeCount(
  roaster: Roaster,
  managedCountMap: Map<string, ManagedRecipeCounts>,
) {
  const staticCount = getRecipesByRoaster(roaster.slug).length;
  const managedCounts = managedCountMap.get(roaster.slug) ?? { total: 0, approved: 0 };

  return {
    ...roaster,
    recipeCount: staticCount + managedCounts.total,
    approvedRecipeCount: managedCounts.approved,
  };
}

function withStaticRecipeCount(roaster: Roaster) {
  return {
    ...roaster,
    recipeCount: getRecipesByRoaster(roaster.slug).length,
    approvedRecipeCount: 0,
  };
}

async function ensureIndexExists(indexName: string, sql: string) {
  const pool = getDbPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `
      SELECT INDEX_NAME
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'roasters'
        AND index_name = ?
      LIMIT 1
    `,
    [indexName],
  );

  if (!rows[0]) {
    await pool.execute(sql);
  }
}

async function ensureRoastersTable() {
  const pool = getDbPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS roasters (
      slug VARCHAR(191) NOT NULL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      short_name VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      about TEXT NOT NULL,
      location VARCHAR(255) NOT NULL,
      logo VARCHAR(32) NOT NULL,
      cover_image LONGTEXT NOT NULL,
      accent VARCHAR(32) NOT NULL,
      featured TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
  await ensureIndexExists(
    "idx_roasters_updated_created",
    "ALTER TABLE roasters ADD INDEX idx_roasters_updated_created (updated_at, created_at)",
  );

  const [countRows] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS count FROM roasters",
  );
  const count = Number(countRows[0]?.count ?? 0);

  if (count === 0) {
    const values = seedRoasters.map((roaster) => [
      roaster.slug,
      roaster.name,
      roaster.shortName,
      roaster.description,
      roaster.about,
      roaster.location,
      roaster.logo,
      roaster.coverImage,
      roaster.accent,
      roaster.featured ? 1 : 0,
    ]);

    for (const value of values) {
      await pool.execute<ResultSetHeader>(
        `
          INSERT INTO roasters (
            slug,
            name,
            short_name,
            description,
            about,
            location,
            logo,
            cover_image,
            accent,
            featured
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        value,
      );
    }
  }

  // Clean legacy placeholders so the roaster header stays visually clean.
  await pool.execute<ResultSetHeader>(
    `
      UPDATE roasters
      SET description = ''
      WHERE description = 'محمصة جديدة قيد التحرير.'
    `,
  );
  await pool.execute<ResultSetHeader>(
    `
      UPDATE roasters
      SET location = ''
      WHERE location = 'غير محدد'
    `,
  );
  await pool.execute<ResultSetHeader>(
    `
      UPDATE roasters
      SET about = ''
      WHERE about = 'يمكنك استكمال بيانات هذه المحمصة لاحقًا.'
    `,
  );
}

export async function ensureRoastersReady() {
  if (!setupPromise) {
    setupPromise = ensureRoastersTable();
  }

  await setupPromise;
}

export async function listRoasters() {
  try {
    await ensureRoastersReady();
    const [pool, managedCountMap] = await Promise.all([
      Promise.resolve(getDbPool()),
      getManagedRecipeCountMap(),
    ]);
    const [rows] = await pool.query<RoasterRow[]>(
      "SELECT * FROM roasters ORDER BY updated_at DESC, created_at DESC",
    );
    return rows.map((row) => withRecipeCount(mapRoasterRow(row), managedCountMap));
  } catch (error) {
    if (!isRecoverableDbError(error)) {
      throw error;
    }
    console.error("Database unavailable in listRoasters, serving static fallback.");
    return seedRoasters.map(withStaticRecipeCount);
  }
}

export async function getRoasterBySlug(slug: string) {
  try {
    await ensureRoastersReady();
    const [pool, managedCountMap] = await Promise.all([
      Promise.resolve(getDbPool()),
      getManagedRecipeCountMap(),
    ]);
    for (const candidate of slugCandidates(slug)) {
      const [rows] = await pool.execute<RoasterRow[]>(
        "SELECT * FROM roasters WHERE slug = ? LIMIT 1",
        [candidate],
      );

      if (rows[0]) {
        return withRecipeCount(mapRoasterRow(rows[0]), managedCountMap);
      }
    }
  } catch (error) {
    if (!isRecoverableDbError(error)) {
      throw error;
    }
    console.error("Database unavailable in getRoasterBySlug, serving static fallback.");
    for (const candidate of slugCandidates(slug)) {
      const roaster = getRoaster(candidate);
      if (roaster) {
        return withStaticRecipeCount(roaster);
      }
    }
  }

  return null;
}

export async function saveRoaster(input: RoasterInput) {
  await ensureRoastersReady();
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO roasters (
        slug,
        name,
        short_name,
        description,
        about,
        location,
        logo,
        cover_image,
        accent,
        featured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        short_name = VALUES(short_name),
        description = VALUES(description),
        about = VALUES(about),
        location = VALUES(location),
        logo = VALUES(logo),
        cover_image = VALUES(cover_image),
        accent = VALUES(accent),
        featured = VALUES(featured)
    `,
    [
      input.slug,
      input.name,
      input.shortName,
      input.description,
      input.about,
      input.location,
      input.logo,
      input.coverImage,
      input.accent,
      input.featured ? 1 : 0,
    ],
  );
}

export async function deleteRoaster(slug: string) {
  await ensureRoastersReady();
  const pool = getDbPool();
  for (const candidate of slugCandidates(slug)) {
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM roasters WHERE slug = ?",
      [candidate],
    );

    if (result.affectedRows > 0) {
      return;
    }
  }
}
