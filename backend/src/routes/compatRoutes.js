const router = require("express").Router();
const admin = require("../controllers/adminController");
const dealer = require("../controllers/dealerController");
const { protect, permit } = require("../middleware/auth");
const { productImageUpload, invoiceUpload } = require("../middleware/upload");

router.post("/products", protect, permit("ADMIN"), productImageUpload.single("image"), admin.createProduct);
router.get("/products", protect, permit("ADMIN"), admin.products);

router.post("/orders", protect, permit("DEALER"), dealer.createOrder);
router.get("/orders/:id/stock-check", protect, permit("ADMIN"), admin.stockCheck);

router.get("/delivery/admin", protect, permit("ADMIN"), admin.delivery);
router.get("/delivery/dealer", protect, permit("DEALER"), dealer.delivery);
router.patch("/delivery/:orderId/status", protect, permit("ADMIN"), admin.updateOrderStatus);

router.get("/finance/admin/approved-orders", protect, permit("ADMIN"), admin.approvedOrdersForPayment);
router.post("/finance/admin/send-payment-request/:orderId", protect, permit("ADMIN"), invoiceUpload.single("invoice"), admin.sendPaymentRequest);
router.get("/finance/admin/payments", protect, permit("ADMIN"), admin.financeSummary);
router.get("/finance/dealer/payments", protect, permit("DEALER"), dealer.finance);
router.post("/finance/dealer/pay/:paymentId", protect, permit("DEALER"), dealer.pay);

router.get("/messages/admin/conversations", protect, permit("ADMIN"), admin.adminConversations);
router.get("/messages/dealer/conversation", protect, permit("DEALER"), dealer.conversation);
router.post("/messages/admin/send", protect, permit("ADMIN"), admin.messages);
router.post("/messages/dealer/reply", protect, permit("DEALER"), dealer.reply);
router.post("/messages/stock-request", protect, permit("DEALER"), dealer.stockRequest);
router.put("/messages/read/:conversationId", protect, admin.markConversationRead);

module.exports = router;
