import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getDbPool } from "@/lib/db";
import type { AuthRole, SecurityEventSeverity } from "@/lib/auth/constants";
import {
  ADMIN_AUDIT_RETENTION_DAYS,
  LOGIN_ATTEMPTS_RETENTION_DAYS,
  SECURITY_EVENTS_RETENTION_DAYS,
} from "@/lib/auth/constants";

export type AuthUserRecord = {
  id: number;
  email: string;
  role: AuthRole;
  isActive: boolean;
  isSuperAdmin: boolean;
  mustChangePassword: boolean;
  passwordHash: string;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
};

export type AuthSessionRecord = {
  sessionId: string;
  userId: number;
  expiresAt: string;
  revokedAt: string | null;
  ipAddress: string;
  userAgent: string;
  rememberMe: boolean;
  lastSeenAt: string;
};

export type AuthSessionWithUser = {
  session: AuthSessionRecord;
  user: AuthUserRecord;
};

type AuthUserRow = RowDataPacket & {
  id: number;
  email: string;
  role: AuthRole;
  is_active: number;
  is_super_admin: number;
  must_change_password: number;
  password_hash: string;
  failed_login_attempts: number;
  locked_until: Date | string | null;
  last_login_at: Date | string | null;
};

type AuthSessionRow = RowDataPacket & {
  session_id: string;
  user_id: number;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  ip_address: string;
  user_agent: string;
  remember_me: number;
  last_seen_at: Date | string;
};

type AuthSessionWithUserRow = AuthSessionRow &
  AuthUserRow & {
    auth_user_id: number;
  };

type CountRow = RowDataPacket & {
  count: number;
};

type AdminUserListRow = RowDataPacket & {
  id: number;
  email: string;
  role: AuthRole;
  is_active: number;
  is_super_admin: number;
  must_change_password: number;
  last_login_at: Date | string | null;
  created_at: Date | string;
};

type LoginAttemptCountRow = RowDataPacket & {
  ip_count: number;
  email_count: number;
};

let setupPromise: Promise<void> | null = null;

function mapUserRow(row: AuthUserRow): AuthUserRecord {
  return {
    id: Number(row.id),
    email: row.email,
    role: row.role,
    isActive: Boolean(row.is_active),
    isSuperAdmin: Boolean(row.is_super_admin),
    mustChangePassword: Boolean(row.must_change_password),
    passwordHash: row.password_hash,
    failedLoginAttempts: Number(row.failed_login_attempts ?? 0),
    lockedUntil: row.locked_until ? new Date(row.locked_until).toISOString() : null,
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
  };
}

function mapSessionRow(row: AuthSessionRow): AuthSessionRecord {
  return {
    sessionId: row.session_id,
    userId: Number(row.user_id),
    expiresAt: new Date(row.expires_at).toISOString(),
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    rememberMe: Boolean(row.remember_me),
    lastSeenAt: new Date(row.last_seen_at).toISOString(),
  };
}

async function ensureAuthUsersColumn(columnName: string, sql: string) {
  const pool = getDbPool();
  const [rows] = await pool.execute<RowDataPacket[]>(
    `
      SELECT COLUMN_NAME
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'auth_users'
        AND column_name = ?
      LIMIT 1
    `,
    [columnName],
  );

  if (!rows[0]) {
    await pool.execute(sql);
  }
}

