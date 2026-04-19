import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";

export type RecipeSubmissionStatus = "pending" | "approved" | "reviewed" | "rejected";

export type RecipeSubmissionInput = {
  name: string;
  authorName: string;
  grams: number;
  iceGrams: number | null;
  pourCount: number | null;
  firstPourTemperature: number | null;
  pourSteps: Array<{
    name: string;
    volumeMl: number | null;
    temperatureC: number | null;
    seconds: number | null;
  }>;
  brewer: string;
  ratioInput: string;
  roasterSlug: string | null;
  roasterName: string | null;
  brewType: "hot" | "cold";
  xbloomUrl: string;
  submitterIp: string;
};

export type RecipeSubmissionRecord = {
  id: number;
  name: string;
  authorName: string;
  grams: number;
  iceGrams: number | null;
  pourCount: number | null;
  firstPourTemperature: number | null;
  pourSteps: Array<{
    name: string;
    volumeMl: number | null;
    temperatureC: number | null;
    seconds: number | null;
  }>;
  brewer: string;
  ratioInput: string;
  roasterSlug: string | null;
  roasterName: string | null;
  brewType: "hot" | "cold";
  xbloomUrl: string;
  submitterIp: string;
  status: RecipeSubmissionStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: number | null;
};

type RecipeSubmissionRow = RowDataPacket & {
  id: number;
  name: string;
  author_name: string;
  grams: number;
  ice_grams: number | null;
  pour_count: number | null;
  first_pour_temperature: number | null;
  pour_profile_json: string | null;
  brewer: string;
  ratio_input: string;
  roaster_slug: string | null;
  roaster_name: string | null;
  brew_type: "hot" | "cold";
  xbloom_url: string;
  submitter_ip: string;
  status: RecipeSubmissionStatus;
  created_at: Date | string;
  reviewed_at: Date | string | null;
  reviewed_by: number | null;
};

let setupPromise: Promise<void> | null = null;

function mapSubmissionRow(row: RecipeSubmissionRow): RecipeSubmissionRecord {
  let pourSteps: RecipeSubmissionRecord["pourSteps"] = [];
  if (row.pour_profile_json) {
    try {
      const parsed = JSON.parse(row.pour_profile_json) as RecipeSubmissionRecord["pourSteps"];
      if (Array.isArray(parsed)) {
        pourSteps = parsed;
      }
    } catch {}
  }

  return {
    id: Number(row.id),
    name: row.name,
    authorName: row.author_name,
    grams: Number(row.grams),
    iceGrams: row.ice_grams === null ? null : Number(row.ice_grams),
    pourCount: row.pour_count === null ? null : Number(row.pour_count),
    firstPourTemperature:
      row.first_pour_temperature === null ? null : Number(row.first_pour_temperature),
    pourSteps,
    brewer: row.brewer,
    ratioInput: row.ratio_input,
    roasterSlug: row.roaster_slug,
    roasterName: row.roaster_name,
    brewType: row.brew_type,
    xbloomUrl: row.xbloom_url,
    submitterIp: row.submitter_ip,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    reviewedBy: row.reviewed_by === null ? null : Number(row.reviewed_by),
  };
}

async function ensureRecipeSubmissionsTable() {
  const pool = getDbPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS recipe_submissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      author_name VARCHAR(255) NOT NULL,
      grams DECIMAL(8,2) NOT NULL,
      ice_grams INT NULL,
      pour_count INT NULL,
      first_pour_temperature DECIMAL(6,2) NULL,
      pour_profile_json LONGTEXT NULL,
      brewer VARCHAR(255) NOT NULL,
      ratio_input VARCHAR(128) NOT NULL,
      roaster_slug VARCHAR(191) NULL,
      roaster_name VARCHAR(255) NULL,
      brew_type ENUM('hot', 'cold') NOT NULL,
      xbloom_url TEXT NOT NULL,
      submitter_ip VARCHAR(64) NOT NULL,
      status ENUM('pending', 'approved', 'reviewed', 'rejected') NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME NULL,
      reviewed_by BIGINT UNSIGNED NULL,
      INDEX idx_recipe_submissions_status (status),
      INDEX idx_recipe_submissions_created_at (created_at)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await pool.execute(`
    ALTER TABLE recipe_submissions
    MODIFY COLUMN status ENUM('pending', 'approved', 'reviewed', 'rejected')
    NOT NULL DEFAULT 'pending'
  `);
}

