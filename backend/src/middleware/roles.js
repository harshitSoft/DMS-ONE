const ROLE_ALIASES = Object.freeze({
  ADMIN: "ADMIN_CEO",
  DEALER: "DEALER_CEO",
  DEALER_STOCK_INVENTORY_MANAGER: "DEALER_STOCK_DELIVERY_MANAGER"
});

const ADMIN_OWNER_ROLES = Object.freeze(["ADMIN", "ADMIN_CEO"]);
const ADMIN_DEALER_ROLES = Object.freeze(["ADMIN", "ADMIN_CEO", "DEALER_MANAGER"]);
const ADMIN_PRODUCT_DELIVERY_ROLES = Object.freeze(["ADMIN", "ADMIN_CEO", "PRODUCT_DELIVERY_MANAGER"]);
const ADMIN_FINANCE_ROLES = Object.freeze(["ADMIN", "ADMIN_CEO", "FINANCE_MANAGER"]);
const ADMIN_READ_ROLES = Object.freeze(["ADMIN", "ADMIN_CEO", "DEALER_MANAGER", "PRODUCT_DELIVERY_MANAGER", "FINANCE_MANAGER"]);
const CEO_ROLES = Object.freeze(["SUPER_ADMIN_CEO", "ADMIN", "ADMIN_CEO", "DEALER", "DEALER_CEO"]);

function normalizeRole(role) {
  return ROLE_ALIASES[role] || role;
}

function hasAnyRole(user, roles = []) {
  if (!user?.role) return false;
  const accepted = new Set(roles.flatMap((role) => [role, normalizeRole(role)]));
  return accepted.has(user.role) || accepted.has(normalizeRole(user.role));
}

module.exports = {
  normalizeRole,
  hasAnyRole,
  ADMIN_OWNER_ROLES,
  ADMIN_DEALER_ROLES,
  ADMIN_PRODUCT_DELIVERY_ROLES,
  ADMIN_FINANCE_ROLES,
  ADMIN_READ_ROLES,
  CEO_ROLES
};
