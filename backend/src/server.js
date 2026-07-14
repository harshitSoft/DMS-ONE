require("dotenv").config();
const app = require("./app");
const { sequelize } = require("./models");
const ensureDatabase = require("./utils/ensureDatabase");
const migrateMissingColumns = require("./utils/migrateMissingColumns");
const { ensureSuperAdminAccount } = require("./utils/ensureSuperAdminAccount");
const { startScheduledMessagesJob } = require("./jobs/scheduledMessagesJob");

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await ensureDatabase();
    await sequelize.authenticate();
    await sequelize.sync();
    await migrateMissingColumns();
    await ensureSuperAdminAccount();
    startScheduledMessagesJob();
    app.listen(PORT, () => console.log(`DMS API running on port ${PORT}`));
  } catch (error) {
    console.error("Unable to start server", error);
    process.exit(1);
  }
})();
