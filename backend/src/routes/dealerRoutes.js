const router = require("express").Router();
const ctrl = require("../controllers/dealerController");
const { protect, permit } = require("../middleware/auth");
const { hasDealerManagers } = require("../utils/managerAssignment");

const dealerCeo = ["DEALER", "DEALER_CEO"];
const stockRoles = [...dealerCeo, "DEALER_STOCK_INVENTORY_MANAGER", "DEALER_STOCK_DELIVERY_MANAGER"];
const salesFinanceRoles = [...dealerCeo, "DEALER_SALES_FINANCE_MANAGER"];
const allDealerRoles = [...dealerCeo, "DEALER_STOCK_INVENTORY_MANAGER", "DEALER_STOCK_DELIVERY_MANAGER", "DEALER_SALES_FINANCE_MANAGER"];

async function blockDealerCeoAssignedWork(req, res, next) {
  if (!dealerCeo.includes(req.user.role)) return next();
  if (!(await hasDealerManagers(req.user.dealerId))) return next();
  return res.status(403).json({ message: "This action is assigned to your manager." });
}

router.use(protect, permit(...allDealerRoles));
router.get("/dashboard", ctrl.dashboard);
router.get("/stock", permit(...stockRoles), ctrl.availableStock);
router.post("/orders", permit(...stockRoles), blockDealerCeoAssignedWork, ctrl.createOrder);
router.get("/orders", permit(...stockRoles), ctrl.orders);
router.get("/delivery", permit(...stockRoles), ctrl.delivery);
router.get("/inventory", permit(...stockRoles, "DEALER_SALES_FINANCE_MANAGER"), ctrl.inventory);
router.patch("/inventory/:id", permit(...stockRoles), blockDealerCeoAssignedWork, ctrl.updateInventory);
router.patch("/inventory/:id/low-stock-limit", permit(...stockRoles), blockDealerCeoAssignedWork, ctrl.updateLowStockLimit);
router.get("/sales", permit(...salesFinanceRoles), ctrl.sales);
router.post("/sales", permit(...salesFinanceRoles), blockDealerCeoAssignedWork, ctrl.createSale);
router.get("/finance", permit(...salesFinanceRoles), ctrl.finance);
router.get("/finance/payments", permit(...salesFinanceRoles), ctrl.finance);
router.post("/finance/pay/:paymentId", permit(...salesFinanceRoles), blockDealerCeoAssignedWork, ctrl.pay);
router.get("/credit/wallet", permit(...dealerCeo), ctrl.creditWallet);
router.get("/credit/store", permit(...dealerCeo), ctrl.creditStore);
router.post("/credit/redeem/:rewardId", permit(...dealerCeo), ctrl.redeemCreditReward);
router.get("/credit/redemptions", permit(...dealerCeo), ctrl.creditRedemptions);
router.get("/credit/transactions", permit(...dealerCeo), ctrl.creditTransactions);
router.get("/policies", permit(...dealerCeo), ctrl.policies);
router.get("/messages", permit(...dealerCeo), ctrl.messages);
router.get("/messages/conversation", permit(...dealerCeo), ctrl.conversation);
router.post("/messages/reply", permit(...dealerCeo), ctrl.reply);
router.post("/messages/stock-request", permit(...dealerCeo), ctrl.stockRequest);
router.post("/reports", ctrl.createReport);

module.exports = router;
