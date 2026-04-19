import mysql from "mysql2/promise";

async function main() {
  const database = process.env.DB_NAME ?? "caf";
  const pool = mysql.createPool({
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
    charset: "utf8mb4",
  });

  const [rows] = await pool.execute(
    `
      SELECT
        table_schema AS db_name,
        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb
      FROM information_schema.tables
      WHERE table_schema = ?
      GROUP BY table_schema
    `,
    [database],
  );

  const [tableRows] = await pool.execute(
    `
      SELECT
        table_name,
        ROUND((data_length + index_length) / 1024 / 1024, 2) AS size_mb
      FROM information_schema.tables
      WHERE table_schema = ?
      ORDER BY (data_length + index_length) DESC
    `,
    [database],
  );

  const totalMb = Number(rows?.[0]?.size_mb ?? 0);
  const totalGb = totalMb / 1024;

  console.log(`DB: ${database}`);
  console.log(`TOTAL_MB: ${totalMb.toFixed(2)}`);
  console.log(`TOTAL_GB: ${totalGb.toFixed(4)}`);
  console.log("TABLES_MB:");
  for (const row of tableRows) {
    console.log(`${row.table_name}: ${Number(row.size_mb ?? 0).toFixed(2)}`);
  }

  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

