const { Op, fn, col } = require("sequelize");
const asyncHandler = require("../utils/asyncHandler");
const {
  AdminInternalMessage,
  AdminPinnedMessage,
  Company,
  CompanyLicense,
  CreditRedemption,
  CreditReward,
  Dealer,
  DealerCreditWallet,
  DealerSale,
  LicensePlan,
  LicensePurchaseRequest,
  Message,
  Order,
  OrderItem,
  Payment,
  Product,
  ProductVariant,
  CompanyInventory,
  User
} = require("../models");
const { licenseCapacity } = require("../utils/licenseService");
const { hasAdminManagers } = require("../utils/managerAssignment");

const adminManagerRoles = ["DEALER_MANAGER", "PRODUCT_DELIVERY_MANAGER", "FINANCE_MANAGER"];
const orgRoles = ["ADMIN_CEO", "ADMIN", ...adminManagerRoles];

function publicManager(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status, createdAt: user.createdAt };
}

async function companySummary(companyId) {
  const [company, dealerCount, products, orders, payments, wallets, rewards, redemptions] = await Promise.all([
    Company.findByPk(companyId),
    Dealer.count({ where: { companyId } }),
    Product.count({ where: { companyId } }),
    Order.findAll({ where: { companyId }, attributes: ["status", "totalAmount", "deliveryDate", "createdAt"] }),
    Payment.findAll({ where: { companyId }, attributes: ["amount", "paymentStatus", "paymentMethod", "createdAt", "paidAt"] }),
    DealerCreditWallet.findAll({ where: { companyId } }),
    CreditReward.findAll({ where: { companyId } }),
    CreditRedemption.findAll({ where: { companyId } })
  ]);
  const sum = (rows, key) => rows.reduce((total, row) => total + Number(row[key] || 0), 0);
  return {
    company,
    totals: {
      dealers: dealerCount,
      products,
      orders: orders.length,
      revenue: sum(payments.filter((payment) => payment.paymentStatus === "paid"), "amount"),
      paidAmount: sum(payments.filter((payment) => payment.paymentStatus === "paid"), "amount"),
      unpaidAmount: sum(payments.filter((payment) => payment.paymentStatus === "pending"), "amount"),
      creditOutstanding: wallets.reduce((total, wallet) => total + Number(wallet.balance || 0), 0),
      rewards: rewards.length,
      pendingRedemptions: redemptions.filter((row) => row.status === "PENDING").length
    },
    orderStatus: orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {})
  };
}

exports.dashboard = asyncHandler(async (req, res) => {
  res.json(await companySummary(req.user.companyId));
});

