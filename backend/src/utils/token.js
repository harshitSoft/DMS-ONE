const jwt = require("jsonwebtoken");

const signToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role, companyId: user.companyId, dealerId: user.dealerId },
    process.env.JWT_SECRET || "dms_super_secret_key",
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

module.exports = { signToken };
