export const dashboardRouteByRole = {
  SUPER_ADMIN: "/super-admin",
  SUPER_ADMIN_CEO: "/super-admin-ceo",
  SUPER_ADMIN_IT_MANAGER: "/super-admin-it",
  SUPER_ADMIN_SALES_MANAGER: "/super-admin-sales",
  SUPER_ADMIN_FINANCE_MANAGER: "/super-admin-finance",
  ADMIN: "/admin",
  ADMIN_CEO: "/admin",
  DEALER_MANAGER: "/admin",
  PRODUCT_DELIVERY_MANAGER: "/admin",
  FINANCE_MANAGER: "/admin",
  DEALER: "/dealer",
  DEALER_CEO: "/dealer",
  DEALER_STOCK_INVENTORY_MANAGER: "/dealer",
  DEALER_STOCK_DELIVERY_MANAGER: "/dealer",
  DEALER_SALES_FINANCE_MANAGER: "/dealer"
};

export function dashboardRoute(role) {
  return dashboardRouteByRole[role] || "/login";
}
