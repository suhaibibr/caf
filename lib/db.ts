import mysql from "mysql2/promise";

declare global {
  var __cafMysqlPool: mysql.Pool | undefined;
}

export function getDbPool() {
  if (!global.__cafMysqlPool) {
    global.__cafMysqlPool = mysql.createPool({
      host: process.env.DB_HOST ?? "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3306),
      user: process.env.DB_USER ?? "root",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME ?? "caf",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: "utf8mb4",
    });
  }

  return global.__cafMysqlPool;
}
