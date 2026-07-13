const { Op, fn, col } = require("sequelize");
const asyncHandler = require("../utils/asyncHandler");
const {
  sequelize,
  Company,
  CompanyLicense,
  Dealer,
  LicenseInventory,
  LicensePlan,
  LicensePurchaseRequest,
  InternalNotification,
  Message,
  Payment,
  SuperAdminChat,
  SuperAdminPinnedMessage,
  SuperAdminTarget,
  User
} = require("../models");
const { licenseOverview } = require("../utils/licenseService");

const managerRoles = ["SUPER_ADMIN_IT_MANAGER", "SUPER_ADMIN_SALES_MANAGER", "SUPER_ADMIN_FINANCE_MANAGER"];
const requestInclude = [
  { model: Company, attributes: ["id", "companyName", "category", "status"] },
  { model: LicensePlan, attributes: ["id", "name", "dealerLimit", "price"] },
  { model: User, as: "requester", attributes: ["id", "name", "email", "role"] },
  { model: User, as: "salesApprover", attributes: ["id", "name", "email", "role"] },
  { model: User, as: "financeVerifier", attributes: ["id", "name", "email", "role"] }
];

function requireManagerRole(role) {
  if (!managerRoles.includes(role)) {
    const error = new Error("Invalid manager role");
    error.status = 400;
    throw error;
  }
}

async function requestRows(where = {}) {
  const rows = await LicensePurchaseRequest.findAll({ where, include: requestInclude, order: [["createdAt", "DESC"]] });
  const dealerCounts = await Dealer.findAll({ attributes: ["companyId", [fn("COUNT", col("id")), "count"]], group: ["companyId"] });
  const counts = Object.fromEntries(dealerCounts.map((row) => [row.companyId, Number(row.get("count") || 0)]));
  const capacities = await CompanyLicense.findAll({ attributes: ["companyId", [fn("SUM", col("dealerLimitAdded")), "capacity"]], where: { status: "active" }, group: ["companyId"] });
  const capacityMap = Object.fromEntries(capacities.map((row) => [row.companyId, Number(row.get("capacity") || 0)]));
  return rows.map((row) => ({
    ...row.toJSON(),
    currentDealerCount: counts[row.companyId] || 0,
    currentLicenseCapacity: capacityMap[row.companyId] || 0
  }));
}

