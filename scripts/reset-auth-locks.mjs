import mysql from "mysql2/promise";

function isSslEnabled() {
  const mode = (process.env.DB_SSL_MODE ?? "").trim().toUpperCase();
  return mode !== "" && mode !== "DISABLED" && mode !== "OFF" && mode !== "NONE";
}

function shouldRejectUnauthorizedByDefault() {
  const mode = (process.env.DB_SSL_MODE ?? "").trim().toUpperCase();
  return mode === "VERIFY_CA" || mode === "VERIFY_IDENTITY";
}

function parseBooleanEnv(value) {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function getSslConfig() {
  if (!isSslEnabled()) {
    return undefined;
  }

  const explicitRejectUnauthorized = parseBooleanEnv(
    process.env.DB_SSL_REJECT_UNAUTHORIZED,
  );
  const rejectUnauthorized =
    explicitRejectUnauthorized ?? shouldRejectUnauthorizedByDefault();
  const ca = process.env.DB_SSL_CA?.replace(/\\n/g, "\n");

  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {}),
    minVersion: "TLSv1.2",
  };
}

async function main() {
  const ssl = getSslConfig();
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
    ...(ssl ? { ssl } : {}),
  });

  await pool.execute(
    "UPDATE auth_users SET failed_login_attempts = 0, locked_until = NULL",
  );
  await pool.execute(
    "DELETE FROM auth_login_attempts WHERE created_at >= (NOW() - INTERVAL 1 DAY)",
  );

  const [rows] = await pool.query(
    "SELECT COUNT(*) AS count FROM auth_login_attempts",
  );
  const remaining = Number(rows[0]?.count ?? 0);
  console.log(`Auth locks reset done. Remaining attempts rows: ${remaining}`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
