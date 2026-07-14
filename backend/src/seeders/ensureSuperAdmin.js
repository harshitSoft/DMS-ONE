require("dotenv").config();
const ensureDatabase = require("../utils/ensureDatabase");
const { sequelize } = require("../models");
const { ensureSuperAdminAccount, SUPER_ADMIN_EMAIL } = require("../utils/ensureSuperAdminAccount");

const run = async () => {
  await ensureDatabase();
  await sequelize.authenticate();
  await sequelize.sync();

  const result = await ensureSuperAdminAccount({ resetPassword: true });
  console.log(result.created ? "Super Admin created." : "Super Admin already existed. Role, active status, and password were refreshed.");
  console.log(`Super Admin Login Email: ${SUPER_ADMIN_EMAIL}`);

  await sequelize.close();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
