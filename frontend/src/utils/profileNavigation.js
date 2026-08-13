const dealerStockExchangeEnabled = import.meta.env.VITE_ENABLE_DEALER_STOCK_EXCHANGE !== "false";
const dealerStockExchangeTab = dealerStockExchangeEnabled ? [{ id: "dealerStockExchange", label: "Dealer Stock Exchange", icon: "inventory" }] : [];
const adminInterDealerTab = dealerStockExchangeEnabled ? [{ id: "interDealerRequests", label: "Inter-Dealer Requests", icon: "inventory" }] : [];
const adminCeoTransferTabs = dealerStockExchangeEnabled ? [
  { id: "transferApprovals", label: "Transfer Approvals", icon: "inventory" },
  { id: "transferHistory", label: "Transfer History", icon: "reports" }
] : [];

export const roleRoutes = {
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

export const roleTabs = {
  SUPER_ADMIN: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "create-organization", label: "Create Organization", icon: "companies" },
    { id: "organizations", label: "Organizations", icon: "companies" }
  ],
  SUPER_ADMIN_CEO: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "create-organization", label: "Create Organization", icon: "companies" },
    { id: "organizations", label: "Organizations", icon: "companies" }
  ],
  ADMIN: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "dealers", label: "Dealers", icon: "dealers" },
    { id: "dealerPerformance", label: "Dealer Performance", icon: "performance" },
    { id: "products", label: "Products", icon: "products" },
    { id: "inventory", label: "Inventory", icon: "inventory" },
    { id: "orders", label: "Orders", icon: "orders" },
    { id: "delivery", label: "Delivery", icon: "delivery" },
    { id: "finance", label: "Finance", icon: "finance" },
    { id: "creditManagement", label: "Credit Management", icon: "credits" },
    { id: "dealerSales", label: "Dealer Sales", icon: "reports" },
    { id: "messages", label: "Messages", icon: "messages" },
    { id: "internalUpdates", label: "Internal Updates", icon: "internalUpdates" },
    { id: "policies", label: "Policies", icon: "policies" },
    { id: "reports", label: "Reports", icon: "reports" }
  ],
  ADMIN_CEO: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "adminManagers", label: "Managers", icon: "dealers" },
    { id: "dealersOverview", label: "Dealers Overview", icon: "dealers" },
    { id: "productOverview", label: "Product Overview", icon: "products" },
    { id: "orderOverview", label: "Order Overview", icon: "orders" },
    { id: "deliveryOverview", label: "Delivery Overview", icon: "delivery" },
    { id: "financeOverview", label: "Finance Overview", icon: "finance" },
    { id: "creditOverview", label: "Credit Overview", icon: "credits" },
    ...adminCeoTransferTabs,
    { id: "adminChat", label: "Internal Team Chat", icon: "messages" },
    { id: "internalUpdates", label: "Internal Updates", icon: "internalUpdates" }
  ],
  DEALER_MANAGER: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "dealers", label: "Dealer Management", icon: "dealers" },
    { id: "dealerPerformance", label: "Dealer Performance", icon: "performance" },
    { id: "creditManagement", label: "Credit Store / Coins", icon: "credits" },
    { id: "adminChat", label: "Internal Team Chat", icon: "messages" },
    { id: "internalUpdates", label: "Internal Updates", icon: "internalUpdates" }
  ],
  PRODUCT_DELIVERY_MANAGER: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "products", label: "Products", icon: "products" },
    { id: "inventory", label: "Inventory", icon: "inventory" },
    { id: "orders", label: "Orders", icon: "orders" },
    { id: "delivery", label: "Delivery", icon: "delivery" },
    ...adminInterDealerTab,
    { id: "adminChat", label: "Internal Team Chat", icon: "messages" },
    { id: "internalUpdates", label: "Internal Updates", icon: "internalUpdates" }
  ],
  FINANCE_MANAGER: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "finance", label: "Finance", icon: "finance" },
    { id: "creditManagement", label: "Credit Overview", icon: "credits" },
    { id: "adminChat", label: "Internal Team Chat", icon: "messages" },
    { id: "internalUpdates", label: "Internal Updates", icon: "internalUpdates" }
  ],
  DEALER: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "managers", label: "Managers", icon: "dealers" },
    { id: "stock", label: "Available Stock", icon: "inventory" },
    { id: "inventory", label: "My Inventory", icon: "products" },
    ...dealerStockExchangeTab,
    { id: "sales", label: "Sales", icon: "reports" },
    { id: "orders", label: "My Orders", icon: "orders" },
    { id: "delivery", label: "Delivery", icon: "delivery" },
    { id: "finance", label: "Finance", icon: "finance" },
    { id: "creditStore", label: "Credit Store", icon: "credits" },
    { id: "messages", label: "Message to Admin", icon: "messages" },
    { id: "internalUpdates", label: "Internal Updates", icon: "internalUpdates" },
    { id: "policies", label: "Policies", icon: "policies" },
    { id: "reports", label: "Send Report", icon: "reports" }
  ],
  DEALER_CEO: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "managers", label: "Managers", icon: "dealers" },
    { id: "stock", label: "Available Company Stock", icon: "inventory" },
    { id: "inventory", label: "My Inventory", icon: "products" },
    ...dealerStockExchangeTab,
    { id: "orders", label: "My Orders", icon: "orders" },
    { id: "delivery", label: "Delivery", icon: "delivery" },
    { id: "sales", label: "Sales", icon: "reports" },
    { id: "finance", label: "Finance", icon: "finance" },
    { id: "creditStore", label: "Credit Store", icon: "credits" },
    { id: "messages", label: "Message to Admin", icon: "messages" },
    { id: "internalUpdates", label: "Internal Updates", icon: "internalUpdates" },
    { id: "policies", label: "Policies", icon: "policies" },
    { id: "reports", label: "Send Report", icon: "reports" }
  ],
  DEALER_STOCK_INVENTORY_MANAGER: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "stock", label: "Available Company Stock", icon: "inventory" },
    { id: "inventory", label: "My Inventory", icon: "products" },
    ...dealerStockExchangeTab,
    { id: "orders", label: "My Orders", icon: "orders" },
    { id: "delivery", label: "Delivery", icon: "delivery" },
    { id: "internalUpdates", label: "Internal Updates", icon: "internalUpdates" },
    { id: "reports", label: "Send Report", icon: "reports" }
  ],
  DEALER_STOCK_DELIVERY_MANAGER: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "stock", label: "Available Company Stock", icon: "inventory" },
    { id: "inventory", label: "My Inventory", icon: "products" },
    ...dealerStockExchangeTab,
    { id: "orders", label: "My Orders", icon: "orders" },
    { id: "delivery", label: "Delivery", icon: "delivery" },
    { id: "internalUpdates", label: "Internal Updates", icon: "internalUpdates" },
    { id: "reports", label: "Send Report", icon: "reports" }
  ],
  DEALER_SALES_FINANCE_MANAGER: [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "sales", label: "Sales", icon: "reports" },
    { id: "finance", label: "Finance", icon: "finance" },
    { id: "internalUpdates", label: "Internal Updates", icon: "internalUpdates" },
    { id: "reports", label: "Send Report", icon: "reports" }
  ]
};

export function consumeProfileTargetTab(defaultTab, tabs) {
  const target = sessionStorage.getItem("dms_profile_target_tab");
  if (target && tabs.some((tab) => tab.id === target)) {
    sessionStorage.removeItem("dms_profile_target_tab");
    return target;
  }
  return defaultTab;
}
