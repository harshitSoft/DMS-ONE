const mysql = require("mysql2/promise");

async function ensureDatabase() {
  if (process.env.DB_DIALECT === "postgres" || process.env.DATABASE_URL) return;

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "Ram1234"
  });

  const dbName = process.env.DB_NAME || "dms_db";
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await connection.end();
}

module.exports = ensureDatabase;