exports.dealersOverview = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const [dealers, orders, sales, payments, wallets] = await Promise.all([
    Dealer.findAll({ where: { companyId }, order: [["createdAt", "DESC"]] }),
    Order.findAll({ where: { companyId }, attributes: ["dealerId", "totalAmount", "status"] }),
    DealerSale.findAll({ where: { companyId }, attributes: ["dealerId", "quantitySold"] }),
    Payment.findAll({ where: { companyId }, attributes: ["dealerId", "amount", "paymentStatus"] }),
    DealerCreditWallet.findAll({ where: { companyId } })
  ]);
  const byDealer = (rows, key, filter = () => true) => rows.filter(filter).reduce((acc, row) => {
    acc[row.dealerId] = (acc[row.dealerId] || 0) + Number(row[key] || 0);
    return acc;
  }, {});
  const orderCounts = orders.reduce((acc, row) => {
    acc[row.dealerId] = (acc[row.dealerId] || 0) + 1;
    return acc;
  }, {});
  const salesCounts = byDealer(sales, "quantitySold");
  const pendingPayments = byDealer(payments, "amount", (row) => row.paymentStatus === "pending");
  const walletMap = Object.fromEntries(wallets.map((wallet) => [wallet.dealerId, Number(wallet.balance || 0)]));
  const cityCounts = dealers.reduce((acc, dealer) => {
    const key = dealer.city || "Unassigned";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const areaCounts = dealers.reduce((acc, dealer) => {
    const key = dealer.area || "Unassigned";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const rows = dealers.map((dealer) => ({
    ...dealer.toJSON(),
    totalOrders: orderCounts[dealer.id] || 0,
    totalSales: salesCounts[dealer.id] || 0,
    pendingPayment: pendingPayments[dealer.id] || 0,
    creditBalance: walletMap[dealer.id] || 0
  }));
  res.json({
    stats: {
      totalDealers: dealers.length,
      activeDealers: dealers.filter((dealer) => dealer.status === "active").length,
      blockedDealers: dealers.filter((dealer) => dealer.status === "blocked").length,
      topPerformingDealers: rows.slice().sort((a, b) => b.totalSales - a.totalSales).slice(0, 5)
    },
    cityCounts,
    areaCounts,
    dealers: rows
  });
});

exports.licenseOverview = asyncHandler(async (req, res) => {
  const license = await licenseCapacity(req.user.companyId);
  const gold = license.licenses.filter((row) => row.LicensePlan?.name === "Gold").reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const platinum = license.licenses.filter((row) => row.LicensePlan?.name === "Platinum").reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  res.json({ ...license, goldLicenses: gold, platinumLicenses: platinum, usagePercent: license.capacity ? Math.round((license.dealerCount / license.capacity) * 100) : 0 });
});

exports.productOverview = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const [products, sales] = await Promise.all([
    Product.findAll({ where: { companyId }, include: [{ model: CompanyInventory }, { model: ProductVariant, as: "variants" }], order: [["createdAt", "DESC"]] }),
    DealerSale.findAll({ where: { companyId }, include: [Product] })
  ]);
  const salesByProduct = {};
  sales.forEach((sale) => {
    salesByProduct[sale.productId] = salesByProduct[sale.productId] || { soldQuantity: 0, revenue: 0 };
    salesByProduct[sale.productId].soldQuantity += Number(sale.quantitySold || 0);
    salesByProduct[sale.productId].revenue += Number(sale.quantitySold || 0) * Number(sale.Product?.price || 0);
  });
  const rows = products.map((product) => ({
    ...product.toJSON(),
    stock: Number(product.CompanyInventory?.quantity || 0),
    soldQuantity: salesByProduct[product.id]?.soldQuantity || 0,
    revenue: salesByProduct[product.id]?.revenue || 0
  }));
  res.json({
    stats: {
      totalProducts: products.length,
      activeProducts: products.filter((product) => product.status === "active").length,
      totalStock: rows.reduce((sum, row) => sum + row.stock, 0),
      lowStockProducts: rows.filter((row) => row.stock <= Number(row.CompanyInventory?.lowStockLimit || 0)).length
    },
    topSellingProducts: rows.slice().sort((a, b) => b.soldQuantity - a.soldQuantity).slice(0, 5),
    lowSellingProducts: rows.slice().sort((a, b) => a.soldQuantity - b.soldQuantity).slice(0, 8),
    products: rows
  });
});

exports.orderOverview = asyncHandler(async (req, res) => {
  const orders = await Order.findAll({ where: { companyId: req.user.companyId }, include: [Dealer, { model: OrderItem, as: "items", include: [Product, ProductVariant] }], order: [["createdAt", "DESC"]] });
  const statusCounts = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {});
  res.json({ statusCounts, recentOrders: orders.slice(0, 30), priorityOrders: orders.filter((order) => order.status === "pending").slice(0, 10) });
});

