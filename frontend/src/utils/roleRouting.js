export const dashboardRouteByRole = {
  SUPER_ADMIN: "/super-admin/dashboard",
  SUPER_ADMIN_CEO: "/super-admin/dashboard",
  ADMIN: "/admin/dashboard",
  ADMIN_CEO: "/admin/dashboard",
  DEALER_MANAGER: "/admin/dashboard",
  PRODUCT_DELIVERY_MANAGER: "/admin/dashboard",
  FINANCE_MANAGER: "/admin/dashboard",
  DEALER: "/dealer/dashboard",
  DEALER_CEO: "/dealer/dashboard",
  DEALER_STOCK_INVENTORY_MANAGER: "/dealer/dashboard",
  DEALER_STOCK_DELIVERY_MANAGER: "/dealer/dashboard",
  DEALER_SALES_FINANCE_MANAGER: "/dealer/dashboard"
};

export function dashboardRoute(role) {
  return dashboardRouteByRole[role] || "/login";
}
