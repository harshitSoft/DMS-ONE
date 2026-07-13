require("dotenv").config();
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

const SUPER_ADMIN = {
  name: "Harshit Nigam",
  email: "harshit.nigam@itsoftlab.com",
  password: "harshit123",
  role: "SUPER_ADMIN_CEO",
  status: "active"
};

async function fixSuperAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "Ram1234",
    database: process.env.DB_NAME || "dms_db",
    port: Number(process.env.DB_PORT || 3306)
  });

  try {
    await connection.query("ALTER TABLE `Users` MODIFY `role` ENUM('SUPER_ADMIN','SUPER_ADMIN_CEO','SUPER_ADMIN_IT_MANAGER','SUPER_ADMIN_SALES_MANAGER','SUPER_ADMIN_FINANCE_MANAGER','ADMIN','ADMIN_CEO','DEALER_MANAGER','PRODUCT_DELIVERY_MANAGER','FINANCE_MANAGER','DEALER') NOT NULL");
    const passwordHash = await bcrypt.hash(SUPER_ADMIN.password, 12);
    const [rows] = await connection.execute(
      "SELECT id FROM `Users` WHERE LOWER(email) = LOWER(?) LIMIT 1",
      [SUPER_ADMIN.email]
    );
    const now = new Date();

    if (rows.length) {
      await connection.execute(
        "UPDATE `Users` SET name = ?, email = ?, password = ?, role = ?, status = ?, companyId = NULL, dealerId = NULL, updatedAt = ? WHERE id = ?",
        [SUPER_ADMIN.name, SUPER_ADMIN.email, passwordHash, SUPER_ADMIN.role, SUPER_ADMIN.status, now, rows[0].id]
      );
    } else {
      await connection.execute(
        "INSERT INTO `Users` (name, email, password, role, status, companyId, dealerId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?)",
        [SUPER_ADMIN.name, SUPER_ADMIN.email, passwordHash, SUPER_ADMIN.role, SUPER_ADMIN.status, now, now]
      );
    }

    console.log("Super Admin fixed successfully");
  } finally {
    await connection.end();
  }
}

fixSuperAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
