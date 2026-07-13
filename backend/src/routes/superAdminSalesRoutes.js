const router = require("express").Router();
const ctrl = require("../controllers/superAdminHierarchyController");
const { protect, permit } = require("../middleware/auth");

router.use(protect, permit("SUPER_ADMIN_SALES_MANAGER"));
router.get("/dashboard", ctrl.salesDashboard);
router.post("/companies", ctrl.createPendingCompany);
router.post("/company-notifications", ctrl.sendCompanyNotification);
router.get("/license-requests", ctrl.salesRequests);
router.patch("/license-requests/:id/approve", ctrl.approveSalesRequest);
router.patch("/license-requests/:id/reject", ctrl.rejectSalesRequest);

module.exports = router;
