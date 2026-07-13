const router = require("express").Router();
const ctrl = require("../controllers/dealerStockExchangeController");
const { protect, permit } = require("../middleware/auth");

router.use(ctrl.enabled, protect, permit("PRODUCT_DELIVERY_MANAGER", "ADMIN_CEO", "ADMIN"));
router.get("/", ctrl.adminRequests);
router.patch("/:id/manager-approve", ctrl.managerApprove);
router.patch("/:id/manager-reject", ctrl.managerReject);

module.exports = router;
