const router = require("express").Router();
const ctrl = require("../controllers/adminCeoController");
const { protect, permit } = require("../middleware/auth");

router.use(protect, permit("ADMIN", "ADMIN_CEO", "DEALER_MANAGER", "PRODUCT_DELIVERY_MANAGER", "FINANCE_MANAGER"));
router.get("/dashboard", permit("ADMIN", "ADMIN_CEO"), ctrl.dashboard);
router.get("/dealers-overview", permit("ADMIN", "ADMIN_CEO"), ctrl.dealersOverview);
router.get("/product-overview", permit("ADMIN", "ADMIN_CEO"), ctrl.productOverview);
router.get("/order-overview", permit("ADMIN", "ADMIN_CEO"), ctrl.orderOverview);
router.get("/delivery-overview", permit("ADMIN", "ADMIN_CEO"), ctrl.deliveryOverview);
router.get("/finance-overview", permit("ADMIN", "ADMIN_CEO"), ctrl.financeOverview);
router.get("/credit-overview", permit("ADMIN", "ADMIN_CEO"), ctrl.creditOverview);
router.get("/managers", permit("ADMIN", "ADMIN_CEO"), ctrl.managers);
router.get("/manager-exists", permit("ADMIN", "ADMIN_CEO"), ctrl.managerExists);
router.post("/managers", permit("ADMIN", "ADMIN_CEO"), ctrl.createManager);
router.patch("/managers/:id/status", permit("ADMIN", "ADMIN_CEO"), ctrl.updateManagerStatus);
router.put("/managers/:id", permit("ADMIN", "ADMIN_CEO"), ctrl.updateManager);
router.delete("/managers/:id", permit("ADMIN", "ADMIN_CEO"), ctrl.deleteManager);
router.patch("/dealers/:id/suspend", permit("ADMIN", "ADMIN_CEO"), ctrl.suspendDealer);
router.patch("/dealers/:id/reactivate", permit("ADMIN", "ADMIN_CEO"), ctrl.reactivateDealer);
router.patch("/products/:id/disband", permit("ADMIN", "ADMIN_CEO"), ctrl.disbandProduct);
router.patch("/products/:id/reactivate", permit("ADMIN", "ADMIN_CEO"), ctrl.reactivateProduct);
const { chatUpload } = require("../middleware/upload");

router.get("/chat/conversations", ctrl.chatConversations);
router.get("/chat/:userId", ctrl.chatMessages);
router.post("/chat/send", chatUpload.single("attachment"), ctrl.sendChat);
router.put("/chat/:messageId", ctrl.editChat);
router.delete("/chat/:messageId", ctrl.deleteChat);
router.patch("/chat/:messageId/read", ctrl.readChat);

module.exports = router;
