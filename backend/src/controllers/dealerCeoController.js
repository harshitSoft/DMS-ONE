const { Op } = require("sequelize");
const asyncHandler = require("../utils/asyncHandler");
const { hardDeleteUser } = require("../utils/userCleanup");
const { User } = require("../models");
const { hasDealerManagers } = require("../utils/managerAssignment");

const dealerManagerRoles = ["DEALER_STOCK_INVENTORY_MANAGER", "DEALER_STOCK_DELIVERY_MANAGER", "DEALER_SALES_FINANCE_MANAGER"];
const assignableDealerManagerRoles = ["DEALER_STOCK_DELIVERY_MANAGER", "DEALER_SALES_FINANCE_MANAGER"];

function managerScope(req) {
  return { companyId: req.user.companyId, dealerId: req.user.dealerId, role: dealerManagerRoles };
}

exports.listManagers = asyncHandler(async (req, res) => {
  res.json(await User.findAll({
    where: managerScope(req),
    attributes: ["id", "name", "email", "phone", "role", "status", "createdAt"],
    order: [["createdAt", "DESC"]]
  }));
});

exports.managerExists = asyncHandler(async (req, res) => {
  res.json({ exists: await hasDealerManagers(req.user.dealerId) });
});

exports.createManager = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ message: "Name, email, password and role are required" });
  if (String(password).length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
  if (!assignableDealerManagerRoles.includes(role)) return res.status(400).json({ message: "Invalid dealer manager role" });
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await User.findOne({ where: { email: normalizedEmail } });
  if (existing) return res.status(400).json({ message: "Email already exists" });
  const user = await User.create({
    name,
    email: normalizedEmail,
    phone: phone || null,
    password,
    role,
    status: "active",
    companyId: req.user.companyId,
    dealerId: req.user.dealerId
  });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status });
});

exports.updateManager = asyncHandler(async (req, res) => {
  const manager = await User.findOne({ where: { id: req.params.id, ...managerScope(req) } });
  if (!manager) return res.status(404).json({ message: "Manager not found" });
  const updates = {};
  ["name", "phone", "status"].forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });
  if (req.body.role) {
    if (!assignableDealerManagerRoles.includes(req.body.role)) return res.status(400).json({ message: "Invalid dealer manager role" });
    updates.role = req.body.role;
  }
  if (req.body.email && req.body.email !== manager.email) {
    const normalizedEmail = String(req.body.email).trim().toLowerCase();
    const existing = await User.findOne({ where: { email: normalizedEmail, id: { [Op.ne]: manager.id } } });
    if (existing) return res.status(400).json({ message: "Email already exists" });
    updates.email = normalizedEmail;
  }
  if (req.body.password) updates.password = req.body.password;
  await manager.update(updates);
  res.json({ id: manager.id, name: manager.name, email: manager.email, phone: manager.phone, role: manager.role, status: manager.status });
});

exports.updateManagerStatus = asyncHandler(async (req, res) => {
  const manager = await User.findOne({ where: { id: req.params.id, ...managerScope(req) } });
  if (!manager) return res.status(404).json({ message: "Manager not found" });
  const nextStatus = ["active", "inactive"].includes(req.body.status) ? req.body.status : (manager.status === "active" ? "inactive" : "active");
  await manager.update({ status: nextStatus });
  res.json({ id: manager.id, status: manager.status });
});

exports.deleteManager = asyncHandler(async (req, res) => {
  const manager = await User.findOne({ where: { id: req.params.id, ...managerScope(req) } });
  if (!manager) return res.status(404).json({ message: "Manager not found" });
  await hardDeleteUser(manager.id);
  await manager.destroy();
  res.json({ message: "Manager deleted" });
});
