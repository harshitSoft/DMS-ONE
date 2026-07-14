const router = require("express").Router();
const ctrl = require("../controllers/adminController");
const { protect, permit, requireCompanyScope } = require("../middleware/auth");
const {
  hasAnyRole,
  ADMIN_OWNER_ROLES,
  ADMIN_DEALER_ROLES,
  ADMIN_PRODUCT_DELIVERY_ROLES,
  ADMIN_FINANCE_ROLES,
  ADMIN_READ_ROLES
} = require("../middleware/roles");
const { productImageUpload, invoiceUpload, creditRewardUpload } = require("../middleware/upload");
const { hasAdminManagers } = require("../utils/managerAssignment");
const { licenseSystemEnabled } = require("../utils/featureFlags");

const readRules = [
  { pattern: /^\/(?:dashboard|company|policies)(?:\/|$)/, roles: ADMIN_READ_ROLES },
  { pattern: /^\/(?:dealers|dealer-sales|dealer-performance|license-status|license-requests|reports)(?:\/|$)/, roles: ADMIN_DEALER_ROLES },
  { pattern: /^\/(?:products|inventory|stock|orders|delivery|dealer-wise-stock|stock-transfer-requests)(?:\/|$)/, roles: ADMIN_PRODUCT_DELIVERY_ROLES },
  { pattern: /^\/(?:finance|payments|invoices|dealer-wise-payment-list|credit\/summary|credit\/dealer-wallets)(?:\/|$)/, roles: ADMIN_FINANCE_ROLES },
  { pattern: /^\/messages(?:\/|$)/, roles: ADMIN_READ_ROLES },
  { pattern: /^\/credit(?:\/|$)/, roles: ADMIN_OWNER_ROLES }
];

function adminSectionGuard(req, res, next) {
  if (hasAnyRole(req.user, ADMIN_OWNER_ROLES)) return next();
  const rule = readRules.find(({ pattern }) => pattern.test(req.path));
  if (rule && hasAnyRole(req.user, rule.roles) && req.method === "GET") return next();

  // Managers may perform work only inside their assigned operational section.
  if (hasAnyRole(req.user, ADMIN_DEALER_ROLES) && req.user.role === "DEALER_MANAGER" && /^\/(?:dealers|license-requests)(?:\/|$)/.test(req.path)) return next();
  if (hasAnyRole(req.user, ADMIN_PRODUCT_DELIVERY_ROLES) && req.user.role === "PRODUCT_DELIVERY_MANAGER" && /^\/(?:products|inventory|orders|delivery|stock-transfer-requests)(?:\/|$)/.test(req.path)) return next();
  if (hasAnyRole(req.user, ADMIN_FINANCE_ROLES) && req.user.role === "FINANCE_MANAGER" && /^\/(?:finance|payments|invoices)(?:\/|$)/.test(req.path)) return next();
  return res.status(403).json({ message: "Access denied" });
}

async function blockAdminCeoAssignedWork(req, res, next) {
  if (!["ADMIN", "ADMIN_CEO"].includes(req.user.role)) return next();
  if (req.method === "GET") return next();
  if (!(await hasAdminManagers(req.user.companyId))) return next();
  const assignedPrefixes = [
    /^\/dealers/,
    /^\/products/,
    /^\/inventory/,
    /^\/orders/,
    /^\/delivery/,
    /^\/stock-transfer-requests/,
    /^\/payments/,
    /^\/finance/,
    /^\/credit\/rewards/,
    /^\/credit\/redemptions/
  ];
  if (assignedPrefixes.some((pattern) => pattern.test(req.path))) {
    return res.status(403).json({ message: "This action is assigned to your manager." });
  }
  next();
}

router.use(protect, permit(...ADMIN_READ_ROLES), requireCompanyScope, adminSectionGuard, blockAdminCeoAssignedWork);
router.get("/dashboard", ctrl.dashboard);
router.get("/dashboard/analytics", ctrl.analytics);
router.get("/company", ctrl.company);
router.get("/license-status", licenseSystemEnabled() ? ctrl.licenseStatus : (req, res) => res.status(410).json({ message: "The license system is no longer active." }));
router.post("/license-requests", licenseSystemEnabled() ? ctrl.createLicenseRequest : (req, res) => res.status(410).json({ message: "The license system is no longer active." }));
router.route("/dealers").get(ctrl.dealers).post(ctrl.createDealer);
router.get("/dealers/:id", ctrl.getDealer);
router.route("/dealers/:id").put(ctrl.updateDealer).delete(ctrl.deleteDealer);
router.patch("/dealers/:id/status", ctrl.setDealerStatus);
router.route("/products").get(ctrl.products).post(productImageUpload.single("image"), ctrl.createProduct);
router.put("/products/:id", productImageUpload.single("image"), ctrl.updateProduct);
router.delete("/products/:id", ctrl.deleteProduct);
router.put("/products/variants/:variantId", ctrl.updateProductVariant);
router.delete("/products/variants/:variantId", ctrl.deleteProductVariant);
router.patch("/inventory/:productId", ctrl.updateInventory);
router.get("/inventory", ctrl.companyStock);
router.get("/stock/company", ctrl.companyStock);
router.get("/stock/dealers", ctrl.dealerStock);
router.get("/dealer-wise-stock", ctrl.dealerStock);
router.get("/dealer-sales", ctrl.dealerSales);
router.get("/orders", ctrl.orders);
router.get("/orders/pending", ctrl.pendingOrders);
router.get("/orders/:id/stock-check", ctrl.stockCheck);
router.post("/orders/:id/approve-with-schedule", ctrl.approveWithSchedule);
router.patch("/orders/:id/status", ctrl.updateOrderStatus);
router.get("/delivery", ctrl.delivery);
router.patch("/delivery/:id/status", ctrl.updateOrderStatus);
router.route("/payments").get(ctrl.payments).post(ctrl.payments);
router.get("/invoices", ctrl.payments);
router.get("/dealer-wise-payment-list", ctrl.payments);
router.get("/finance/approved-orders", ctrl.approvedOrdersForPayment);
router.post("/finance/send-payment-request/:orderId", invoiceUpload.single("invoice"), ctrl.sendPaymentRequest);
router.get("/finance/payments", ctrl.financeSummary);
router.post("/finance/reminder/:paymentId", ctrl.sendPaymentReminder);
router.route("/policies").get(ctrl.policies).post(ctrl.policies);
router.route("/messages").get(ctrl.messages).post(ctrl.messages);
router.get("/messages/conversations", ctrl.adminConversations);
router.post("/messages/send", ctrl.messages);
router.put("/messages/read/:conversationId", ctrl.markConversationRead);
router.get("/dealer-performance", ctrl.dealerPerformance);
router.get("/credit/summary", ctrl.creditSummary);
router.route("/credit/rewards").get(ctrl.creditRewards).post(creditRewardUpload.single("image"), ctrl.creditRewards);
router.put("/credit/rewards/:id", creditRewardUpload.single("image"), ctrl.updateCreditReward);
router.delete("/credit/rewards/:id", ctrl.deleteCreditReward);
router.patch("/credit/rewards/:id/status", ctrl.creditRewardStatus);
router.get("/credit/redemptions", ctrl.creditRedemptions);
router.patch("/credit/redemptions/:id/status", ctrl.updateCreditRedemptionStatus);
router.get("/credit/dealer-wallets", ctrl.dealerWallets);
router.get("/reports", ctrl.reports);

module.exports = router;