export async function ensureRecipeSubmissionsReady() {
  if (!setupPromise) {
    setupPromise = ensureRecipeSubmissionsTable();
  }
  await setupPromise;
}

export async function createRecipeSubmission(input: RecipeSubmissionInput) {
  await ensureRecipeSubmissionsReady();
  const pool = getDbPool();
  const [result] = await pool.execute<ResultSetHeader>(
    `
      INSERT INTO recipe_submissions (
        name,
        author_name,
        grams,
        ice_grams,
        pour_count,
        first_pour_temperature,
        pour_profile_json,
        brewer,
        ratio_input,
        roaster_slug,
        roaster_name,
        brew_type,
        xbloom_url,
        submitter_ip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.name,
      input.authorName,
      input.grams,
      input.iceGrams,
      input.pourCount,
      input.firstPourTemperature,
      JSON.stringify(input.pourSteps ?? []),
      input.brewer,
      input.ratioInput,
      input.roasterSlug,
      input.roasterName,
      input.brewType,
      input.xbloomUrl,
      input.submitterIp,
    ],
  );
  return Number(result.insertId);
}

export async function listRecipeSubmissions(status: RecipeSubmissionStatus = "pending") {
  await ensureRecipeSubmissionsReady();
  const pool = getDbPool();
  const [rows] = await pool.execute<RecipeSubmissionRow[]>(
    `
      SELECT *
      FROM recipe_submissions
      WHERE status = ?
      ORDER BY created_at DESC
      LIMIT 500
    `,
    [status],
  );
  return rows.map(mapSubmissionRow);
}

export async function getRecipeSubmissionById(id: number) {
  await ensureRecipeSubmissionsReady();
  const pool = getDbPool();
  const [rows] = await pool.execute<RecipeSubmissionRow[]>(
    "SELECT * FROM recipe_submissions WHERE id = ? LIMIT 1",
    [id],
  );
  const row = rows[0];
  return row ? mapSubmissionRow(row) : null;
}

export async function updateRecipeSubmission(input: {
  id: number;
  name: string;
  authorName: string;
  grams: number;
  iceGrams: number | null;
  pourCount: number | null;
  firstPourTemperature: number | null;
  pourSteps: RecipeSubmissionRecord["pourSteps"];
  brewer: string;
  ratioInput: string;
  roasterSlug: string | null;
  roasterName: string | null;
  brewType: "hot" | "cold";
  xbloomUrl: string;
}) {
  await ensureRecipeSubmissionsReady();
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `
      UPDATE recipe_submissions
      SET
        name = ?,
        author_name = ?,
        grams = ?,
        ice_grams = ?,
        pour_count = ?,
        first_pour_temperature = ?,
        pour_profile_json = ?,
        brewer = ?,
        ratio_input = ?,
        roaster_slug = ?,
        roaster_name = ?,
        brew_type = ?,
        xbloom_url = ?
      WHERE id = ?
    `,
    [
      input.name,
      input.authorName,
      input.grams,
      input.iceGrams,
      input.pourCount,
      input.firstPourTemperature,
      JSON.stringify(input.pourSteps ?? []),
      input.brewer,
      input.ratioInput,
      input.roasterSlug,
      input.roasterName,
      input.brewType,
      input.xbloomUrl,
      input.id,
    ],
  );
}

export async function setRecipeSubmissionsStatus(input: {
  ids: number[];
  status: RecipeSubmissionStatus;
  reviewedBy: number;
}) {
  await ensureRecipeSubmissionsReady();
  const pool = getDbPool();
  if (input.ids.length === 0) {
    return 0;
  }
  const placeholders = input.ids.map(() => "?").join(",");
  const [result] = await pool.execute<ResultSetHeader>(
    `
      UPDATE recipe_submissions
      SET
        status = ?,
        reviewed_at = NOW(),
        reviewed_by = ?
      WHERE id IN (${placeholders})
    `,
    [input.status, input.reviewedBy, ...input.ids],
  );
  return Number(result.affectedRows ?? 0);
}

export async function deleteRecipeSubmissions(ids: number[]) {
  await ensureRecipeSubmissionsReady();
  const pool = getDbPool();
  if (ids.length === 0) {
    return 0;
  }
  const placeholders = ids.map(() => "?").join(",");
  const [result] = await pool.execute<ResultSetHeader>(
    `DELETE FROM recipe_submissions WHERE id IN (${placeholders})`,
    ids,
  );
  return Number(result.affectedRows ?? 0);
}

