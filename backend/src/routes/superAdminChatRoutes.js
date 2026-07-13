const router = require("express").Router();
const ctrl = require("../controllers/superAdminHierarchyController");
const { protect, permit } = require("../middleware/auth");

router.use(protect, permit("SUPER_ADMIN_CEO", "SUPER_ADMIN_IT_MANAGER", "SUPER_ADMIN_SALES_MANAGER", "SUPER_ADMIN_FINANCE_MANAGER"));
router.get("/conversations", ctrl.chatConversations);
router.get("/:userId", ctrl.chatMessages);
router.post("/send", ctrl.sendChat);
router.patch("/:messageId/read", ctrl.readChat);

module.exports = router;
