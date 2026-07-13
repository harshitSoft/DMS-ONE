const router = require("express").Router();
const ctrl = require("../controllers/dealerStockExchangeController");
const { protect, permit } = require("../middleware/auth");

router.use(ctrl.enabled, protect, permit("ADMIN_CEO", "ADMIN"));
router.get("/", ctrl.adminCeoRequests);
router.patch("/:id/final-approve", ctrl.finalApprove);
router.patch("/:id/final-reject", ctrl.finalReject);

module.exports = router;
