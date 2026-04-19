import crypto from "node:crypto";
import { promisify } from "node:util";
import mysql from "mysql2/promise";

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function getArg(name) {
  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index === -1) {
    return "";
  }
  return process.argv[index + 1] ?? "";
}

function toBase64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    "scrypt",
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    toBase64Url(salt),
    toBase64Url(hash),
  ].join("$");
}

async function main() {
  const email = getArg("email").trim().toLowerCase();
  const password = getArg("password");
  const roleInput = getArg("role").trim().toLowerCase();
  const role = roleInput === "user" ? "user" : "admin";
  const isSuperAdmin = getArg("super").trim() === "1";

  if (!email || !password) {
    console.error(
      "Usage: node scripts/create-admin-user.mjs --email admin@example.com --password \"StrongPass123!\" [--role admin|user] [--super 1]",
    );
    process.exit(1);
  }

  const pool = mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "caf",
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
    charset: "utf8mb4",
  });

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

  await pool.execute(
    "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS is_super_admin TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active",
  );
  await pool.execute(
    "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER is_super_admin",
  );

  const passwordHash = await hashPassword(password);
  await pool.execute(
    `
      INSERT INTO auth_users (
        email,
        password_hash,
        role,
        is_active,
        is_super_admin,
        must_change_password
      )
      VALUES (?, ?, ?, 1, ?, 0)
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        role = VALUES(role),
        is_active = 1,
        is_super_admin = VALUES(is_super_admin),
        must_change_password = 0,
        failed_login_attempts = 0,
        locked_until = NULL
    `,
    [email, passwordHash, role, isSuperAdmin ? 1 : 0],
  );

  await pool.end();
  console.log(
    `User upserted successfully: ${email} (role=${role}, super=${isSuperAdmin ? "yes" : "no"})`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
