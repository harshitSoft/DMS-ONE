const { Op, fn, col } = require("sequelize");
const asyncHandler = require("../utils/asyncHandler");
const {
  sequelize, Company, Dealer, User, Product, CompanyInventory, ProductVariant,
  DealerInventory, DealerSale, DealerStockTransferRequest, DealerStockTransferLog,
  Order, Payment, Policy, Message, Report, DealerCreditWallet,
  DealerCreditTransaction, CreditReward, CreditRedemption,
  AdminInternalMessage, DealerInternalMessage, AdminPinnedMessage,
  InternalNotification, OrderScheduledMessage
} = require("../models");

const adminRoles = ["ADMIN_CEO", "ADMIN"];
const editableCompanyFields = ["companyName", "category", "description", "phone", "address", "city", "state", "pincode", "startDate", "endDate", "status"];
const activeStatuses = ["active"];
const dependencyModels = [
  Dealer, Product, CompanyInventory, ProductVariant, DealerInventory, DealerSale,
  DealerStockTransferRequest, DealerStockTransferLog, Order, Payment, Policy,
  Message, Report, DealerCreditWallet, DealerCreditTransaction, CreditReward,
  CreditRedemption, AdminInternalMessage, DealerInternalMessage, AdminPinnedMessage,
  InternalNotification, OrderScheduledMessage
];

function pick(source, fields) {
  return fields.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(source, field)) result[field] = source[field] === "" ? null : source[field];
    return result;
  }, {});
}

function normalizeStatus(status) {
  if (["active", "inactive"].includes(status)) return status;
  if (["blocked", "expired", "pending", "rejected", "deleted"].includes(status)) return status;
  return "active";
}

function organizationValidation(body, { requireFields = false } = {}) {
  const errors = [];
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  ["phone", "adminPhone"].forEach((field) => {
    if (body[field] != null && body[field] !== "" && !/^\d{7,10}$/.test(String(body[field]).trim())) errors.push(`${field === "phone" ? "Organization" : "Admin CEO"} phone must contain 7 to 10 digits`);
  });
  if (body.startDate && body.startDate < today) errors.push("Start date cannot be in the past");
  if (body.endDate && body.endDate < today) errors.push("End date cannot be in the past");
  if (body.startDate && body.endDate && body.endDate < body.startDate) errors.push("End date must be on or after the start date");
  if (requireFields && !body.startDate) errors.push("Start date is required");
  return errors[0];
}

async function adminFor(companyId, options = {}) {
  return User.findOne({
    where: { companyId, role: { [Op.in]: adminRoles } },
    attributes: ["id", "name", "email", "phone", "status", "createdAt", "updatedAt"],
    transaction: options.transaction
  });
}

async function serializeOrganizations(companies) {
  const ids = companies.map((company) => company.id);
  if (!ids.length) return [];
  const [admins, dealerCounts] = await Promise.all([
    User.findAll({ where: { companyId: { [Op.in]: ids }, role: { [Op.in]: adminRoles } }, attributes: ["id", "companyId", "name", "email", "phone", "status", "createdAt", "updatedAt"] }),
    Dealer.findAll({ where: { companyId: { [Op.in]: ids } }, attributes: ["companyId", [fn("COUNT", col("id")), "count"]], group: ["companyId"] })
  ]);
  const adminMap = Object.fromEntries(admins.map((admin) => [admin.companyId, admin]));
  const dealerMap = Object.fromEntries(dealerCounts.map((row) => [row.companyId, Number(row.get("count") || 0)]));
  return companies.map((company) => {
    const value = company.toJSON();
    const admin = adminMap[company.id];
    return {
      ...value,
      admin: admin || null,
      adminName: admin?.name || value.adminName,
      adminEmail: admin?.email || value.adminEmail,
      adminPhone: admin?.phone || value.adminPhone,
      totalDealers: dealerMap[company.id] || 0
    };
  });
}

exports.dashboard = asyncHandler(async (req, res) => {
  const visible = { status: { [Op.ne]: "deleted" } };
  const [companies, totalDealers, categoryRows, dealerRows] = await Promise.all([
    Company.findAll({ where: visible, order: [["createdAt", "DESC"]] }),
    Dealer.count(),
    Company.findAll({ where: visible, attributes: ["category", [fn("COUNT", col("id")), "count"]], group: ["category"] }),
    Dealer.findAll({ attributes: ["companyId", [fn("COUNT", col("id")), "count"]], group: ["companyId"] })
  ]);
  const organizationsByMonthMap = companies.reduce((acc, company) => {
    const createdAt = company.createdAt ? new Date(company.createdAt) : null;
    const month = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString().slice(0, 7) : "Unknown";
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});
  const totalAdminCeos = await User.count({ where: { role: { [Op.in]: adminRoles }, companyId: { [Op.in]: companies.map((company) => company.id) } } });
  const organizations = await serializeOrganizations(companies);
  const dealerMap = Object.fromEntries(dealerRows.map((row) => [row.companyId, Number(row.get("count") || 0)]));
  res.json({
    totalOrganizations: companies.length,
    activeOrganizations: companies.filter((company) => activeStatuses.includes(company.status)).length,
    inactiveOrganizations: companies.filter((company) => !activeStatuses.includes(company.status)).length,
    totalAdminCeos,
    totalDealers,
    organizationsByMonth: Object.entries(organizationsByMonthMap).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count })),
    statusDistribution: [
      { status: "Active", count: companies.filter((company) => activeStatuses.includes(company.status)).length },
      { status: "Inactive", count: companies.filter((company) => !activeStatuses.includes(company.status)).length }
    ],
    categoryDistribution: categoryRows.map((row) => ({ category: row.category || "Uncategorized", count: Number(row.get("count") || 0) })),
    dealersByOrganization: companies.map((company) => ({ organization: company.companyName, count: dealerMap[company.id] || 0 })),
    recentOrganizations: organizations.slice(0, 8)
  });
});

