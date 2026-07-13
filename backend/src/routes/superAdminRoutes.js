const router = require("express").Router();
const ctrl = require("../controllers/superAdminController");
const { protect, permit } = require("../middleware/auth");

router.use(protect, permit("SUPER_ADMIN", "SUPER_ADMIN_CEO"));
router.get("/dashboard", ctrl.dashboard);
router.route("/companies").get(ctrl.listCompanies).post(ctrl.createCompany);
router.route("/companies/:id").get(ctrl.getCompany).put(ctrl.updateCompany).delete(ctrl.deleteCompany);
router.patch("/companies/:id/status", ctrl.setCompanyStatus);

module.exports = router;
