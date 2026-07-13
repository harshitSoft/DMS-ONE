const { Op } = require("sequelize");
const {
  sequelize,
  Dealer,
  Product,
  Order,
  OrderItem,
  Payment,
  Message,
  InternalNotification,
  DealerCreditWallet,
  DealerCreditTransaction
} = require("../models");

async function getOrCreateWallet(companyId, dealerId, transaction) {
  const [wallet] = await DealerCreditWallet.findOrCreate({
    where: { companyId, dealerId },
    defaults: { balance: 0, totalEarned: 0, totalRedeemed: 0 },
    transaction,
    lock: transaction?.LOCK?.UPDATE
  });
  return wallet;
}

async function awardCreditCoinsForOrder(orderId) {
  return sequelize.transaction(async (transaction) => {
    const order = await Order.findByPk(orderId, {
      include: [{ model: OrderItem, as: "items", include: [Product] }],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!order || order.creditAwarded || order.status !== "delivered") return { awarded: false, coins: 0 };

    const paidPayment = await Payment.findOne({
      where: { companyId: order.companyId, dealerId: order.dealerId, orderId: order.id, paymentStatus: "paid" },
      transaction
    });
    if (!paidPayment) return { awarded: false, coins: 0 };

    const existing = await DealerCreditTransaction.findOne({
      where: { companyId: order.companyId, dealerId: order.dealerId, orderId: order.id, type: "EARN" },
      transaction
    });
    if (existing) {
      await order.update({ creditAwarded: true, creditAwardedAt: order.creditAwardedAt || new Date() }, { transaction });
      return { awarded: false, coins: 0 };
    }

    const earnableItems = (order.items || []).map((item) => {
      const coins = Number(item.creditCoinsEarned || 0) || Number(item.Product?.creditCoins || 0) * Number(item.quantity || 0);
      return { item, coins };
    }).filter((row) => row.coins > 0);
    const totalCoins = earnableItems.reduce((sum, row) => sum + row.coins, 0);
    if (!totalCoins) {
      await order.update({ creditAwarded: true, creditAwardedAt: new Date() }, { transaction });
      return { awarded: false, coins: 0 };
    }

    const wallet = await getOrCreateWallet(order.companyId, order.dealerId, transaction);
    await wallet.reload({ transaction, lock: transaction.LOCK.UPDATE });
    let runningBalance = Number(wallet.balance || 0);
    for (const { item, coins } of earnableItems) {
      const before = runningBalance;
      runningBalance += coins;
      await DealerCreditTransaction.create({
        companyId: order.companyId,
        dealerId: order.dealerId,
        orderId: order.id,
        orderItemId: item.id,
        type: "EARN",
        coins,
        balanceBefore: before,
        balanceAfter: runningBalance,
        description: `Credit coins earned for order #${order.orderNumber}`
      }, { transaction });
    }
    await wallet.update({
      balance: runningBalance,
      totalEarned: Number(wallet.totalEarned || 0) + totalCoins
    }, { transaction });
    await order.update({ creditAwarded: true, creditAwardedAt: new Date() }, { transaction });
    await InternalNotification.create({
      companyId: order.companyId,
      dealerId: order.dealerId,
      roleTarget: "DEALER",
      title: "Credit coins earned",
      message: `Credit coins earned for order #${order.orderNumber}: ${totalCoins} coins.`,
      type: "GENERAL",
      priority: "MEDIUM",
      metadata: { orderId: order.id, coins: totalCoins }
    }, { transaction });
    await Message.create({
      companyId: order.companyId,
      senderId: order.approvedBy || 1,
      receiverId: null,
      dealerId: order.dealerId,
      conversationId: `${order.companyId}-${order.dealerId}`,
      title: "Credit coins earned",
      message: `Credit coins earned for order #${order.orderNumber}: ${totalCoins} coins.`,
      messageType: "credit_earned",
      orderNumber: order.orderNumber,
      isRead: false
    }, { transaction });
    return { awarded: true, coins: totalCoins };
  });
}

async function awardCreditCoinsForPayment(paymentId) {
  return sequelize.transaction(async (transaction) => {
    const payment = await Payment.findByPk(paymentId, {
      include: [{ model: Order, include: [{ model: OrderItem, as: "items", include: [Product] }] }],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!payment || payment.paymentStatus !== "paid" || payment.creditAwarded) return { awarded: false, coins: 0 };
    const order = payment.Order;
    if (!order || !["approved", "packing", "shipping", "out_for_delivery", "delivered"].includes(order.status)) return { awarded: false, coins: 0 };

    const existing = await DealerCreditTransaction.findOne({
      where: { companyId: payment.companyId, dealerId: payment.dealerId, orderId: payment.orderId, type: "EARN" },
      transaction
    });
    if (existing) {
      await payment.update({ creditAwarded: true, creditAwardedAt: payment.creditAwardedAt || new Date() }, { transaction });
      await order.update({ creditAwarded: true, creditAwardedAt: order.creditAwardedAt || new Date() }, { transaction });
      return { awarded: false, coins: 0 };
    }

    const earnableItems = (order.items || []).map((item) => {
      const coins = Number(item.creditCoinsEarned || 0) || Number(item.Product?.creditCoins || 0) * Number(item.quantity || 0);
      return { item, coins };
    }).filter((row) => row.coins > 0);
    const totalCoins = earnableItems.reduce((sum, row) => sum + row.coins, 0);
    if (!totalCoins) {
      await payment.update({ creditAwarded: true, creditAwardedAt: new Date() }, { transaction });
      await order.update({ creditAwarded: true, creditAwardedAt: new Date() }, { transaction });
      return { awarded: false, coins: 0 };
    }

    const wallet = await getOrCreateWallet(payment.companyId, payment.dealerId, transaction);
    await wallet.reload({ transaction, lock: transaction.LOCK.UPDATE });
    let runningBalance = Number(wallet.balance || 0);
    for (const { item, coins } of earnableItems) {
      const before = runningBalance;
      runningBalance += coins;
      await DealerCreditTransaction.create({
        companyId: payment.companyId,
        dealerId: payment.dealerId,
        orderId: order.id,
        orderItemId: item.id,
        type: "EARN",
        coins,
        balanceBefore: before,
        balanceAfter: runningBalance,
        description: `Credit coins earned for order #${order.orderNumber}`
      }, { transaction });
    }
    await wallet.update({
      balance: runningBalance,
      totalEarned: Number(wallet.totalEarned || 0) + totalCoins
    }, { transaction });
    await payment.update({ creditAwarded: true, creditAwardedAt: new Date() }, { transaction });
    await order.update({ creditAwarded: true, creditAwardedAt: new Date() }, { transaction });
    await InternalNotification.create({
      companyId: payment.companyId,
      dealerId: payment.dealerId,
      roleTarget: "DEALER",
      title: "Credit coins earned",
      message: `You earned ${totalCoins} credit coins for order #${order.orderNumber}.`,
      type: "GENERAL",
      priority: "MEDIUM",
      metadata: { orderId: order.id, paymentId: payment.id, coins: totalCoins }
    }, { transaction });
    await Message.create({
      companyId: payment.companyId,
      senderId: order.approvedBy || payment.approvedBy || 1,
      receiverId: null,
      dealerId: payment.dealerId,
      conversationId: `${payment.companyId}-${payment.dealerId}`,
      title: "Credit coins earned",
      message: `You earned ${totalCoins} credit coins for order #${order.orderNumber}.`,
      messageType: "system_credit",
      orderNumber: order.orderNumber,
      isRead: false
    }, { transaction });
    return { awarded: true, coins: totalCoins };
  });
}

async function creditStatsForCompany(companyId) {
  const [issued, redeemed, pendingRedemptions, wallets] = await Promise.all([
    DealerCreditTransaction.sum("coins", { where: { companyId, type: "EARN" } }),
    DealerCreditTransaction.sum("coins", { where: { companyId, type: "REDEEM" } }),
    sequelize.models.CreditRedemption?.count?.({ where: { companyId, status: "PENDING" } }) || 0,
    DealerCreditWallet.findAll({ where: { companyId }, include: [Dealer], order: [["balance", "DESC"]], limit: 5 })
  ]);
  return {
    totalCreditCoinsIssued: Number(issued || 0),
    totalCreditCoinsRedeemed: Number(redeemed || 0),
    pendingRewardRedemptions: Number(pendingRedemptions || 0),
    topCreditDealers: wallets.map((wallet) => ({ dealerId: wallet.dealerId, dealerName: wallet.Dealer?.dealerName || `Dealer #${wallet.dealerId}`, balance: wallet.balance, totalEarned: wallet.totalEarned }))
  };
}

function dateWhere(startDate, endDate) {
  if (!startDate && !endDate) return undefined;
  const where = {};
  if (startDate) where[Op.gte] = startDate;
  if (endDate) where[Op.lte] = endDate;
  return where;
}

module.exports = { awardCreditCoinsForOrder, awardCreditCoinsForPayment, getOrCreateWallet, creditStatsForCompany, dateWhere };