async function companyRows() {
  const [companies, dealerCounts, capacities, admins, salesManagers, financeManagers, cityRows, activeRows, blockedRows, plans, licenses] = await Promise.all([
    Company.findAll({ order: [["createdAt", "DESC"]] }),
    Dealer.findAll({ attributes: ["companyId", [fn("COUNT", col("id")), "count"]], group: ["companyId"] }),
    CompanyLicense.findAll({ attributes: ["companyId", [fn("SUM", col("dealerLimitAdded")), "capacity"], [fn("SUM", col("quantity")), "licenses"]], where: { status: "active" }, group: ["companyId"] }),
    User.findAll({ where: { role: ["ADMIN", "ADMIN_CEO"] }, attributes: ["id", "companyId", "name", "email", "status"] }),
    User.findAll({ where: { role: "SUPER_ADMIN_SALES_MANAGER" }, attributes: ["id", "name", "email"] }),
    User.findAll({ where: { role: "SUPER_ADMIN_FINANCE_MANAGER" }, attributes: ["id", "name", "email"] }),
    Dealer.findAll({ attributes: ["companyId", "city", "area", [fn("COUNT", col("id")), "count"]], group: ["companyId", "city", "area"] }),
    Dealer.findAll({ attributes: ["companyId", [fn("COUNT", col("id")), "count"]], where: { status: "active" }, group: ["companyId"] }),
    Dealer.findAll({ attributes: ["companyId", [fn("COUNT", col("id")), "count"]], where: { status: "blocked" }, group: ["companyId"] }),
    LicensePlan.findAll(),
    CompanyLicense.findAll({ where: { status: "active" }, include: [LicensePlan] })
  ]);
  const countMap = Object.fromEntries(dealerCounts.map((row) => [row.companyId, Number(row.get("count") || 0)]));
  const capacityMap = Object.fromEntries(capacities.map((row) => [row.companyId, { capacity: Number(row.get("capacity") || 0), licenses: Number(row.get("licenses") || 0) }]));
  const adminMap = Object.fromEntries(admins.map((admin) => [admin.companyId, admin]));
  const salesMap = Object.fromEntries(salesManagers.map((user) => [user.id, user]));
  const financeMap = Object.fromEntries(financeManagers.map((user) => [user.id, user]));
  const activeMap = Object.fromEntries(activeRows.map((row) => [row.companyId, Number(row.get("count") || 0)]));
  const blockedMap = Object.fromEntries(blockedRows.map((row) => [row.companyId, Number(row.get("count") || 0)]));
  const planMap = Object.fromEntries(plans.map((plan) => [plan.id, plan]));
  const licenseMap = licenses.reduce((acc, license) => {
    acc[license.companyId] = acc[license.companyId] || [];
    acc[license.companyId].push(license);
    return acc;
  }, {});
  const cityMap = cityRows.reduce((acc, row) => {
    acc[row.companyId] = acc[row.companyId] || [];
    const label = [row.city, row.area].filter(Boolean).join(" / ") || "Unspecified";
    acc[row.companyId].push(`${label}: ${Number(row.get("count") || 0)}`);
    return acc;
  }, {});
  return companies.map((company) => {
    const used = countMap[company.id] || 0;
    const license = capacityMap[company.id] || { capacity: 0, licenses: 0 };
    const admin = adminMap[company.id];
    const selectedPlan = planMap[company.selectedLicensePlanId];
    const activeLicenses = licenseMap[company.id] || [];
    const daysRemaining = company.endDate ? Math.ceil((new Date(`${company.endDate}T23:59:59`).getTime() - Date.now()) / 86400000) : null;
    return {
      ...company.toJSON(),
      adminCeoName: admin?.name || company.adminName,
      adminCeoEmail: admin?.email || company.adminEmail,
      adminStatus: admin?.status,
      totalDealers: used,
      activeDealers: activeMap[company.id] || 0,
      blockedDealers: blockedMap[company.id] || 0,
      areaSummary: cityMap[company.id]?.join(", ") || "-",
      totalLicenseCapacity: license.capacity,
      totalLicenses: license.licenses,
      licenseDetails: activeLicenses.map((row) => ({
        licenseType: row.LicensePlan?.name,
        quantity: row.quantity,
        dealerLimitAdded: row.dealerLimitAdded,
        activatedAt: row.activatedAt,
        expiresAt: row.expiresAt
      })),
      selectedLicense: selectedPlan?.name || "-",
      selectedLicenseQuantity: company.selectedLicenseQuantity || 1,
      licenseDeliveredStatus: company.licenseDeliveredAt ? "Delivered" : "Pending",
      usedDealerSlots: used,
      remainingDealerSlots: Math.max(0, license.capacity - used),
      paidAmount: company.paymentStatus === "PAID" ? Number(company.subscriptionAmount || 0) : 0,
      pendingAmount: company.paymentStatus === "PENDING" ? Number(company.subscriptionAmount || 0) : 0,
      revenueContribution: company.paymentStatus === "PAID" ? Number(company.subscriptionAmount || 0) : 0,
      subscriptionStatus: daysRemaining === null ? "active" : daysRemaining < 0 ? "expired" : "active",
      daysRemaining,
      createdBySalesManagerName: salesMap[company.createdBySalesManager]?.name || "-",
      financeApprovedByName: financeMap[company.approvedByFinance]?.name || "-"
    };
  });
}

