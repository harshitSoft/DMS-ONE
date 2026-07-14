const bcrypt = require("bcryptjs");
const { User } = require("../models");

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "harshit.nigam@itsoftlab.com";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "harshit123";
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || "Harshit Nigam";

async function ensureSuperAdminAccount({ resetPassword = false } = {}) {
  const existing = await User.findOne({ where: { email: SUPER_ADMIN_EMAIL } });
  const basePayload = {
    name: SUPER_ADMIN_NAME,
    email: SUPER_ADMIN_EMAIL,
    role: "SUPER_ADMIN",
    status: "active",
    companyId: null,
    dealerId: null
  };

  if (existing) {
    const updatePayload = { ...basePayload };
    if (resetPassword) updatePayload.password = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
    await existing.update(updatePayload, { hooks: false });
    return { created: false, email: SUPER_ADMIN_EMAIL, passwordReset: resetPassword };
  }

  await User.create({
    ...basePayload,
    password: await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12)
  }, { hooks: false });

  return { created: true, email: SUPER_ADMIN_EMAIL, passwordReset: true };
}

module.exports = {
  ensureSuperAdminAccount,
  SUPER_ADMIN_EMAIL
};
