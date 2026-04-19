import mysql from "mysql2/promise";

async function main() {
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

