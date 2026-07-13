const { User } = require("../models");

const adminManagerRoles = ["DEALER_MANAGER", "PRODUCT_DELIVERY_MANAGER", "FINANCE_MANAGER"];
const dealerManagerRoles = ["DEALER_STOCK_INVENTORY_MANAGER", "DEALER_STOCK_DELIVERY_MANAGER", "DEALER_SALES_FINANCE_MANAGER"];

async function hasAdminManagers(companyId) {
  if (!companyId) return false;
  const count = await User.count({ where: { companyId, role: adminManagerRoles, status: "active" } });
  return count > 0;
}

async function hasDealerManagers(dealerId) {
  if (!dealerId) return false;
  const count = await User.count({ where: { dealerId, role: dealerManagerRoles, status: "active" } });
  return count > 0;
}

module.exports = { adminManagerRoles, dealerManagerRoles, hasAdminManagers, hasDealerManagers };