exports.deliveryOverview = asyncHandler(async (req, res) => {
  const orders = await Order.findAll({ where: { companyId: req.user.companyId, status: { [Op.in]: ["approved", "packing", "shipping", "out_for_delivery", "delivered"] } }, include: [Dealer, { model: OrderItem, as: "items", include: [Product, ProductVariant] }], order: [["deliveryDate", "ASC"], ["updatedAt", "DESC"]] });
  const today = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  res.json({
    stats: {
      activeDeliveries: orders.filter((order) => order.status !== "delivered").length,
      deliveredDeliveries: orders.filter((order) => order.status === "delivered").length,
      delayedDeliveries: orders.filter((order) => order.deliveryDate && order.deliveryDate < today && order.status !== "delivered").length,
      dueToday: orders.filter((order) => order.deliveryDate === today).length,
      dueThisWeek: orders.filter((order) => order.deliveryDate && order.deliveryDate >= today && order.deliveryDate <= weekEnd).length
    },
    deliveries: orders
  });
});

exports.financeOverview = asyncHandler(async (req, res) => {
  const payments = await Payment.findAll({ where: { companyId: req.user.companyId }, include: [Dealer, Order], order: [["createdAt", "DESC"]] });
  const age = (payment) => Math.floor((Date.now() - new Date(payment.createdAt).getTime()) / 86400000);
  const sum = (rows) => rows.reduce((total, payment) => total + Number(payment.amount || 0), 0);
  res.json({
    stats: {
      totalRevenue: sum(payments.filter((payment) => payment.paymentStatus === "paid")),
      paidAmount: sum(payments.filter((payment) => payment.paymentStatus === "paid")),
      unpaidAmount: sum(payments.filter((payment) => payment.paymentStatus === "pending")),
      pendingInvoices: payments.filter((payment) => payment.paymentStatus === "pending").length,
      overduePayments: payments.filter((payment) => payment.paymentStatus === "pending" && age(payment) > 7).length,
      cashPayments: payments.filter((payment) => payment.paymentMethod === "cash").length,
      onlinePayments: payments.filter((payment) => payment.paymentMethod === "online").length
    },
    aging: {
      "0-7": payments.filter((payment) => payment.paymentStatus === "pending" && age(payment) <= 7).length,
      "8-15": payments.filter((payment) => payment.paymentStatus === "pending" && age(payment) > 7 && age(payment) <= 15).length,
      "15+": payments.filter((payment) => payment.paymentStatus === "pending" && age(payment) > 15).length
    },
    payments
  });
});

exports.creditOverview = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const [wallets, rewards, redemptions] = await Promise.all([
    DealerCreditWallet.findAll({ where: { companyId }, include: [Dealer], order: [["balance", "DESC"]] }),
    CreditReward.findAll({ where: { companyId }, order: [["createdAt", "DESC"]] }),
    CreditRedemption.findAll({ where: { companyId }, include: [{ model: CreditReward, as: "reward" }, Dealer], order: [["createdAt", "DESC"]] })
  ]);
  res.json({
    stats: {
      totalCoinsIssued: wallets.reduce((sum, wallet) => sum + Number(wallet.totalEarned || 0), 0),
      totalCoinsRedeemed: wallets.reduce((sum, wallet) => sum + Number(wallet.totalRedeemed || 0), 0),
      outstandingBalance: wallets.reduce((sum, wallet) => sum + Number(wallet.balance || 0), 0),
      totalRewards: rewards.length,
      pendingRedemptions: redemptions.filter((row) => row.status === "PENDING").length,
      providedRewards: redemptions.filter((row) => row.status === "PROVIDED").length
    },
    wallets,
    rewards,
    redemptions
  });
});

exports.managerPerformance = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const managers = await User.findAll({ where: { companyId, role: adminManagerRoles }, attributes: ["id", "name", "email", "role", "status", "updatedAt", "createdAt"] });
  const rows = await Promise.all(managers.map(async (manager) => {
    const [messagesSent, pinnedAssigned] = await Promise.all([
      AdminInternalMessage.count({ where: { companyId, senderId: manager.id } }),
      AdminPinnedMessage.count({ where: { companyId, [Op.or]: [{ assignedTo: manager.id }, { roleTarget: manager.role }] } })
    ]);
    return {
      ...publicManager(manager),
      actionsCount: messagesSent,
      pinnedTasks: pinnedAssigned,
      recentActivity: messagesSent ? "Internal team communication" : "No tracked activity yet",
      lastLogin: null
    };
  }));
  res.json(rows);
});