exports.ceoDashboard = asyncHandler(async (req, res) => {
  const [overview, inventory, requests, managers, targets, pinnedMessages, goldSold, platinumSold, financePendingRows, companies, totalAdmins, activeCompanies, pendingCompanies, blockedCompanies, pendingPayments, expiringSubscriptions] = await Promise.all([
    licenseOverview(),
    LicenseInventory.findAll({ include: [LicensePlan], order: [["updatedAt", "DESC"]] }),
    requestRows(),
    User.findAll({ where: { role: managerRoles }, attributes: ["id", "name", "email", "phone", "role", "status", "createdAt"], order: [["createdAt", "DESC"]] }),
    SuperAdminTarget.findAll({ include: [{ model: User, as: "assignee", attributes: ["id", "name", "role"] }], order: [["createdAt", "DESC"]] }),
    SuperAdminPinnedMessage.findAll({ include: [{ model: User, as: "assignee", attributes: ["id", "name", "role"] }], order: [["createdAt", "DESC"]] }),
    CompanyLicense.sum("quantity", { include: [{ model: LicensePlan, where: { name: "Gold" } }] }),
    CompanyLicense.sum("quantity", { include: [{ model: LicensePlan, where: { name: "Platinum" } }] }),
    LicensePurchaseRequest.findAll({ where: { status: { [Op.in]: ["SALES_APPROVED", "FINANCE_PENDING"] } }, attributes: [[fn("SUM", col("amount")), "total"]] }),
    companyRows(),
    User.count({ where: { role: ["ADMIN", "ADMIN_CEO"] } }),
    Company.count({ where: { status: "active" } }),
    Company.count({ where: { [Op.or]: [{ status: "pending" }, { paymentStatus: "PENDING" }] } }),
    Company.count({ where: { status: "blocked" } }),
    Company.count({ where: { paymentStatus: "PENDING" } }),
    Company.count({ where: { endDate: { [Op.between]: [new Date(), new Date(Date.now() + 30 * 86400000)] } } })
  ]);
  res.json({
    ...overview,
    activeCompanies,
    pendingCompanies,
    blockedCompanies,
    totalCompanyAdmins: totalAdmins,
    goldLicensesSold: Number(goldSold || 0),
    platinumLicensesSold: Number(platinumSold || 0),
    financePendingAmount: Number(financePendingRows[0]?.get("total") || 0),
    pendingPayments,
    expiringSubscriptions,
    companies,
    inventory,
    requests,
    managers,
    targets,
    pinnedMessages
  });
});

exports.licenseOverview = asyncHandler(async (req, res) => {
  res.json(await licenseOverview());
});

exports.createManager = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, status = "active" } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ message: "Name, email, password and role are required" });
  requireManagerRole(role);
  const existing = await User.findOne({ where: { email: String(email).trim().toLowerCase() } });
  if (existing) return res.status(409).json({ message: "Email already exists" });
  const user = await User.create({ name, email: String(email).trim().toLowerCase(), phone: phone || null, password, role, status });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status });
});

exports.managers = asyncHandler(async (req, res) => {
  res.json(await User.findAll({ where: { role: managerRoles }, attributes: ["id", "name", "email", "phone", "role", "status", "createdAt"], order: [["createdAt", "DESC"]] }));
});

exports.updateManager = asyncHandler(async (req, res) => {
  const user = await User.findOne({ where: { id: req.params.id, role: managerRoles } });
  if (!user) return res.status(404).json({ message: "Manager not found" });
  const updates = {};
  ["name", "phone", "status"].forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });
  if (req.body.role) {
    requireManagerRole(req.body.role);
    updates.role = req.body.role;
  }
  await user.update(updates);
  res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status });
});

exports.updateManagerStatus = asyncHandler(async (req, res) => {
  const user = await User.findOne({ where: { id: req.params.id, role: managerRoles } });
  if (!user) return res.status(404).json({ message: "Manager not found" });
  await user.update({ status: req.body.status || (user.status === "active" ? "inactive" : "active") });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, status: user.status });
});

exports.deleteManager = asyncHandler(async (req, res) => {
  const user = await User.findOne({ where: { id: req.params.id, role: managerRoles } });
  if (!user) return res.status(404).json({ message: "Manager not found" });
  await user.update({ status: "inactive" });
  res.json({ message: "Manager deleted safely" });
});

exports.companies = asyncHandler(async (req, res) => {
  res.json(await companyRows());
});

exports.blockCompany = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) return res.status(404).json({ message: "Company not found" });
  await sequelize.transaction(async (transaction) => {
    await company.update({ status: "blocked" }, { transaction });
    await User.update({ status: "inactive" }, { where: { companyId: company.id }, transaction });
    await Dealer.update({ status: "blocked" }, { where: { companyId: company.id }, transaction });
  });
  res.json({ message: "Company blocked", company: await Company.findByPk(company.id) });
});

exports.unblockCompany = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) return res.status(404).json({ message: "Company not found" });
  await sequelize.transaction(async (transaction) => {
    await company.update({ status: "active" }, { transaction });
    await User.update({ status: "active" }, { where: { companyId: company.id, role: ["ADMIN", "ADMIN_CEO", "DEALER_MANAGER", "PRODUCT_DELIVERY_MANAGER", "FINANCE_MANAGER", "DEALER"] }, transaction });
    await Dealer.update({ status: "active" }, { where: { companyId: company.id, status: "blocked" }, transaction });
  });
  res.json({ message: "Company unblocked", company: await Company.findByPk(company.id) });
});