async function ensureAuthTables() {
  const pool = getDbPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(191) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_super_admin TINYINT(1) NOT NULL DEFAULT 0,
      must_change_password TINYINT(1) NOT NULL DEFAULT 0,
      failed_login_attempts INT UNSIGNED NOT NULL DEFAULT 0,
      locked_until DATETIME NULL,
      last_login_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await ensureAuthUsersColumn(
    "is_super_admin",
    "ALTER TABLE auth_users ADD COLUMN is_super_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active",
  );
  await ensureAuthUsersColumn(
    "must_change_password",
    "ALTER TABLE auth_users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER is_super_admin",
  );

  const [superAdminCountRows] = await pool.query<CountRow[]>(
    "SELECT COUNT(*) AS count FROM auth_users WHERE role = 'admin' AND is_super_admin = 1",
  );
  const superAdminCount = Number(superAdminCountRows[0]?.count ?? 0);
  if (superAdminCount === 0) {
    await pool.execute<ResultSetHeader>(
      `
        UPDATE auth_users
        SET is_super_admin = 1
        WHERE role = 'admin'
        ORDER BY created_at ASC
        LIMIT 1
      `,
    );
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      session_id VARCHAR(64) NOT NULL PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      remember_me TINYINT(1) NOT NULL DEFAULT 0,
      ip_address VARCHAR(64) NOT NULL,
      user_agent VARCHAR(512) NOT NULL,
      issued_at DATETIME NOT NULL,
      last_seen_at DATETIME NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      revoke_reason VARCHAR(191) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_auth_sessions_user_id (user_id),
      INDEX idx_auth_sessions_expires_at (expires_at),
      INDEX idx_auth_sessions_revoked_at (revoked_at),
      CONSTRAINT fk_auth_sessions_user
        FOREIGN KEY (user_id) REFERENCES auth_users(id)
        ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS auth_login_attempts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email_normalized VARCHAR(191) NULL,
      ip_address VARCHAR(64) NOT NULL,
      user_agent VARCHAR(512) NOT NULL,
      was_success TINYINT(1) NOT NULL DEFAULT 0,
      reason VARCHAR(191) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_auth_login_attempts_created_at (created_at),
      INDEX idx_auth_login_attempts_ip_created (ip_address, created_at),
      INDEX idx_auth_login_attempts_email_created (email_normalized, created_at)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS security_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NULL,
      event_type VARCHAR(64) NOT NULL,
      severity ENUM('info', 'warning', 'critical') NOT NULL DEFAULT 'info',
      path VARCHAR(255) NULL,
      method VARCHAR(16) NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      details_json LONGTEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_security_events_created_at (created_at),
      INDEX idx_security_events_type (event_type),
      INDEX idx_security_events_user_id (user_id)
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      admin_user_id BIGINT UNSIGNED NOT NULL,
      action VARCHAR(64) NOT NULL,
      resource_type VARCHAR(64) NOT NULL,
      resource_id VARCHAR(191) NULL,
      path VARCHAR(255) NULL,
      method VARCHAR(16) NULL,
      ip_address VARCHAR(64) NULL,
      user_agent VARCHAR(512) NULL,
      details_json LONGTEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_admin_audit_logs_created_at (created_at),
      INDEX idx_admin_audit_logs_admin_user_id (admin_user_id),
      INDEX idx_admin_audit_logs_action (action),
      CONSTRAINT fk_admin_audit_logs_user
        FOREIGN KEY (admin_user_id) REFERENCES auth_users(id)
        ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);
}

export async function ensureAuthReady() {
  if (!setupPromise) {
    setupPromise = ensureAuthTables();
  }
  await setupPromise;
}

export async function getAuthUserByEmail(email: string) {
  await ensureAuthReady();
  const pool = getDbPool();
  const [rows] = await pool.execute<AuthUserRow[]>(
    "SELECT * FROM auth_users WHERE email = ? LIMIT 1",
    [email],
  );
  const row = rows[0];
  return row ? mapUserRow(row) : null;
}

export async function getAuthUserById(id: number) {
  await ensureAuthReady();
  const pool = getDbPool();
  const [rows] = await pool.execute<AuthUserRow[]>(
    "SELECT * FROM auth_users WHERE id = ? LIMIT 1",
    [id],
  );
  const row = rows[0];
  return row ? mapUserRow(row) : null;
}

export async function upsertAuthUser(input: {
  email: string;
  passwordHash: string;
  role: AuthRole;
  isActive?: boolean;
  isSuperAdmin?: boolean;
  mustChangePassword?: boolean;
}) {
  await ensureAuthReady();
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO auth_users (
        email,
        password_hash,
        role,
        is_active,
        is_super_admin,
        must_change_password
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        role = VALUES(role),
        is_active = VALUES(is_active),
        is_super_admin = VALUES(is_super_admin),
        must_change_password = VALUES(must_change_password)
    `,
    [
      input.email,
      input.passwordHash,
      input.role,
      input.isActive === false ? 0 : 1,
      input.isSuperAdmin ? 1 : 0,
      input.mustChangePassword ? 1 : 0,
    ],
  );
}

export async function countAdminUsers() {
  await ensureAuthReady();
  const pool = getDbPool();
  const [rows] = await pool.execute<CountRow[]>(
    "SELECT COUNT(*) AS count FROM auth_users WHERE role = 'admin' AND is_active = 1",
  );
  return Number(rows[0]?.count ?? 0);
}

export async function countSuperAdminUsers() {
  await ensureAuthReady();
  const pool = getDbPool();
  const [rows] = await pool.execute<CountRow[]>(
    "SELECT COUNT(*) AS count FROM auth_users WHERE role = 'admin' AND is_active = 1 AND is_super_admin = 1",
  );
  return Number(rows[0]?.count ?? 0);
}

export async function listAdminUsers() {
  await ensureAuthReady();
  const pool = getDbPool();
  const [rows] = await pool.execute<AdminUserListRow[]>(
    `
      SELECT
        id,
        email,
        role,
        is_active,
        is_super_admin,
        must_change_password,
        last_login_at,
        created_at
      FROM auth_users
      WHERE role = 'admin'
      ORDER BY is_super_admin DESC, created_at DESC
    `,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    email: row.email,
    role: row.role,
    isActive: Boolean(row.is_active),
    isSuperAdmin: Boolean(row.is_super_admin),
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function updateAuthUserFailedLogin(input: {
  userId: number;
  failedAttempts: number;
  lockedUntilIso: string | null;
}) {
  await ensureAuthReady();
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `
      UPDATE auth_users
      SET failed_login_attempts = ?, locked_until = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [input.failedAttempts, input.lockedUntilIso, input.userId],
  );
}