exports.createManager = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, status = "active" } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ message: "Name, email, password and role are required" });
  if (!adminManagerRoles.includes(role)) return res.status(400).json({ message: "Invalid manager role" });
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await User.findOne({ where: { email: normalizedEmail } });
  if (existing) return res.status(409).json({ message: "Email already exists" });
  const manager = await User.create({ name, email: normalizedEmail, phone: phone || null, password, role, status, companyId: req.user.companyId });
  res.status(201).json(publicManager(manager));
});

exports.managers = asyncHandler(async (req, res) => {
  const managers = await User.findAll({ where: { companyId: req.user.companyId, role: adminManagerRoles }, order: [["createdAt", "DESC"]] });
  res.json(managers.map(publicManager));
});

exports.managerExists = asyncHandler(async (req, res) => {
  res.json({ exists: await hasAdminManagers(req.user.companyId) });
});

exports.updateManagerStatus = asyncHandler(async (req, res) => {
  const manager = await User.findOne({ where: { id: req.params.id, companyId: req.user.companyId, role: adminManagerRoles } });
  if (!manager) return res.status(404).json({ message: "Manager not found" });
  await manager.update({ status: req.body.status || (manager.status === "active" ? "inactive" : "active") });
  res.json(publicManager(manager));
});

exports.updateManager = asyncHandler(async (req, res) => {
  const manager = await User.findOne({ where: { id: req.params.id, companyId: req.user.companyId, role: adminManagerRoles } });
  if (!manager) return res.status(404).json({ message: "Manager not found" });
  const updates = {};
  ["name", "phone", "status"].forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });
  if (req.body.role) {
    if (!adminManagerRoles.includes(req.body.role)) return res.status(400).json({ message: "Invalid manager role" });
    updates.role = req.body.role;
  }
  await manager.update(updates);
  res.json(publicManager(manager));
});

exports.deleteManager = asyncHandler(async (req, res) => {
  const manager = await User.findOne({ where: { id: req.params.id, companyId: req.user.companyId, role: adminManagerRoles } });
  if (!manager) return res.status(404).json({ message: "Manager not found" });
  await manager.update({ status: "inactive" });
  res.json({ message: "Manager disabled" });
});

exports.suspendDealer = asyncHandler(async (req, res) => {
  const dealer = await Dealer.findOne({ where: { id: req.params.id, companyId: req.user.companyId } });
  if (!dealer) return res.status(404).json({ message: "Dealer not found" });
  await dealer.update({ status: "blocked" });
  await User.update({ status: "inactive" }, { where: { companyId: req.user.companyId, dealerId: dealer.id } });
  res.json({ message: "Dealer suspended", dealer });
});

exports.reactivateDealer = asyncHandler(async (req, res) => {
  const dealer = await Dealer.findOne({ where: { id: req.params.id, companyId: req.user.companyId } });
  if (!dealer) return res.status(404).json({ message: "Dealer not found" });
  await dealer.update({ status: "active" });
  await User.update({ status: "active" }, { where: { companyId: req.user.companyId, dealerId: dealer.id } });
  res.json({ message: "Dealer reactivated", dealer });
});

exports.disbandProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ where: { id: req.params.id, companyId: req.user.companyId } });
  if (!product) return res.status(404).json({ message: "Product not found" });
  await product.update({ status: "inactive" });
  await ProductVariant.update({ status: "inactive" }, { where: { companyId: req.user.companyId, productId: product.id } });
  res.json({ message: "Product deactivated", product });
});

exports.reactivateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ where: { id: req.params.id, companyId: req.user.companyId } });
  if (!product) return res.status(404).json({ message: "Product not found" });
  await product.update({ status: "active" });
  await ProductVariant.update({ status: "active" }, { where: { companyId: req.user.companyId, productId: product.id } });
  res.json({ message: "Product reactivated", product });
});