exports.createTarget = asyncHandler(async (req, res) => {
  const target = await SuperAdminTarget.create({ ...req.body, createdBy: req.user.id });
  res.status(201).json(target);
});

exports.targets = asyncHandler(async (req, res) => {
  res.json(await SuperAdminTarget.findAll({ include: [{ model: User, as: "assignee", attributes: ["id", "name", "role"] }], order: [["createdAt", "DESC"]] }));
});

exports.createPinnedMessage = asyncHandler(async (req, res) => {
  const message = await SuperAdminPinnedMessage.create({ ...req.body, createdBy: req.user.id, isPinned: req.body.isPinned ?? true });
  res.status(201).json(message);
});

exports.pinnedMessages = asyncHandler(async (req, res) => {
  const where = req.user.role === "SUPER_ADMIN_CEO"
    ? {}
    : { [Op.or]: [{ assignedTo: req.user.id }, { roleTarget: req.user.role }, { assignedTo: null, roleTarget: null }] };
  res.json(await SuperAdminPinnedMessage.findAll({ where, include: [{ model: User, as: "assignee", attributes: ["id", "name", "role"] }], order: [["createdAt", "DESC"]] }));
});

exports.itDashboard = asyncHandler(async (req, res) => {
  const [plans, inventory, requests] = await Promise.all([
    LicensePlan.findAll({ order: [["name", "ASC"]] }),
    LicenseInventory.findAll({ include: [LicensePlan], order: [["updatedAt", "DESC"]] }),
    requestRows()
  ]);
  res.json({ plans, inventory, requests });
});

exports.licensePlans = asyncHandler(async (req, res) => {
  res.json(await LicensePlan.findAll({ order: [["name", "ASC"]] }));
});

exports.createLicensePlan = asyncHandler(async (req, res) => {
  const plan = await LicensePlan.create(req.body);
  await LicenseInventory.findOrCreate({ where: { licensePlanId: plan.id }, defaults: { licensePlanId: plan.id } });
  res.status(201).json(plan);
});

exports.updateLicensePlan = asyncHandler(async (req, res) => {
  const plan = await LicensePlan.findByPk(req.params.id);
  if (!plan) return res.status(404).json({ message: "License plan not found" });
  await plan.update(req.body);
  res.json(plan);
});

exports.licenseInventory = asyncHandler(async (req, res) => {
  res.json(await LicenseInventory.findAll({ include: [LicensePlan], order: [["updatedAt", "DESC"]] }));
});

exports.addLicenseStock = asyncHandler(async (req, res) => {
  const quantity = Math.max(1, Number(req.body.quantity || 0));
  const plan = await LicensePlan.findByPk(req.body.licensePlanId);
  if (!plan) return res.status(404).json({ message: "License plan not found" });
  const [inventory] = await LicenseInventory.findOrCreate({ where: { licensePlanId: plan.id }, defaults: { licensePlanId: plan.id } });
  await inventory.update({
    totalQuantity: Number(inventory.totalQuantity || 0) + quantity,
    availableQuantity: Number(inventory.availableQuantity || 0) + quantity,
    updatedBy: req.user.id,
    createdBy: inventory.createdBy || req.user.id
  });
  res.json(await LicenseInventory.findByPk(inventory.id, { include: [LicensePlan] }));
});

exports.salesDashboard = asyncHandler(async (req, res) => {
  const [requests, companyRequests, plans, createdCompanies] = await Promise.all([
    requestRows(),
    companyPaymentRequests(),
    LicensePlan.findAll({ where: { status: "active" }, order: [["name", "ASC"]] }),
    companyRows()
  ]);
  res.json({ requests, companyRequests, plans, createdCompanies: createdCompanies.filter((company) => company.createdBySalesManager === req.user.id) });
});

exports.salesRequests = asyncHandler(async (req, res) => {
  res.json(await requestRows());
});

exports.approveSalesRequest = asyncHandler(async (req, res) => {
  const request = await LicensePurchaseRequest.findOne({ where: { id: req.params.id, status: "REQUESTED" } });
  if (!request) return res.status(404).json({ message: "Requested license sale not found" });
  await request.update({
    status: "FINANCE_PENDING",
    salesApprovedBy: req.user.id,
    salesApprovedAt: new Date(),
    paymentStatus: "PENDING",
    note: req.body.note ?? request.note
  });
  res.json(await LicensePurchaseRequest.findByPk(request.id, { include: requestInclude }));
});

