const { Op, fn, col } = require("sequelize");
const {
  Company,
  CompanyLicense,
  Dealer,
  LicensePlan,
  LicensePurchaseRequest
} = require("../models");

async function licenseCapacity(companyId) {
  const [dealerCount, licenses, plans, pendingRequests] = await Promise.all([
    Dealer.count({ where: { companyId, status: { [Op.ne]: "blocked" } } }),
    CompanyLicense.findAll({ where: { companyId, status: "active" }, include: [LicensePlan] }),
    LicensePlan.findAll({ where: { status: "active" }, order: [["price", "ASC"]] }),
    LicensePurchaseRequest.findAll({
      where: { companyId, status: { [Op.in]: ["REQUESTED", "SALES_APPROVED", "FINANCE_PENDING", "PAYMENT_CONFIRMED"] } },
      include: [LicensePlan],
      order: [["createdAt", "DESC"]]
    })
  ]);
  const capacity = licenses.reduce((sum, license) => sum + Number(license.dealerLimitAdded || 0), 0);
  return {
    dealerCount,
    capacity,
    remainingSlots: Math.max(0, capacity - dealerCount),
    licenses,
    plans,
    pendingRequests,
    limitReached: dealerCount >= capacity
  };
}

async function licenseOverview() {
  const [totalCompanies, totalDealers, soldRows, revenueRows, pendingRequests, paymentPendingRequests, companies] = await Promise.all([
    Company.count(),
    Dealer.count(),
    CompanyLicense.findAll({ attributes: [[fn("SUM", col("quantity")), "total"]] }),
    Promise.all([
      LicensePurchaseRequest.findAll({ where: { paymentStatus: "PAID" }, attributes: [[fn("SUM", col("amount")), "total"]] }),
      Company.findAll({ where: { paymentStatus: "PAID" }, attributes: [[fn("SUM", col("subscriptionAmount")), "total"]] })
    ]),
    LicensePurchaseRequest.count({ where: { status: "REQUESTED" } }),
    LicensePurchaseRequest.count({ where: { status: { [Op.in]: ["SALES_APPROVED", "FINANCE_PENDING"] } } }),
    Company.findAll({ include: [{ model: CompanyLicense, include: [LicensePlan] }, Dealer] })
  ]);
  const soldLicenses = Number(soldRows[0]?.get("total") || 0);
  const revenue = Number(revenueRows[0]?.[0]?.get("total") || 0) + Number(revenueRows[1]?.[0]?.get("total") || 0);
  const topCompanies = companies.map((company) => ({
    id: company.id,
    companyName: company.companyName,
    dealers: company.Dealers?.length || 0,
    licenseQuantity: (company.CompanyLicenses || []).reduce((sum, license) => sum + Number(license.quantity || 0), 0),
    dealerCapacity: (company.CompanyLicenses || []).reduce((sum, license) => sum + Number(license.dealerLimitAdded || 0), 0)
  })).sort((a, b) => b.licenseQuantity - a.licenseQuantity).slice(0, 5);
  return { totalCompanies, totalDealers, soldLicenses, revenue, pendingRequests, paymentPendingRequests, topCompanies };
}

module.exports = { licenseCapacity, licenseOverview };