export async function markAuthUserLoginSuccess(userId: number) {
  await ensureAuthReady();
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `
      UPDATE auth_users
      SET failed_login_attempts = 0,
          locked_until = NULL,
          last_login_at = NOW(),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [userId],
  );
}

export async function updateAuthUserPassword(input: {
  userId: number;
  passwordHash: string;
  mustChangePassword?: boolean;
}) {
  await ensureAuthReady();
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `
      UPDATE auth_users
      SET password_hash = ?,
          must_change_password = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [input.passwordHash, input.mustChangePassword ? 1 : 0, input.userId],
  );
}

export async function deleteAdminUserById(userId: number) {
  await ensureAuthReady();
  const pool = getDbPool();
  const [result] = await pool.execute<ResultSetHeader>(
    "DELETE FROM auth_users WHERE id = ? AND role = 'admin'",
    [userId],
  );
  return result.affectedRows > 0;
}

export async function recordLoginAttempt(input: {
  email: string | null;
  ipAddress: string;
  userAgent: string;
  wasSuccess: boolean;
  reason: string;
}) {
  try {
    await ensureAuthReady();
    const pool = getDbPool();
    await pool.execute<ResultSetHeader>(
      `
        INSERT INTO auth_login_attempts (
          email_normalized,
          ip_address,
          user_agent,
          was_success,
          reason
        ) VALUES (?, ?, ?, ?, ?)
      `,
      [
        input.email,
        input.ipAddress,
        input.userAgent,
        input.wasSuccess ? 1 : 0,
        input.reason.slice(0, 191),
      ],
    );
  } catch (error) {
    console.error("Failed to write auth login attempt.", {
      reason: input.reason,
      wasSuccess: input.wasSuccess,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function getRecentFailedLoginCounts(input: {
  ipAddress: string;
  email: string;
  sinceIso: string;
}) {
  await ensureAuthReady();
  const pool = getDbPool();
  const [rows] = await pool.execute<LoginAttemptCountRow[]>(
    `
      SELECT
        SUM(CASE WHEN ip_address = ? THEN 1 ELSE 0 END) AS ip_count,
        SUM(CASE WHEN email_normalized = ? THEN 1 ELSE 0 END) AS email_count
      FROM auth_login_attempts
      WHERE was_success = 0
        AND created_at >= ?
    `,
    [input.ipAddress, input.email, input.sinceIso],
  );

  return {
    ipCount: Number(rows[0]?.ip_count ?? 0),
    emailCount: Number(rows[0]?.email_count ?? 0),
  };
}

export async function createAuthSession(input: {
  sessionId: string;
  userId: number;
  rememberMe: boolean;
  ipAddress: string;
  userAgent: string;
  expiresAtIso: string;
}) {
  await ensureAuthReady();
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO auth_sessions (
        session_id,
        user_id,
        remember_me,
        ip_address,
        user_agent,
        issued_at,
        last_seen_at,
        expires_at
      ) VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?)
    `,
    [
      input.sessionId,
      input.userId,
      input.rememberMe ? 1 : 0,
      input.ipAddress,
      input.userAgent,
      input.expiresAtIso,
    ],
  );
}

export async function getAuthSessionWithUser(sessionId: string) {
  await ensureAuthReady();
  const pool = getDbPool();
  const [rows] = await pool.execute<AuthSessionWithUserRow[]>(
    `
      SELECT
        s.session_id,
        s.user_id,
        s.expires_at,
        s.revoked_at,
        s.ip_address,
        s.user_agent,
        s.remember_me,
        s.last_seen_at,
        u.id AS auth_user_id,
        u.email,
        u.role,
        u.is_active,
        u.is_super_admin,
        u.must_change_password,
        u.password_hash,
        u.failed_login_attempts,
        u.locked_until,
        u.last_login_at
      FROM auth_sessions s
      INNER JOIN auth_users u ON u.id = s.user_id
      WHERE s.session_id = ?
      LIMIT 1
    `,
    [sessionId],
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  const session: AuthSessionRecord = mapSessionRow(row);
  const user: AuthUserRecord = mapUserRow({
    ...row,
    id: Number(row.auth_user_id),
  });

  return { session, user } satisfies AuthSessionWithUser;
}

export async function touchAuthSession(sessionId: string) {
  await ensureAuthReady();
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    "UPDATE auth_sessions SET last_seen_at = NOW() WHERE session_id = ?",
    [sessionId],
  );
}

export async function revokeAuthSession(sessionId: string, reason: string) {
  await ensureAuthReady();
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `
      UPDATE auth_sessions
      SET revoked_at = IFNULL(revoked_at, NOW()),
          revoke_reason = IFNULL(revoke_reason, ?),
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `,
    [reason.slice(0, 191), sessionId],
  );
}

export async function cleanupExpiredAuthSessions() {
  await ensureAuthReady();
  const pool = getDbPool();
  await pool.execute<ResultSetHeader>(
    `
      DELETE FROM auth_sessions
      WHERE expires_at < NOW()
         OR (revoked_at IS NOT NULL AND revoked_at < (NOW() - INTERVAL 30 DAY))
    `,
  );
}

export async function cleanupAuthLogs() {
  await ensureAuthReady();
  const pool = getDbPool();

  const [loginAttemptsResult] = await pool.execute<ResultSetHeader>(
    `
      DELETE FROM auth_login_attempts
      WHERE created_at < (NOW() - INTERVAL ? DAY)
    `,
    [LOGIN_ATTEMPTS_RETENTION_DAYS],
  );

  const [securityEventsResult] = await pool.execute<ResultSetHeader>(
    `
      DELETE FROM security_events
      WHERE created_at < (NOW() - INTERVAL ? DAY)
    `,
    [SECURITY_EVENTS_RETENTION_DAYS],
  );

  const [adminAuditResult] = await pool.execute<ResultSetHeader>(
    `
      DELETE FROM admin_audit_logs
      WHERE created_at < (NOW() - INTERVAL ? DAY)
    `,
    [ADMIN_AUDIT_RETENTION_DAYS],
  );

  return {
    loginAttemptsDeleted: Number(loginAttemptsResult.affectedRows ?? 0),
    securityEventsDeleted: Number(securityEventsResult.affectedRows ?? 0),
    adminAuditDeleted: Number(adminAuditResult.affectedRows ?? 0),
  };
}

export async function logSecurityEvent(input: {
  userId?: number | null;
  eventType: string;
  severity: SecurityEventSeverity;
  path?: string | null;
  method?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
}) {
  try {
    await ensureAuthReady();
    const pool = getDbPool();
    await pool.execute<ResultSetHeader>(
      `
        INSERT INTO security_events (
          user_id,
          event_type,
          severity,
          path,
          method,
          ip_address,
          user_agent,
          details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.userId ?? null,
        input.eventType.slice(0, 64),
        input.severity,
        input.path?.slice(0, 255) ?? null,
        input.method?.slice(0, 16) ?? null,
        input.ipAddress?.slice(0, 64) ?? null,
        input.userAgent?.slice(0, 512) ?? null,
        input.details ? JSON.stringify(input.details) : null,
      ],
    );
  } catch (error) {
    console.error("Failed to write security event.", {
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function logAdminAudit(input: {
  adminUserId: number;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  path?: string | null;
  method?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
}) {
  try {
    await ensureAuthReady();
    const pool = getDbPool();
    await pool.execute<ResultSetHeader>(
      `
        INSERT INTO admin_audit_logs (
          admin_user_id,
          action,
          resource_type,
          resource_id,
          path,
          method,
          ip_address,
          user_agent,
          details_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.adminUserId,
        input.action.slice(0, 64),
        input.resourceType.slice(0, 64),
        input.resourceId?.slice(0, 191) ?? null,
        input.path?.slice(0, 255) ?? null,
        input.method?.slice(0, 16) ?? null,
        input.ipAddress?.slice(0, 64) ?? null,
        input.userAgent?.slice(0, 512) ?? null,
        input.details ? JSON.stringify(input.details) : null,
      ],
    );
  } catch (error) {
    console.error("Failed to write admin audit log.", {
      action: input.action,
      resourceType: input.resourceType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
