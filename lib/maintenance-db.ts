import type { ResultSetHeader } from "mysql2";
import { getDbPool } from "@/lib/db";

let setupPromise: Promise<void> | null = null;

async function ensureMaintenanceTable() {
  const pool = getDbPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS maintenance_tasks (
      task_name VARCHAR(64) NOT NULL PRIMARY KEY,
      last_run_at DATETIME NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

export async function ensureMaintenanceReady() {
  if (!setupPromise) {
    setupPromise = ensureMaintenanceTable();
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
      VALUES (?, '1970-01-01 00:00:00')
      ON DUPLICATE KEY UPDATE task_name = VALUES(task_name)
    `,
    [taskName],
  );

  const [updateResult] = await pool.execute<ResultSetHeader>(
    `
      UPDATE maintenance_tasks
      SET last_run_at = NOW()
      WHERE task_name = ?
        AND last_run_at < (NOW() - INTERVAL ? MINUTE)
    `,
    [taskName, Math.max(1, Math.floor(intervalMinutes))],
  );

  return updateResult.affectedRows > 0;
}

