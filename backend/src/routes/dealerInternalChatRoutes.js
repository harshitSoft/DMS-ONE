const router = require("express").Router();
const ctrl = require("../controllers/dealerInternalChatController");
const { protect, permit } = require("../middleware/auth");

router.use(protect, permit("DEALER", "DEALER_CEO", "DEALER_STOCK_INVENTORY_MANAGER", "DEALER_STOCK_DELIVERY_MANAGER", "DEALER_SALES_FINANCE_MANAGER"));
router.get("/conversations", ctrl.conversations);
router.get("/:userId", ctrl.messages);
router.post("/send", ctrl.send);
router.patch("/:messageId/read", ctrl.markRead);

module.exports = router;
