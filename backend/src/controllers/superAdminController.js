const { Op, fn, col } = require("sequelize");
const asyncHandler = require("../utils/asyncHandler");
const { Company, Dealer, User } = require("../models");

exports.dashboard = asyncHandler(async (req, res) => {
  const [totalCompanies, activeCompanies, expiredCompanies, blockedCompanies, totalDealers, categoryRows] = await Promise.all([
    Company.count(),
    Company.count({ where: { status: "active" } }),
    Company.count({ where: { status: "expired" } }),
    Company.count({ where: { status: "blocked" } }),
    Dealer.count(),
    Company.findAll({ attributes: ["category", [fn("COUNT", col("id")), "count"]], group: ["category"] })
  ]);
  res.json({ totalCompanies, activeCompanies, expiredCompanies, blockedCompanies, totalDealers, categoryWise: categoryRows });
});

exports.createCompany = asyncHandler(async (req, res) => {
  const { password = "admin123", ...body } = req.body;
  const company = await Company.create(body);
  const admin = await User.create({
    name: body.adminName,
    email: body.adminEmail,
    password,
    role: "ADMIN_CEO",
    companyId: company.id
  });
  res.status(201).json({ company, admin: { id: admin.id, email: admin.email } });
});

exports.listCompanies = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.category) where.category = req.query.category;
  if (req.query.search) where.companyName = { [Op.like]: `%${req.query.search}%` };
  const companies = await Company.findAll({ where, include: [{ model: Dealer }], order: [["createdAt", "DESC"]] });
  res.json(companies);
});

exports.getCompany = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id, { include: [{ model: Dealer }] });
  if (!company) return res.status(404).json({ message: "Company not found" });
  res.json(company);
});

exports.updateCompany = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) return res.status(404).json({ message: "Company not found" });
  await company.update(req.body);
  if (req.body.adminEmail || req.body.adminName) {
    await User.update(
      { email: req.body.adminEmail || company.adminEmail, name: req.body.adminName || company.adminName },
      { where: { companyId: company.id, role: "ADMIN" } }
    );
  }
  res.json(company);
});

exports.setCompanyStatus = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) return res.status(404).json({ message: "Company not found" });
  await company.update({ status: req.body.status });
  res.json(company);
});

exports.deleteCompany = asyncHandler(async (req, res) => {
  const company = await Company.findByPk(req.params.id);
  if (!company) return res.status(404).json({ message: "Company not found" });
  await company.destroy();
  res.json({ message: "Company deleted" });
});
