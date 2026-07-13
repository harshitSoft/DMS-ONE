const router = require("express").Router();
const ctrl = require("../controllers/dealerStockExchangeController");
const { protect, permit } = require("../middleware/auth");

router.use(ctrl.enabled, protect, permit("DEALER", "DEALER_CEO", "DEALER_STOCK_INVENTORY_MANAGER", "DEALER_STOCK_DELIVERY_MANAGER"));
router.get("/search", ctrl.search);
router.post("/requests", ctrl.createRequest);
router.get("/requests/sent", ctrl.sentRequests);
router.get("/requests/received", ctrl.receivedRequests);
router.get("/requests/history", ctrl.history);
router.post("/requests/:id/reminder", ctrl.reminder);
router.patch("/requests/:id/cancel", ctrl.cancel);

module.exports = router;
