const router = require("express").Router();
const ctrl = require("../controllers/superAdminHierarchyController");
const { protect, permit } = require("../middleware/auth");

router.use(protect, permit("SUPER_ADMIN_CEO"));
router.get("/dashboard", ctrl.ceoDashboard);
router.get("/companies", ctrl.companies);
router.patch("/companies/:id/block", ctrl.blockCompany);
router.patch("/companies/:id/unblock", ctrl.unblockCompany);
router.post("/managers", ctrl.createManager);
router.get("/managers", ctrl.managers);
router.put("/managers/:id", ctrl.updateManager);
router.patch("/managers/:id/status", ctrl.updateManagerStatus);
router.delete("/managers/:id", ctrl.deleteManager);
router.post("/targets", ctrl.createTarget);
router.get("/targets", ctrl.targets);
router.post("/pinned-messages", ctrl.createPinnedMessage);
router.get("/pinned-messages", ctrl.pinnedMessages);
router.get("/license-overview", ctrl.licenseOverview);

module.exports = router;
