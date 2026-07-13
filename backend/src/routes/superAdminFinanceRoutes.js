const router = require("express").Router();
const ctrl = require("../controllers/superAdminHierarchyController");
const { protect, permit } = require("../middleware/auth");

router.use(protect, permit("SUPER_ADMIN_FINANCE_MANAGER"));
router.get("/dashboard", ctrl.financeDashboard);
router.get("/company-payment-requests", ctrl.companyPaymentRequests);
router.patch("/company-payment-requests/:companyId/approve", ctrl.approveCompanyPayment);
router.patch("/company-payment-requests/:companyId/reject", ctrl.rejectCompanyPayment);
router.get("/payment-requests", ctrl.financeRequests);
router.patch("/payment-requests/:id/confirm-payment", ctrl.confirmPayment);
router.patch("/payment-requests/:id/reject-payment", ctrl.rejectPayment);

module.exports = router;