exports.rejectSalesRequest = asyncHandler(async (req, res) => {
  const request = await LicensePurchaseRequest.findOne({ where: { id: req.params.id, status: "REQUESTED" } });
  if (!request) return res.status(404).json({ message: "Requested license sale not found" });
  await request.update({ status: "REJECTED", note: req.body.note ?? request.note });
  res.json(request);
});

exports.financeDashboard = asyncHandler(async (req, res) => {
  const [requests, companyRequests, plans] = await Promise.all([
    requestRows({ status: { [Op.in]: ["FINANCE_PENDING", "PAYMENT_CONFIRMED", "PAYMENT_REJECTED", "LICENSE_DELIVERED"] } }),
    companyPaymentRequests(),
    LicensePlan.findAll({ where: { status: "active" }, order: [["name", "ASC"]] })
  ]);
  const totals = {
    pendingAmount: requests.filter((row) => row.paymentStatus === "PENDING").reduce((sum, row) => sum + Number(row.amount || 0), 0),
    paidAmount: requests.filter((row) => row.paymentStatus === "PAID").reduce((sum, row) => sum + Number(row.amount || 0), 0) + companyRequests.filter((row) => row.paymentStatus === "PAID").reduce((sum, row) => sum + Number(row.subscriptionAmount || 0), 0),
    rejectedAmount: requests.filter((row) => row.paymentStatus === "REJECTED").reduce((sum, row) => sum + Number(row.amount || 0), 0)
  };
  res.json({ requests, companyRequests, plans, totals, totalSoldAmount: totals.paidAmount });
});

exports.financeRequests = asyncHandler(async (req, res) => {
  res.json(await requestRows({ status: { [Op.in]: ["FINANCE_PENDING", "PAYMENT_CONFIRMED", "PAYMENT_REJECTED", "LICENSE_DELIVERED"] } }));
});

async function companyPaymentRequests() {
  const companies = await Company.findAll({
    where: { paymentStatus: { [Op.in]: ["PENDING", "REJECTED", "PAID"] } },
    include: [{ model: User, where: { role: "ADMIN_CEO" }, required: false, attributes: ["id", "name", "email", "status"] }],
    order: [["createdAt", "DESC"]]
  });
  return companies;
}

exports.createPendingCompany = asyncHandler(async (req, res) => {
  const { password = "admin123", initialLicensePlanId, selectedLicenseQuantity = 1, notes, subscriptionAmount = 0, ...body } = req.body;
  if (!body.companyName || !body.category || !body.adminName || !body.adminEmail || !body.startDate || !body.endDate) {
    return res.status(400).json({ message: "Company, category, admin and dates are required" });
  }
  const existing = await User.findOne({ where: { email: String(body.adminEmail).trim().toLowerCase() } });
  if (existing) return res.status(409).json({ message: "Admin email already exists" });
  const result = await sequelize.transaction(async (transaction) => {
    const company = await Company.create({
      companyName: body.companyName,
      category: body.category,
      description: body.description || notes || "",
      adminName: body.adminName,
      adminEmail: String(body.adminEmail).trim().toLowerCase(),
      startDate: body.startDate,
      endDate: body.endDate,
      status: "pending",
      paymentStatus: "PENDING",
      subscriptionAmount,
      createdBySalesManager: req.user.id,
      selectedLicensePlanId: initialLicensePlanId || null,
      selectedLicenseQuantity: Math.max(1, Number(selectedLicenseQuantity || 1)),
      salesNotes: notes || null
    }, { transaction });
    const admin = await User.create({
      name: body.adminName,
      email: String(body.adminEmail).trim().toLowerCase(),
      password,
      role: "ADMIN_CEO",
      status: "inactive",
      companyId: company.id
    }, { transaction });
    return { company, admin: { id: admin.id, email: admin.email, status: admin.status, role: admin.role } };
  });
  res.status(201).json(result);
});

exports.companyPaymentRequests = asyncHandler(async (req, res) => {
  res.json(await companyPaymentRequests());
});

