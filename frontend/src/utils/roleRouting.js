export const dashboardRouteByRole = {
  SUPER_ADMIN: "/super-admin/dashboard",
  SUPER_ADMIN_CEO: "/super-admin/dashboard",
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
