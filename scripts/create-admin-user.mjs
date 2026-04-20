import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { Pool as PgPool } from "pg";

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function loadEnvFiles() {
  const envFiles = [".env", ".env.local"];
  for (const fileName of envFiles) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const content = fs.readFileSync(filePath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const index = line.indexOf("=");
      if (index <= 0) {
        continue;
      }
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

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
  loadEnvFiles();
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

  const connectionString =
    process.env.DATABASE_URL_UNPOOLED?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "";
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing. Configure Neon first.");
  }

  const pool = new PgPool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 20_000,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id BIGSERIAL PRIMARY KEY,
      email VARCHAR(191) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(16) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
      is_active SMALLINT NOT NULL DEFAULT 1,
      is_super_admin SMALLINT NOT NULL DEFAULT 0,
      must_change_password SMALLINT NOT NULL DEFAULT 0,
      failed_login_attempts INT NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ NULL,
      last_login_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(
    "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS is_super_admin SMALLINT NOT NULL DEFAULT 0",
  );
  await pool.query(
    "ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS must_change_password SMALLINT NOT NULL DEFAULT 0",
  );

  const passwordHash = await hashPassword(password);
  await pool.query(
    `
      INSERT INTO auth_users (
        email,
        password_hash,
        role,
        is_active,
        is_super_admin,
        must_change_password
      )
      VALUES ($1, $2, $3, 1, $4, 0)
      ON CONFLICT (email) DO UPDATE
      SET
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        is_active = 1,
        is_super_admin = EXCLUDED.is_super_admin,
        must_change_password = 0,
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = CURRENT_TIMESTAMP
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
