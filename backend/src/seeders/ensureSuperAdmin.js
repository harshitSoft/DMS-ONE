require("dotenv").config();
const bcrypt = require("bcryptjs");
const ensureDatabase = require("../utils/ensureDatabase");
const { sequelize, User } = require("../models");

const SUPER_ADMIN_EMAIL = "harshit.nigam@itsoftlab.com";
const SUPER_ADMIN_PASSWORD = "harshit123";
const SUPER_ADMIN_NAME = "Harshit Nigam";

const ensureSuperAdmin = async () => {
  await ensureDatabase();
  await sequelize.authenticate();
  await sequelize.sync();

  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
  const existing = await User.findOne({ where: { email: SUPER_ADMIN_EMAIL } });

  if (existing) {
    await existing.update({
      name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL,
      password: passwordHash,
      role: "SUPER_ADMIN_CEO",
      status: "active",
      companyId: null,
      dealerId: null
    }, { hooks: false });
    console.log("Super Admin already existed. Email, password, and active status were refreshed safely.");
  } else {
    await User.create({
      name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL,
      password: passwordHash,
      role: "SUPER_ADMIN_CEO",
      status: "active"
    }, { hooks: false });
    console.log("Super Admin created.");
  }

  console.log(`Super Admin Login: ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`);
  await sequelize.close();
};

ensureSuperAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
