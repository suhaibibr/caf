import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";

const PRESENCE_WINDOW_SECONDS = 120;
let setupPromise: Promise<void> | null = null;

type CounterRow = RowDataPacket & {
  total_visits: number;
};

type ConnectedRow = RowDataPacket & {
  count: number;
};

async function ensureSiteMetricsTables() {
  const pool = getDbPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS site_metrics_counter (
      id TINYINT(1) NOT NULL PRIMARY KEY,
      total_visits BIGINT UNSIGNED NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS site_metrics_presence (
      session_id VARCHAR(191) NOT NULL PRIMARY KEY,
      last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS site_metrics_visited_sessions (
      session_id VARCHAR(191) NOT NULL PRIMARY KEY,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO site_metrics_counter (id, total_visits)
      VALUES (1, 0)
      ON DUPLICATE KEY UPDATE id = VALUES(id)
    `,
  );
}

export async function ensureSiteMetricsReady() {
  if (!setupPromise) {
    setupPromise = ensureSiteMetricsTables();
  }
  await setupPromise;
}

async function cleanupPresence() {
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `
      DELETE FROM site_metrics_presence
      WHERE last_seen < (NOW() - INTERVAL ${PRESENCE_WINDOW_SECONDS} SECOND)
    `,
  );
}

export async function trackSiteSession(sessionId: string) {
  await ensureSiteMetricsReady();
  const pool = getDbPool();
  const normalized = sessionId.trim();
  if (!normalized) {
    return;
  }

  await cleanupPresence();
  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO site_metrics_presence (session_id, last_seen)
      VALUES (?, NOW())
      ON DUPLICATE KEY UPDATE
        last_seen = NOW()
    `,
    [normalized],
  );

  const [visitInsert] = await pool.execute<ResultSetHeader>(
    `
      INSERT IGNORE INTO site_metrics_visited_sessions (session_id)
      VALUES (?)
    `,
    [normalized],
  );

  if (visitInsert.affectedRows > 0) {
    await pool.execute<ResultSetHeader>(
      `
        UPDATE site_metrics_counter
        SET total_visits = total_visits + 1
        WHERE id = 1
      `,
    );
  }
}

export async function getSiteMetrics() {
  await ensureSiteMetricsReady();
  const pool = getDbPool();
  await cleanupPresence();

  const [counterRows] = await pool.query<CounterRow[]>(
    "SELECT total_visits FROM site_metrics_counter WHERE id = 1 LIMIT 1",
  );
  const totalVisits = Number(counterRows[0]?.total_visits ?? 0);

  const [connectedRows] = await pool.query<ConnectedRow[]>(
    `
      SELECT COUNT(*) AS count
      FROM site_metrics_presence
      WHERE last_seen >= (NOW() - INTERVAL ${PRESENCE_WINDOW_SECONDS} SECOND)
    `,
  );
  const connectedUsers = Number(connectedRows[0]?.count ?? 0);

  return {
    totalVisits,
    connectedUsers,
  };
}

