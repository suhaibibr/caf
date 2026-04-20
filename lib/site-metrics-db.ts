import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import { isRecoverableDbError } from "@/lib/db-errors";

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
      id SMALLINT NOT NULL PRIMARY KEY,
      total_visits BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS site_metrics_presence (
      session_id VARCHAR(191) NOT NULL PRIMARY KEY,
      last_seen TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS site_metrics_visited_sessions (
      session_id VARCHAR(191) NOT NULL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO site_metrics_counter (id, total_visits)
      VALUES (1, 0)
      ON CONFLICT (id) DO NOTHING
    `,
  );
}

export async function ensureSiteMetricsReady() {
  if (!setupPromise) {
    setupPromise = ensureSiteMetricsTables().catch((error) => {
      setupPromise = null;
      throw error;
    });
  }
  await setupPromise;
}

async function cleanupPresence() {
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `
      DELETE FROM site_metrics_presence
      WHERE last_seen < (NOW() - INTERVAL '${PRESENCE_WINDOW_SECONDS} seconds')
    `,
  );
}

export async function trackSiteSession(sessionId: string) {
  try {
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
        ON CONFLICT (session_id) DO UPDATE
        SET
          last_seen = NOW()
      `,
      [normalized],
    );

    const [visitInsert] = await pool.execute<ResultSetHeader>(
      `
        INSERT INTO site_metrics_visited_sessions (session_id)
        VALUES (?)
        ON CONFLICT (session_id) DO NOTHING
      `,
      [normalized],
    );

    if (visitInsert.affectedRows > 0) {
      await pool.execute<ResultSetHeader>(
        `
          UPDATE site_metrics_counter
          SET total_visits = total_visits + 1,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = 1
        `,
      );
    }
  } catch (error) {
    if (!isRecoverableDbError(error)) {
      throw error;
    }
    // Presence metrics are best-effort and should not break page rendering.
  }
}

export async function getSiteMetrics() {
  try {
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
        WHERE last_seen >= (NOW() - INTERVAL '${PRESENCE_WINDOW_SECONDS} seconds')
      `,
    );
    const connectedUsers = Number(connectedRows[0]?.count ?? 0);

    return {
      totalVisits,
      connectedUsers,
    };
  } catch (error) {
    if (!isRecoverableDbError(error)) {
      throw error;
    }

    return {
      totalVisits: 0,
      connectedUsers: 0,
    };
  }
}