exports.createOrganization = asyncHandler(async (req, res) => {
  const body = req.body;
  const required = ["companyName", "category", "phone", "startDate", "adminName", "adminEmail", "adminPhone", "password"];
  const missing = required.filter((field) => !String(body[field] || "").trim());
  if (missing.length) return res.status(400).json({ message: `Required fields: ${missing.join(", ")}` });
  if (body.confirmPassword != null && body.password !== body.confirmPassword) return res.status(400).json({ message: "Passwords do not match" });
  if (String(body.password).length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
  const validationError = organizationValidation(body, { requireFields: true });
  if (validationError) return res.status(400).json({ message: validationError });
  const email = String(body.adminEmail).trim().toLowerCase();
  if (await User.findOne({ where: { email } })) return res.status(409).json({ message: "A user with this email already exists" });

  const result = await sequelize.transaction(async (transaction) => {
    const companyValues = pick(body, editableCompanyFields);
    companyValues.status = normalizeStatus(companyValues.status);
    Object.assign(companyValues, { adminName: body.adminName.trim(), adminEmail: email, adminPhone: body.adminPhone.trim() });
    const company = await Company.create(companyValues, { transaction });
    const admin = await User.create({
      name: body.adminName.trim(), email, phone: body.adminPhone.trim(), password: body.password,
      role: "ADMIN_CEO", companyId: company.id, status: "active"
    }, { transaction });
    return { company, admin: { id: admin.id, name: admin.name, email: admin.email, phone: admin.phone, status: admin.status } };
  });
  res.status(201).json(result);
});

exports.listOrganizations = asyncHandler(async (req, res) => {
  const where = { status: { [Op.ne]: "deleted" } };
  if (req.query.category) where.category = req.query.category;
  if (req.query.status) where.status = req.query.status;
  if (req.query.search) where[Op.or] = [
    { companyName: { [Op.like]: `%${req.query.search}%` } },
    { category: { [Op.like]: `%${req.query.search}%` } },
    { adminName: { [Op.like]: `%${req.query.search}%` } },
    { adminEmail: { [Op.like]: `%${req.query.search}%` } }
  ];
  const companies = await Company.findAll({ where, order: [["createdAt", "DESC"]] });
  res.json(await serializeOrganizations(companies));
});

exports.getOrganization = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company || company.status === "deleted") return res.status(404).json({ message: "Organization not found" });
  const [organization] = await serializeOrganizations([company]);
  res.json(organization);
});

exports.updateOrganization = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company || company.status === "deleted") return res.status(404).json({ message: "Organization not found" });
  let validationError = organizationValidation(req.body);
  if (!validationError && (Object.prototype.hasOwnProperty.call(req.body, "startDate") || Object.prototype.hasOwnProperty.call(req.body, "endDate"))) {
    const nextStart = req.body.startDate || company.startDate;
    const nextEnd = req.body.endDate || company.endDate;
    if (nextStart && nextEnd && nextEnd < nextStart) validationError = "End date must be on or after the start date";
  }
  if (validationError) return res.status(400).json({ message: validationError });
  const updates = pick(req.body, editableCompanyFields);
  if (updates.status) updates.status = normalizeStatus(updates.status);
  const admin = await adminFor(company.id);
  const adminUpdates = {};
  if (req.body.adminName != null) adminUpdates.name = String(req.body.adminName).trim();
  if (req.body.adminPhone != null) adminUpdates.phone = String(req.body.adminPhone).trim();
  if (req.body.adminEmail != null) {
    const email = String(req.body.adminEmail).trim().toLowerCase();
    const duplicate = await User.findOne({ where: { email, id: { [Op.ne]: admin?.id || 0 } } });
    if (duplicate) return res.status(409).json({ message: "A user with this email already exists" });
    adminUpdates.email = email;
  }
  await sequelize.transaction(async (transaction) => {
    if (adminUpdates.name) updates.adminName = adminUpdates.name;
    if (adminUpdates.email) updates.adminEmail = adminUpdates.email;
    if (Object.prototype.hasOwnProperty.call(adminUpdates, "phone")) updates.adminPhone = adminUpdates.phone;
    await company.update(updates, { transaction });
    if (admin && Object.keys(adminUpdates).length) await admin.update(adminUpdates, { transaction });
  });
  const [organization] = await serializeOrganizations([await Company.findByPk(company.id)]);
  res.json(organization);
});

exports.setOrganizationStatus = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company || company.status === "deleted") return res.status(404).json({ message: "Organization not found" });
  const status = normalizeStatus(req.body.status);
  if (!["active", "inactive"].includes(status)) return res.status(400).json({ message: "Status must be active or inactive" });
  await company.update({ status });
  const [organization] = await serializeOrganizations([company]);
  res.json(organization);
});

exports.deleteOrganization = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company || company.status === "deleted") return res.status(404).json({ message: "Organization not found" });
  const counts = await Promise.all(dependencyModels.map((model) => model.count({ where: { companyId: company.id } }).catch(() => 0)));
  await company.update({ status: "deleted" });
  res.json({ message: "Organization safely archived and access disabled", softDeleted: true, dependentRecords: counts.reduce((sum, count) => sum + count, 0) });
});