exports.sendCompanyNotification = asyncHandler(async (req, res) => {
  const { companyId, sendToAll, title, message } = req.body;
  if (!title || !message) return res.status(400).json({ message: "Title and message are required" });
  const where = sendToAll ? { createdBySalesManager: req.user.id, status: "active" } : { id: companyId, createdBySalesManager: req.user.id };
  const companies = await Company.findAll({ where });
  if (!companies.length) return res.status(404).json({ message: "No target companies found" });
  const admins = await User.findAll({ where: { companyId: companies.map((company) => company.id), role: ["ADMIN", "ADMIN_CEO"] } });
  await InternalNotification.bulkCreate(admins.map((admin) => ({
    companyId: admin.companyId,
    userId: admin.id,
    roleTarget: "ADMIN",
    title,
    message,
    type: "GENERAL",
    priority: "MEDIUM",
    metadata: { sentBySalesManager: req.user.id }
  })));
  res.status(201).json({ delivered: admins.length, companies: companies.length });
});

exports.approveCompanyPayment = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.companyId, { include: [CompanyLicense] });
  if (!company) return res.status(404).json({ message: "Company not found" });
  await sequelize.transaction(async (transaction) => {
    let selectedPlan = null;
    if (company.selectedLicensePlanId && !company.licenseDeliveredAt) {
      selectedPlan = await LicensePlan.findByPk(company.selectedLicensePlanId, { transaction });
      if (!selectedPlan) {
        const error = new Error("Selected license plan not found");
        error.status = 400;
        throw error;
      }
      const quantity = Math.max(1, Number(company.selectedLicenseQuantity || 1));
      const [inventory] = await LicenseInventory.findOrCreate({
        where: { licensePlanId: selectedPlan.id },
        defaults: { licensePlanId: selectedPlan.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (Number(inventory.availableQuantity || 0) < quantity) {
        const error = new Error(`Not enough ${selectedPlan.name} licenses available`);
        error.status = 400;
        throw error;
      }
      await inventory.update({
        availableQuantity: Number(inventory.availableQuantity || 0) - quantity,
        soldQuantity: Number(inventory.soldQuantity || 0) + quantity,
        updatedBy: req.user.id
      }, { transaction });
      await CompanyLicense.create({
        companyId: company.id,
        licensePlanId: selectedPlan.id,
        quantity,
        dealerLimitAdded: Number(selectedPlan.dealerLimit || 0) * quantity,
        status: "active",
        activatedAt: new Date(),
        expiresAt: company.endDate || null
      }, { transaction });
    }
    await company.update({
      status: "active",
      paymentStatus: "PAID",
      approvedByFinance: req.user.id,
      financeApprovedAt: new Date(),
      licenseDeliveredAt: company.selectedLicensePlanId && !company.licenseDeliveredAt ? new Date() : company.licenseDeliveredAt
    }, { transaction });
    await User.update({ status: "active", role: "ADMIN_CEO" }, { where: { companyId: company.id, role: ["ADMIN", "ADMIN_CEO"] }, transaction });
    const admins = await User.findAll({ where: { companyId: company.id, role: ["ADMIN", "ADMIN_CEO"] }, transaction });
    for (const admin of admins) {
      await InternalNotification.create({
        companyId: company.id,
        userId: admin.id,
        roleTarget: "ADMIN",
        title: "Company activated",
        message: selectedPlan ? `Your ${selectedPlan.name} license has been activated and your company access is now active.` : "Your company access is now active.",
        type: "GENERAL",
        priority: "MEDIUM"
      }, { transaction });
    }
    if (company.createdBySalesManager) {
      await SuperAdminChat.create({
        senderId: req.user.id,
        receiverId: company.createdBySalesManager,
        message: `Company ${company.companyName} payment approved and activated.`
      }, { transaction });
    }
  });
  res.json(await Company.findByPk(company.id));
});

exports.rejectCompanyPayment = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.companyId);
  if (!company) return res.status(404).json({ message: "Company not found" });
  await company.update({ status: "rejected", paymentStatus: "REJECTED", approvedByFinance: req.user.id, financeApprovedAt: new Date(), salesNotes: req.body.note || company.salesNotes });
  await User.update({ status: "inactive" }, { where: { companyId: company.id, role: ["ADMIN", "ADMIN_CEO"] } });
  res.json(company);
});

