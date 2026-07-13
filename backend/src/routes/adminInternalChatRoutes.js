const router = require("express").Router();
const ctrl = require("../controllers/adminCeoController");
const { protect, permit } = require("../middleware/auth");

router.use(protect, permit("ADMIN", "ADMIN_CEO", "DEALER_MANAGER", "PRODUCT_DELIVERY_MANAGER", "FINANCE_MANAGER"));
router.get("/conversations", ctrl.chatConversations);
router.get("/:userId", ctrl.chatMessages);
router.post("/send", ctrl.sendChat);

module.exports = router;
