const router = require("express").Router();
const ctrl = require("../controllers/superAdminHierarchyController");
const { protect, permit } = require("../middleware/auth");

router.use(protect, permit("SUPER_ADMIN_IT_MANAGER"));
router.get("/dashboard", ctrl.itDashboard);
router.get("/license-plans", ctrl.licensePlans);
router.post("/license-plans", ctrl.createLicensePlan);
router.put("/license-plans/:id", ctrl.updateLicensePlan);
router.post("/license-inventory/add-stock", ctrl.addLicenseStock);
router.get("/license-inventory", ctrl.licenseInventory);

module.exports = router;