exports.confirmPayment = asyncHandler(async (req, res) => {
  const result = await sequelize.transaction(async (transaction) => {
    const request = await LicensePurchaseRequest.findOne({
      where: { id: req.params.id, status: "FINANCE_PENDING" },
      include: [LicensePlan, Company],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!request) {
      const error = new Error("Finance pending request not found");
      error.status = 404;
      throw error;
    }
    const [inventory] = await LicenseInventory.findOrCreate({
      where: { licensePlanId: request.licensePlanId },
      defaults: { licensePlanId: request.licensePlanId },
      transaction
    });
    if (Number(inventory.availableQuantity || 0) < Number(request.quantity || 0)) {
      const error = new Error("Not enough license inventory available");
      error.status = 400;
      throw error;
    }
    await inventory.update({
      availableQuantity: Number(inventory.availableQuantity || 0) - Number(request.quantity || 0),
      soldQuantity: Number(inventory.soldQuantity || 0) + Number(request.quantity || 0),
      updatedBy: req.user.id
    }, { transaction });
    const companyLicense = await CompanyLicense.create({
      companyId: request.companyId,
      licensePlanId: request.licensePlanId,
      quantity: request.quantity,
      dealerLimitAdded: request.totalDealerLimit,
      status: "active",
      purchaseRequestId: request.id,
      activatedAt: new Date()
    }, { transaction });
    await request.update({
      status: "LICENSE_DELIVERED",
      paymentStatus: "PAID",
      paymentMethod: req.body.paymentMethod || request.paymentMethod,
      transactionReference: req.body.transactionReference || request.transactionReference,
      note: req.body.note ?? request.note,
      financeVerifiedBy: req.user.id,
      financeVerifiedAt: new Date()
    }, { transaction });
    const admins = await User.findAll({ where: { companyId: request.companyId, role: "ADMIN" }, transaction });
    const text = `Your ${request.LicensePlan?.name || "license"} license has been activated. You can now add ${request.totalDealerLimit} more dealers.`;
    for (const admin of admins) {
      await Message.create({
        companyId: request.companyId,
        senderId: req.user.id,
        receiverId: admin.id,
        title: "License activated",
        message: text,
        conversationId: `${request.companyId}-license`,
        messageType: "license_activation",
        isRead: false
      }, { transaction });
    }
    return { request, companyLicense };
  });
  res.json(result);
});

exports.rejectPayment = asyncHandler(async (req, res) => {
  const request = await LicensePurchaseRequest.findOne({ where: { id: req.params.id, status: "FINANCE_PENDING" } });
  if (!request) return res.status(404).json({ message: "Finance pending request not found" });
  await request.update({
    status: "PAYMENT_REJECTED",
    paymentStatus: "REJECTED",
    paymentMethod: req.body.paymentMethod || request.paymentMethod,
    transactionReference: req.body.transactionReference || request.transactionReference,
    note: req.body.note ?? request.note,
    financeVerifiedBy: req.user.id,
    financeVerifiedAt: new Date()
  });
  res.json(request);
});

exports.chatConversations = asyncHandler(async (req, res) => {
  const users = await User.findAll({
    where: { role: ["SUPER_ADMIN_CEO", ...managerRoles], id: { [Op.ne]: req.user.id } },
    attributes: ["id", "name", "email", "role", "status"],
    order: [["name", "ASC"]]
  });
  res.json(users);
});

exports.chatMessages = asyncHandler(async (req, res) => {
  const otherId = Number(req.params.userId);
  res.json(await SuperAdminChat.findAll({
    where: {
      [Op.or]: [
        { senderId: req.user.id, receiverId: otherId },
        { senderId: otherId, receiverId: req.user.id }
      ]
    },
    include: [{ model: User, as: "sender", attributes: ["id", "name", "role"] }],
    order: [["createdAt", "ASC"]]
  }));
});

exports.sendChat = asyncHandler(async (req, res) => {
  if (!req.body.receiverId || !req.body.message) return res.status(400).json({ message: "Receiver and message are required" });
  const message = await SuperAdminChat.create({ senderId: req.user.id, receiverId: req.body.receiverId, message: req.body.message });
  res.status(201).json(message);
});

exports.readChat = asyncHandler(async (req, res) => {
  const message = await SuperAdminChat.findOne({ where: { id: req.params.messageId, receiverId: req.user.id } });
  if (!message) return res.status(404).json({ message: "Message not found" });
  await message.update({ isRead: true });
  res.json(message);
});
