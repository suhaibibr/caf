import type { ResultSetHeader } from "mysql2";
import { getDbPool } from "@/lib/db";

let setupPromise: Promise<void> | null = null;

async function ensureMaintenanceTable() {
  const pool = getDbPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS maintenance_tasks (
      task_name VARCHAR(64) NOT NULL PRIMARY KEY,
      last_run_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function ensureMaintenanceReady() {
  if (!setupPromise) {
    setupPromise = ensureMaintenanceTable().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }
  await setupPromise;
}

/**
 * Atomic best-effort scheduler:
 * only one request wins the update when interval elapsed.
 */
export async function acquireMaintenanceTaskRun(taskName: string, intervalMinutes: number) {
  await ensureMaintenanceReady();
  const pool = getDbPool();

  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO maintenance_tasks (task_name, last_run_at)
      VALUES (?, TIMESTAMPTZ '1970-01-01 00:00:00+00')
      ON CONFLICT (task_name) DO NOTHING
    `,
    [taskName],
  );

  const [updateResult] = await pool.execute<ResultSetHeader>(
    `
      UPDATE maintenance_tasks
      SET last_run_at = NOW(),
          updated_at = CURRENT_TIMESTAMP
      WHERE task_name = ?
        AND last_run_at < (NOW() - (? * INTERVAL '1 minute'))
    `,
    [taskName, Math.max(1, Math.floor(intervalMinutes))],
  );

  return updateResult.affectedRows > 0;
}