exports.createPinnedMessage = asyncHandler(async (req, res) => {
  const message = await AdminPinnedMessage.create({
    companyId: req.user.companyId,
    createdBy: req.user.id,
    assignedTo: req.body.assignedTo || null,
    roleTarget: req.body.roleTarget || null,
    title: req.body.title,
    message: req.body.message,
    priority: req.body.priority || "medium",
    isPinned: req.body.isPinned ?? true
  });
  res.status(201).json(message);
});

exports.updatePinnedMessage = asyncHandler(async (req, res) => {
  const message = await AdminPinnedMessage.findOne({ where: { id: req.params.id, companyId: req.user.companyId } });
  if (!message) return res.status(404).json({ message: "Pinned message not found" });
  await message.update({
    assignedTo: req.body.assignedTo ?? message.assignedTo,
    roleTarget: req.body.roleTarget ?? message.roleTarget,
    title: req.body.title ?? message.title,
    message: req.body.message ?? message.message,
    priority: req.body.priority ?? message.priority,
    isPinned: req.body.isPinned ?? message.isPinned
  });
  res.json(message);
});

exports.deletePinnedMessage = asyncHandler(async (req, res) => {
  const message = await AdminPinnedMessage.findOne({ where: { id: req.params.id, companyId: req.user.companyId } });
  if (!message) return res.status(404).json({ message: "Pinned message not found" });
  await message.destroy();
  res.json({ message: "Pinned message deleted" });
});

exports.pinnedMessages = asyncHandler(async (req, res) => {
  const where = req.user.role === "ADMIN_CEO" || req.user.role === "ADMIN"
    ? { companyId: req.user.companyId }
    : {
      companyId: req.user.companyId,
      [Op.or]: [{ assignedTo: req.user.id }, { roleTarget: req.user.role }, { assignedTo: null, roleTarget: null }]
    };
  res.json(await AdminPinnedMessage.findAll({ where, include: [{ model: User, as: "assignee", attributes: ["id", "name", "role"] }], order: [["createdAt", "DESC"]] }));
});

exports.chatConversations = asyncHandler(async (req, res) => {
  const users = await User.findAll({
    where: { companyId: req.user.companyId, role: orgRoles, id: { [Op.ne]: req.user.id }, status: "active" },
    attributes: ["id", "name", "email", "role", "status"],
    order: [["name", "ASC"]]
  });
  res.json(users);
});

exports.chatMessages = asyncHandler(async (req, res) => {
  const otherId = Number(req.params.userId);
  const other = await User.findOne({ where: { id: otherId, companyId: req.user.companyId, role: orgRoles } });
  if (!other) return res.status(404).json({ message: "Team member not found" });
  res.json(await AdminInternalMessage.findAll({
    where: {
      companyId: req.user.companyId,
      [Op.or]: [
        { senderId: req.user.id, receiverId: otherId },
        { senderId: otherId, receiverId: req.user.id }
      ]
    },
    include: [{ model: User, as: "sender", attributes: ["id", "name", "role"] }],
    order: [["createdAt", "ASC"]]
  }));
});

exports.sendChat = asyncHandler(async (req, res) => {
  const receiverId = Number(req.body.receiverId);
  const other = await User.findOne({ where: { id: receiverId, companyId: req.user.companyId, role: orgRoles, status: "active" } });
  if (!other) return res.status(404).json({ message: "Team member not found" });
  if (!req.body.message) return res.status(400).json({ message: "Message is required" });
  const message = await AdminInternalMessage.create({ companyId: req.user.companyId, senderId: req.user.id, receiverId, message: req.body.message });
  res.status(201).json(message);
});

exports.readChat = asyncHandler(async (req, res) => {
  const message = await AdminInternalMessage.findOne({ where: { id: req.params.messageId, companyId: req.user.companyId, receiverId: req.user.id } });
  if (!message) return res.status(404).json({ message: "Message not found" });
  await message.update({ isRead: true });
  res.json(message);
});
