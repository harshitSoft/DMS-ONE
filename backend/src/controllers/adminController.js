const { Op, fn, col, literal } = require("sequelize");
const asyncHandler = require("../utils/asyncHandler");
const {
  Company,
  Dealer,
  User,
  Product,
  ProductVariant,
  CompanyInventory,
  DealerInventory,
  DealerSale,
  InternalNotification,
  Order,
  OrderItem,
  DeliveryTracking,
  Payment,
  Policy,
  Message,
  OrderScheduledMessage,
  Report,
  DealerCreditWallet,
  DealerCreditTransaction,
  CreditReward,
  CreditRedemption,
  LicensePlan,
  LicensePurchaseRequest
} = require("../models");
const { publicPath } = require("../middleware/upload");
const { progressForStatus, activeDeliveryStep, daysUntil } = require("../utils/delivery");
const { awardCreditCoinsForOrder, creditStatsForCompany, getOrCreateWallet, dateWhere } = require("../utils/credit");
const { licenseCapacity } = require("../utils/licenseService");
const { licenseSystemEnabled } = require("../utils/featureFlags");

const companyScope = (req) => ({ companyId: req.user.companyId });

function skuPart(value, fallback = "GEN") {
  return String(value || fallback)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 12) || fallback;
}

function randomDigits(length) {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

async function generateProductSku({ productName, company, category, manufacturingDate, companyId }, transaction) {
  const year = manufacturingDate ? new Date(manufacturingDate).getFullYear() : new Date().getFullYear();
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const companyPart = skuPart(company?.category || company?.companyName, "COMP");
  const categoryPart = skuPart(category, "CAT");
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const sku = `${skuPart(productName, "PRODUCT")}${randomDigits(6)}${companyPart}${categoryPart}${safeYear}`;
    const exists = await Product.findOne({ where: { companyId, sku }, transaction });
    if (!exists) return sku;
  }
  return `${skuPart(productName, "PRODUCT")}${Date.now()}${companyPart}${categoryPart}${safeYear}`;
}

function generateVariantSuffix(row) {
  return `${skuPart(row.variantName, "VAR")}${randomDigits(4)}${skuPart(row.colorName, "COLOR")}${randomDigits(3)}`;
}

function normalizeVariantRows(rows, fallbackQuantity = 0) {
  const source = rows.length ? rows : [{ variantName: "Standard", colorName: "Default", stockQuantity: Number(fallbackQuantity || 0), priceOverride: null }];
  const seen = new Set();
  return source.map((row) => {
    const variantName = String(row.variantName || "Standard").trim();
    const colorName = String(row.colorName || "Default").trim();
    const key = `${variantName.toLowerCase()}::${colorName.toLowerCase()}`;
    if (seen.has(key)) {
      const error = new Error(`Variant ${variantName} / ${colorName} already exists for this product.`);
      error.status = 409;
      throw error;
    }
    seen.add(key);
    return { ...row, variantName, colorName };
  });
}

function assertNoDuplicateVariantSkuSuffix(rows) {
  const seen = new Set();
  for (const row of rows) {
    if (!row.skuSuffix) continue;
    const key = String(row.skuSuffix).trim().toUpperCase();
    if (seen.has(key)) {
      const error = new Error(`Variant SKU suffix ${row.skuSuffix} already exists for this product.`);
      error.status = 409;
      throw error;
    }
    seen.add(key);
  }
}

function timestampDateWhere(startDate, endDate) {
  if (!startDate && !endDate) return undefined;
  const where = {};
  if (startDate) where[Op.gte] = new Date(`${startDate}T00:00:00`);
  if (endDate) where[Op.lte] = new Date(`${endDate}T23:59:59.999`);
  return where;
}

function productSummary(items = []) {
  return items.map((item) => {
    const variant = item.variantName ? ` - ${item.variantName}/${item.colorName || "Default"}` : "";
    return `${item.Product?.productName || `Product #${item.productId}`}${variant} x ${item.quantity} = ${item.subtotal}`;
  }).join("; ");
}

function daysUnpaid(payment) {
  if (payment.paymentStatus === "paid") return 0;
  const start = payment.orderApprovedAt || payment.paymentRequestSentAt || payment.createdAt;
  if (!start) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(start).getTime()) / 86400000));
}

function withFinanceMeta(payment) {
  const json = payment.toJSON ? payment.toJSON() : payment;
  return { ...json, daysUnpaid: daysUnpaid(json) };
}

async function createInvoiceForApprovedOrder(order, userId, transaction) {
  const orderWithItems = order.items ? order : await Order.findByPk(order.id, { include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }], transaction });
  const invoiceNumber = `INV-${orderWithItems.orderNumber || orderWithItems.id}`;
  const [payment, created] = await Payment.findOrCreate({
    where: { companyId: orderWithItems.companyId, orderId: orderWithItems.id },
    defaults: {
      companyId: orderWithItems.companyId,
      dealerId: orderWithItems.dealerId,
      orderId: orderWithItems.id,
      invoiceNumber,
      orderNumber: orderWithItems.orderNumber,
      productSummary: productSummary(orderWithItems.items || []),
      invoiceStatus: "generated",
      orderApprovedAt: orderWithItems.approvedAt || new Date(),
      amount: orderWithItems.totalAmount,
      paymentMethod: null,
      paymentStatus: "pending",
      paymentRequestSentAt: new Date(),
      approvedBy: userId
    },
    transaction
  });
  if (!created) {
    await payment.update({
      invoiceNumber: payment.invoiceNumber || invoiceNumber,
      orderNumber: payment.orderNumber || orderWithItems.orderNumber,
      productSummary: productSummary(orderWithItems.items || []),
      invoiceStatus: payment.invoiceStatus || "generated",
      orderApprovedAt: payment.orderApprovedAt || orderWithItems.approvedAt || new Date(),
      amount: orderWithItems.totalAmount,
      approvedBy: payment.approvedBy || userId
    }, { transaction });
  }
  const messageText = `Invoice ${payment.invoiceNumber || invoiceNumber} generated for order #${orderWithItems.orderNumber}. Amount: ${orderWithItems.totalAmount}.`;
  await Message.findOrCreate({
    where: { companyId: orderWithItems.companyId, dealerId: orderWithItems.dealerId, orderNumber: orderWithItems.orderNumber, messageType: "system_finance", message: messageText },
    defaults: {
      senderId: userId,
      receiverId: null,
      conversationId: `${orderWithItems.companyId}-${orderWithItems.dealerId}`,
      title: "Invoice generated",
      message: messageText,
      isRead: false
    },
    transaction
  });
  return payment;
}

async function stockCheckForOrder(order) {
  const items = [];
  let canApprove = true;
  for (const item of order.items || []) {
    const variant = item.productVariantId ? await ProductVariant.findOne({ where: { id: item.productVariantId, companyId: order.companyId, productId: item.productId } }) : null;
    const inventory = variant ? null : await CompanyInventory.findOne({ where: { companyId: order.companyId, productId: item.productId } });
    const availableStock = Number(variant ? variant.stockQuantity : inventory?.quantity || 0);
    const requestedQuantity = Number(item.quantity || 0);
    const status = availableStock >= requestedQuantity ? (availableStock <= Number(inventory?.lowStockLimit || 0) ? "Low Stock" : "Available") : "Not Enough Stock";
    if (status === "Not Enough Stock") canApprove = false;
    items.push({
      productId: item.productId,
      productVariantId: item.productVariantId,
      productName: item.Product?.productName,
      variantName: item.variantName,
      colorName: item.colorName,
      requestedQuantity,
      availableStock,
      status
    });
  }
  return { canApprove, items };
}

exports.dashboard = asyncHandler(async (req, res) => {
  res.json(await exports.dashboardData(req.user.companyId));
});

exports.analytics = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const statuses = ["pending", "approved", "packing", "shipping", "out_for_delivery", "delivered", "rejected"];
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const period = ["today", "week", "month", "custom"].includes(req.query.period) ? req.query.period : "current";
  let startDate = req.query.startDate || null;
  let endDate = req.query.endDate || null;
  if (period === "today") startDate = endDate = today;
  if (period === "week") {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    startDate = weekStart.toISOString().slice(0, 10);
    endDate = today;
  }
  if (period === "month") { startDate = monthStart; endDate = today; }
  const activityRange = timestampDateWhere(startDate, endDate);
  const saleRange = dateWhere(startDate, endDate);
  const dealerWhere = { companyId };
  if (req.query.area) dealerWhere.area = req.query.area;
  if (req.query.city) dealerWhere.city = req.query.city;
  if (["active", "inactive", "blocked"].includes(req.query.dealerStatus)) dealerWhere.status = req.query.dealerStatus;
  if (req.query.dealerCreatedStart || req.query.dealerCreatedEnd) dealerWhere.createdAt = timestampDateWhere(req.query.dealerCreatedStart, req.query.dealerCreatedEnd);
  const filteredDealers = await Dealer.findAll({ where: dealerWhere, order: [["dealerName", "ASC"]] });
  const dealerFilterActive = Object.keys(dealerWhere).length > 1;
  const scopedDealerIds = filteredDealers.map((dealer) => dealer.id);
  const dealerScope = dealerFilterActive ? { dealerId: scopedDealerIds.length ? scopedDealerIds : [0] } : {};
  const orderWhere = { companyId, ...dealerScope, ...(activityRange ? { createdAt: activityRange } : {}) };
  const saleWhere = { companyId, ...dealerScope, ...(saleRange ? { saleDate: saleRange } : {}) };
  const [summary, orderCounts, inventory, dealerInventory, payments, dealers, recentOrders, recentPayments, recentMessages, recentDeliveryUpdates, stockRequestMessages, salesRows, todaySalesRows, monthSalesRows, recentLowStockNotifications] = await Promise.all([
    exports.dashboardData(companyId),
    Promise.all(statuses.map(async (status) => ({ status, count: await Order.count({ where: { ...orderWhere, status } }) }))),
    CompanyInventory.findAll({ where: { companyId }, include: [Product], order: [["quantity", "DESC"]] }),
    DealerInventory.findAll({ where: { companyId, ...dealerScope }, include: [Product, ProductVariant], order: [["quantity", "DESC"]] }),
    Payment.findAll({ where: { companyId, ...dealerScope, ...(activityRange ? { createdAt: activityRange } : {}) }, include: [{ model: Order, include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }] }, Dealer], order: [["createdAt", "DESC"]] }),
    Promise.resolve(filteredDealers),
    Order.findAll({ where: orderWhere, include: [{ model: Dealer, attributes: ["id", "dealerName", "area", "city"] }, { model: OrderItem, as: "items", include: [Product, ProductVariant] }], order: [["createdAt", "DESC"]], limit: 5 }),
    Payment.findAll({ where: { companyId }, include: [{ model: Order, include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }] }, Dealer], order: [["createdAt", "DESC"]], limit: 5 }),
    Message.findAll({ where: { companyId }, include: [{ model: User, as: "sender", attributes: ["id", "name", "role"] }], order: [["createdAt", "DESC"]], limit: 5 }),
    DeliveryTracking.findAll({
      include: [{ model: Order, required: true, where: { companyId }, attributes: ["orderNumber", "dealerId"] }],
      order: [["createdAt", "DESC"]],
      limit: 5
    }),
    Message.count({ where: { companyId, messageType: "stock_request" } }),
    DealerSale.findAll({ where: saleWhere, include: [Product, ProductVariant, Dealer], order: [["saleDate", "DESC"], ["createdAt", "DESC"]] }),
    DealerSale.findAll({ where: { companyId, saleDate: today }, attributes: [[fn("SUM", col("quantitySold")), "total"]] }),
    DealerSale.findAll({ where: { companyId, saleDate: { [Op.gte]: monthStart } }, attributes: [[fn("SUM", col("quantitySold")), "total"]] }),
    InternalNotification.findAll({ where: { companyId, type: "LOW_STOCK" }, order: [["createdAt", "DESC"]], limit: 5 })
  ]);

  const sum = (rows, selector) => rows.reduce((total, row) => total + Number(selector(row) || 0), 0);
  const dealerName = (id) => dealers.find((dealer) => dealer.id === id)?.dealerName || `Dealer #${id}`;
  const areaWise = dealers.reduce((acc, dealer) => {
    const key = dealer.area || "Unassigned";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const scopedOrders = await Order.findAll({ where: orderWhere, attributes: ["id", "dealerId", "status", "totalAmount", "createdAt"], include: [{ model: OrderItem, as: "items", attributes: ["quantity"] }] });
  const orderTotals = scopedOrders.reduce((acc, order) => {
    acc[order.dealerId] = (acc[order.dealerId] || 0) + Number(order.totalAmount || 0);
    return acc;
  }, {});
  const orderCountsByDealer = scopedOrders.reduce((acc, order) => {
    acc[order.dealerId] = (acc[order.dealerId] || 0) + 1;
    return acc;
  }, {});
  const pendingPaymentsByDealer = payments.filter((p) => p.paymentStatus === "pending").reduce((acc, payment) => {
    acc[payment.dealerId] = (acc[payment.dealerId] || 0) + Number(payment.amount || 0);
    return acc;
  }, {});
  const stockByDealer = dealerInventory.reduce((acc, item) => {
    acc[item.dealerId] = (acc[item.dealerId] || 0) + Number(item.quantity || 0);
    return acc;
  }, {});
  const salesByProduct = salesRows.reduce((acc, sale) => {
    const key = sale.productId;
    acc[key] = acc[key] || { productId: key, productName: sale.Product?.productName || `Product #${key}`, sku: sale.Product?.sku, quantitySold: 0 };
    acc[key].quantitySold += Number(sale.quantitySold || 0);
    return acc;
  }, {});
  const salesByDealer = salesRows.reduce((acc, sale) => {
    const key = sale.dealerId;
    acc[key] = acc[key] || { dealerId: key, dealerName: sale.Dealer?.dealerName || dealerName(key), quantitySold: 0 };
    acc[key].quantitySold += Number(sale.quantitySold || 0);
    return acc;
  }, {});
  const topDealerRows = dealers.map((dealer) => ({
    dealerId: dealer.id,
    dealerName: dealer.dealerName,
    area: dealer.area,
    city: dealer.city,
    purchaseAmount: orderTotals[dealer.id] || 0,
    salesUnits: salesByDealer[dealer.id]?.quantitySold || 0,
    orderCount: orderCountsByDealer[dealer.id] || 0
  }));
  const topActivityProducts = Object.values(salesByProduct).map((row) => ({
    ...row,
    quantity: Number(inventory.find((item) => Number(item.productId) === Number(row.productId))?.quantity || 0),
    salesQuantity: row.quantitySold
  })).sort((a, b) => b.salesQuantity - a.salesQuantity).slice(0, 5);

  const pendingOrdersForStock = await Order.findAll({ where: { companyId, status: "pending" }, include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }] });
  let notEnoughStockOrders = 0;
  for (const order of pendingOrdersForStock) {
    const stock = await stockCheckForOrder(order);
    if (!stock.canApprove) notEnoughStockOrders += 1;
  }

  res.json({
    summary,
    orderStatusCounts: orderCounts,
    inventoryStats: {
      totalStock: summary.totalCompanyStock,
      lowStockProducts: summary.lowStockProducts,
      selectedMetric: period === "current" ? "Current Stock" : "Units Sold in Selected Period",
      topHighestStockProducts: inventory.slice(0, 5).map((item) => ({ productName: item.Product?.productName, sku: item.Product?.sku, quantity: Number(item.quantity || 0), salesQuantity: Number(salesByProduct[item.productId]?.quantitySold || 0) })),
      topActivityProducts,
      topLowStockProducts: inventory.filter((item) => item.quantity <= item.lowStockLimit).sort((a, b) => a.quantity - b.quantity).slice(0, 5).map((item) => ({ productName: item.Product?.productName, sku: item.Product?.sku, quantity: Number(item.quantity || 0), lowStockLimit: Number(item.lowStockLimit || 0), difference: Number(item.quantity || 0) - Number(item.lowStockLimit || 0), stockStatus: Number(item.quantity || 0) <= 0 ? "Out of Stock" : "Low Stock" })),
      dealerWiseStockSummary: dealers.map((dealer) => ({ dealerId: dealer.id, dealerName: dealer.dealerName, area: dealer.area, city: dealer.city, quantity: stockByDealer[dealer.id] || 0 })).sort((a, b) => b.quantity - a.quantity).slice(0, 5)
    },
    financeStats: {
      totalRevenue: summary.totalRevenue,
      pendingAmount: summary.totalPendingAmount,
      paidAmount: sum(payments.filter((p) => p.paymentStatus === "paid"), (p) => p.amount),
      cashPaymentTotal: sum(payments.filter((p) => p.paymentMethod === "cash"), (p) => p.amount),
      onlinePaymentTotal: sum(payments.filter((p) => p.paymentMethod === "online"), (p) => p.amount),
      paymentStatusRatio: ["pending", "paid", "failed"].map((status) => ({ status, count: payments.filter((p) => p.paymentStatus === status).length })),
      dealerWiseOutstandingPayment: Object.entries(pendingPaymentsByDealer).map(([dealerId, amount]) => ({ dealerId: Number(dealerId), dealerName: dealerName(Number(dealerId)), amount }))
    },
    dealerStats: {
      totalActiveDealers: dealers.filter((dealer) => dealer.status === "active").length,
      blockedDealers: dealers.filter((dealer) => dealer.status === "blocked").length,
      areaWiseDealerCount: Object.entries(areaWise).map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count),
      topDealersByOrderAmount: Object.entries(orderTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([dealerId, amount]) => ({ dealerId: Number(dealerId), dealerName: dealerName(Number(dealerId)), amount })),
      topDealersByPendingPayment: Object.entries(pendingPaymentsByDealer).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([dealerId, amount]) => ({ dealerId: Number(dealerId), dealerName: dealerName(Number(dealerId)), amount })),
      topByPurchase: [...topDealerRows].sort((a, b) => b.purchaseAmount - a.purchaseAmount).slice(0, 5),
      topBySales: [...topDealerRows].sort((a, b) => b.salesUnits - a.salesUnits).slice(0, 5),
      topByOrderCount: [...topDealerRows].sort((a, b) => b.orderCount - a.orderCount).slice(0, 5),
      cities: [...new Set(filteredDealers.map((dealer) => dealer.city).filter(Boolean))],
      areas: [...new Set(filteredDealers.map((dealer) => dealer.area).filter(Boolean))]
    },
    stockRiskStats: {
      notEnoughStockOrders,
      lowStockProducts: summary.lowStockProducts,
      stockRequestMessages,
      dealersWithLowStock: new Set(dealerInventory.filter((item) => item.quantity <= item.lowStockLimit).map((item) => item.dealerId)).size
    },
    salesStats: {
      todayCompanyDealerSales: Number(todaySalesRows[0]?.get("total") || 0),
      monthlyDealerSales: Number(monthSalesRows[0]?.get("total") || 0),
      topSellingProducts: Object.values(salesByProduct).sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 5),
      dealerSalesPerformance: Object.values(salesByDealer).sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 5)
    },
    period: { value: period, startDate, endDate },
    recentOrders: recentOrders.map((order) => ({ ...order.toJSON(), paymentStatus: payments.find((payment) => Number(payment.orderId) === Number(order.id))?.paymentStatus || null })),
    recentPayments,
    recentMessages,
    recentDeliveryUpdates,
    recentLowStockNotifications
  });
});

exports.dashboardData = async (companyId) => {
  const [totalDealers, totalProducts, stockRows, lowStockProducts, pendingOrders, approvedOrders, deliveredOrders, rejectedOrders, pendingPayments, revenueRows, pendingAmountRows] = await Promise.all([
    Dealer.count({ where: { companyId } }),
    Product.count({ where: { companyId } }),
    CompanyInventory.findAll({ where: { companyId }, attributes: [[fn("SUM", col("quantity")), "total"]] }),
    CompanyInventory.count({ where: { companyId, quantity: { [Op.lte]: col("lowStockLimit") } } }),
    Order.count({ where: { companyId, status: "pending" } }),
    Order.count({ where: { companyId, status: "approved" } }),
    Order.count({ where: { companyId, status: "delivered" } }),
    Order.count({ where: { companyId, status: "rejected" } }),
    Payment.count({ where: { companyId, paymentStatus: "pending" } }),
    Payment.findAll({ where: { companyId, paymentStatus: "paid" }, attributes: [[fn("SUM", col("amount")), "total"]] }),
    Payment.findAll({ where: { companyId, paymentStatus: "pending" }, attributes: [[fn("SUM", col("amount")), "total"]] })
  ]);
  return {
    totalDealers,
    totalProducts,
    totalCompanyStock: Number(stockRows[0]?.get("total") || 0),
    lowStockProducts,
    pendingOrders,
    approvedOrders,
    deliveredOrders,
    rejectedOrders,
    pendingPayments,
    totalRevenue: Number(revenueRows[0]?.get("total") || 0),
    totalPendingAmount: Number(pendingAmountRows[0]?.get("total") || 0)
  };
};

exports.company = asyncHandler(async (req, res) => {
  res.json(await Company.findByPk(req.user.companyId));
});

exports.createDealer = asyncHandler(async (req, res) => {
  const { password = "dealer123", ...body } = req.body;
  if (!body.dealerName || !body.ownerName || !body.email) return res.status(400).json({ message: "Dealer name, owner name and email are required" });
  if (licenseSystemEnabled()) {
    const license = await licenseCapacity(req.user.companyId);
    if (license.limitReached) return res.status(403).json({ code: "LICENSE_LIMIT_REACHED", message: "Dealer license capacity has been reached.", licenseStatus: license });
  }
  const existingUser = await User.findOne({ where: { email: body.email } });
  if (existingUser) return res.status(409).json({ message: "A user with this email already exists" });
  const existingDealer = await Dealer.findOne({ where: { companyId: req.user.companyId, email: body.email } });
  if (existingDealer) return res.status(409).json({ message: "A dealer with this email already exists" });
  const result = await User.sequelize.transaction(async (transaction) => {
    const dealer = await Dealer.create({ ...body, companyId: req.user.companyId }, { transaction });
    const user = await User.create({
      name: body.ownerName || body.dealerName,
      email: body.email,
      password,
      role: "DEALER",
      companyId: req.user.companyId,
      dealerId: dealer.id
    }, { transaction });
    return { dealer, user: { id: user.id, email: user.email } };
  });
  res.status(201).json(result);
});

exports.licenseStatus = asyncHandler(async (req, res) => {
  if (!licenseSystemEnabled()) return res.status(410).json({ message: "The license system is no longer active." });
  res.json(await licenseCapacity(req.user.companyId));
});

exports.createLicenseRequest = asyncHandler(async (req, res) => {
  const plan = await LicensePlan.findOne({ where: { id: req.body.licensePlanId, status: "active" } });
  if (!plan) return res.status(404).json({ message: "License plan not found" });
  const quantity = Math.max(1, Number(req.body.quantity || 1));
  const amount = Number(plan.price || 0) * quantity;
  const request = await LicensePurchaseRequest.create({
    companyId: req.user.companyId,
    requestedBy: req.user.id,
    licensePlanId: plan.id,
    quantity,
    totalDealerLimit: Number(plan.dealerLimit || 0) * quantity,
    amount,
    status: "REQUESTED",
    paymentStatus: "PENDING",
    note: req.body.note || null
  });
  res.status(201).json({ message: "Your license request has been sent to the sales team.", request });
});

exports.dealers = asyncHandler(async (req, res) => {
  const hasPaginationQuery = ["page", "limit", "search", "ownerName", "email", "area", "city", "status", "sortBy", "sortOrder", "startDate", "endDate"].some((key) => req.query[key] != null);
  const where = companyScope(req);
  if (req.query.search) where.dealerName = { [Op.like]: `%${String(req.query.search).trim()}%` };
  if (req.query.ownerName) where.ownerName = { [Op.like]: `%${String(req.query.ownerName).trim()}%` };
  if (req.query.email) where.email = { [Op.like]: `%${String(req.query.email).trim()}%` };
  if (req.query.area) where.area = req.query.area;
  if (req.query.city) where.city = req.query.city;
  if (req.query.status) where.status = req.query.status;
  if (req.query.startDate || req.query.endDate) {
    where.createdAt = {};
    if (req.query.startDate) where.createdAt[Op.gte] = new Date(`${req.query.startDate}T00:00:00`);
    if (req.query.endDate) where.createdAt[Op.lte] = new Date(`${req.query.endDate}T23:59:59.999`);
  }
  const sortColumns = { createdAt: "createdAt", dealerName: "dealerName", ownerName: "ownerName", city: "city" };
  const sortBy = sortColumns[req.query.sortBy] || "createdAt";
  const sortOrder = String(req.query.sortOrder || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";
  if (!hasPaginationQuery) return res.json(await Dealer.findAll({ where, order: [[sortBy, sortOrder]] }));

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = [10, 25, 50].includes(Number(req.query.limit)) ? Number(req.query.limit) : 10;
  const { count, rows } = await Dealer.findAndCountAll({
    where,
    attributes: ["id", "dealerName", "ownerName", "email", "phone", "area", "city", "state", "pincode", "address", "status", "createdAt", "updatedAt"],
    order: [[sortBy, sortOrder]], limit, offset: (page - 1) * limit
  });
  const filterScope = companyScope(req);
  const cityScope = { ...filterScope, ...(req.query.area ? { area: req.query.area } : {}) };
  const [areaRows, cityRows] = await Promise.all([
    Dealer.findAll({ where: { ...filterScope, area: { [Op.ne]: null } }, attributes: [[fn("DISTINCT", col("area")), "value"]], order: [["area", "ASC"]] }),
    Dealer.findAll({ where: { ...cityScope, city: { [Op.ne]: null } }, attributes: [[fn("DISTINCT", col("city")), "value"]], order: [["city", "ASC"]] })
  ]);
  const totalPages = Math.max(1, Math.ceil(count / limit));
  res.json({
    dealers: rows,
    pagination: { page, limit, totalItems: count, totalPages, hasNext: page < totalPages, hasPrevious: page > 1 },
    filters: { areas: areaRows.map((row) => row.get("value")).filter(Boolean), cities: cityRows.map((row) => row.get("value")).filter(Boolean) }
  });
});

exports.getDealer = asyncHandler(async (req, res) => {
  const dealer = await Dealer.findOne({ where: { id: req.params.id, ...companyScope(req) } });
  if (!dealer) return res.status(404).json({ message: "Dealer not found" });
  const scope = { companyId: req.user.companyId, dealerId: dealer.id };
  const [orders, pendingPaymentAmount, inventoryItems, lowStockItems, wallet, lastOrderDate] = await Promise.all([
    Order.findAll({ where: scope, attributes: ["status", "totalAmount"] }),
    Payment.sum("amount", { where: { ...scope, paymentStatus: "pending" } }),
    DealerInventory.count({ where: scope }),
    DealerInventory.count({ where: { ...scope, quantity: { [Op.lte]: col("lowStockLimit") } } }),
    DealerCreditWallet.findOne({ where: scope, attributes: ["balance"] }),
    Order.max("createdAt", { where: scope })
  ]);
  const totalPurchaseAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  res.json({
    dealer,
    summary: {
      totalOrders: orders.length,
      approvedOrders: orders.filter((order) => order.status === "approved").length,
      deliveredOrders: orders.filter((order) => order.status === "delivered").length,
      pendingOrders: orders.filter((order) => order.status === "pending").length,
      totalPurchaseAmount,
      pendingPaymentAmount: Number(pendingPaymentAmount || 0),
      currentInventoryItems: inventoryItems,
      lowStockItems,
      creditBalance: Number(wallet?.balance || 0),
      lastOrderDate: lastOrderDate || null
    }
  });
});

exports.updateDealer = asyncHandler(async (req, res) => {
  const dealer = await Dealer.findOne({ where: { id: req.params.id, ...companyScope(req) } });
  if (!dealer) return res.status(404).json({ message: "Dealer not found" });
  const fields = ["dealerName", "ownerName", "email", "phone", "area", "city", "state", "pincode", "address", "status"];
  const updates = fields.reduce((result, field) => {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) result[field] = req.body[field] === "" ? null : req.body[field];
    return result;
  }, {});
  if (updates.email) {
    updates.email = String(updates.email).trim().toLowerCase();
    const duplicateDealer = await Dealer.findOne({ where: { email: updates.email, id: { [Op.ne]: dealer.id } } });
    const duplicateUser = await User.findOne({ where: { email: updates.email, [Op.or]: [{ dealerId: { [Op.ne]: dealer.id } }, { dealerId: null }] } });
    if (duplicateDealer || duplicateUser) return res.status(409).json({ message: "A dealer or user with this email already exists" });
  }
  await User.sequelize.transaction(async (transaction) => {
    await dealer.update(updates, { transaction });
    const userUpdates = {};
    if (updates.ownerName || updates.dealerName) userUpdates.name = updates.ownerName || updates.dealerName;
    if (updates.email) userUpdates.email = updates.email;
    if (Object.prototype.hasOwnProperty.call(updates, "status")) userUpdates.status = updates.status === "active" ? "active" : "inactive";
    if (Object.keys(userUpdates).length) await User.update(userUpdates, { where: { dealerId: dealer.id, companyId: req.user.companyId }, transaction });
  });
  res.json(dealer);
});

exports.setDealerStatus = asyncHandler(async (req, res) => {
  const status = req.body.status;
  if (!["active", "inactive", "blocked"].includes(status)) return res.status(400).json({ message: "Invalid dealer status" });
  const dealer = await Dealer.findOne({ where: { id: req.params.id, ...companyScope(req) } });
  if (!dealer) return res.status(404).json({ message: "Dealer not found" });
  await User.sequelize.transaction(async (transaction) => {
    await dealer.update({ status }, { transaction });
    await User.update({ status: status === "active" ? "active" : "inactive" }, { where: { dealerId: dealer.id, companyId: req.user.companyId }, transaction });
  });
  res.json(dealer);
});

exports.deleteDealer = asyncHandler(async (req, res) => {
  const dealer = await Dealer.findOne({ where: { id: req.params.id, ...companyScope(req) } });
  if (!dealer) return res.status(404).json({ message: "Dealer not found" });
  const dependencyScope = { companyId: req.user.companyId, dealerId: dealer.id };
  const [orders, payments, inventory, sales, creditTransactions] = await Promise.all([
    Order.count({ where: dependencyScope }), Payment.count({ where: dependencyScope }), DealerInventory.count({ where: dependencyScope }),
    DealerSale.count({ where: dependencyScope }), DealerCreditTransaction.count({ where: dependencyScope })
  ]);
  await User.sequelize.transaction(async (transaction) => {
    await dealer.update({ status: "inactive" }, { transaction });
    await User.update({ status: "inactive" }, { where: { dealerId: dealer.id, companyId: req.user.companyId }, transaction });
  });
  res.json({ message: "Dealer safely archived and login disabled", softDeleted: true, dependentRecords: orders + payments + inventory + sales + creditTransactions });
});

exports.createProduct = asyncHandler(async (req, res) => {
  const image = publicPath("products", req.file);
  const variants = JSON.parse(req.body.variants || "[]").filter((row) => row.variantName || row.colorName);
  const creditCoins = Math.max(0, Number(req.body.creditCoins || 0));
  if (variants.some((row) => Number(row.stockQuantity || 0) < 0)) return res.status(400).json({ message: "Stock quantity cannot be negative" });
  const result = await Product.sequelize.transaction(async (transaction) => {
    const company = await Company.findByPk(req.user.companyId, { transaction });
    const sku = await generateProductSku({
      productName: req.body.productName,
      category: req.body.category,
      manufacturingDate: req.body.manufacturingDate,
      company,
      companyId: req.user.companyId
    }, transaction);
    const product = await Product.create({
      ...req.body,
      sku,
      creditCoins,
      variantEnabled: req.body.variantEnabled !== "false",
      image: image || req.body.image,
      companyId: req.user.companyId
    }, { transaction });
    const variantRows = normalizeVariantRows(variants, req.body.quantity);
    assertNoDuplicateVariantSkuSuffix(variantRows);
    const inventoryQuantity = variantRows.reduce((total, row) => total + Number(row.stockQuantity || 0), 0);
    const inventory = await CompanyInventory.create({
      companyId: req.user.companyId,
      productId: product.id,
      quantity: inventoryQuantity,
      lowStockLimit: req.body.lowStockLimit || 10,
      lastUpdatedBy: req.user.id
    }, { transaction });
    await ProductVariant.bulkCreate(variantRows.map((row) => ({
      companyId: req.user.companyId,
      productId: product.id,
      variantName: row.variantName || "Standard",
      colorName: row.colorName || "Default",
      stockQuantity: Math.max(0, Number(row.stockQuantity || 0)),
      priceOverride: row.priceOverride === "" || row.priceOverride == null ? null : Number(row.priceOverride),
      skuSuffix: row.skuSuffix || generateVariantSuffix(row),
      status: row.status || "active"
    })), { transaction });
    return { product, inventory };
  });
  res.status(201).json(result);
});

exports.products = asyncHandler(async (req, res) => {
  res.json(await Product.findAll({ where: companyScope(req), include: [{ model: CompanyInventory }, { model: ProductVariant, as: "variants" }], order: [["createdAt", "DESC"]] }));
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ where: { id: req.params.id, ...companyScope(req) }, include: [{ model: ProductVariant, as: "variants" }] });
  if (!product) return res.status(404).json({ message: "Product not found" });
  const variants = req.body.variants ? JSON.parse(req.body.variants || "[]") : null;
  if (variants?.some((row) => Number(row.stockQuantity || 0) < 0)) return res.status(400).json({ message: "Stock quantity cannot be negative" });
  await Product.sequelize.transaction(async (transaction) => {
    await product.update({
      productName: req.body.productName ?? product.productName,
      sku: product.sku,
      category: req.body.category ?? product.category,
      description: req.body.description ?? product.description,
      manufacturingDate: Object.prototype.hasOwnProperty.call(req.body, "manufacturingDate") ? (req.body.manufacturingDate || null) : product.manufacturingDate,
      expiryDate: Object.prototype.hasOwnProperty.call(req.body, "expiryDate") ? (req.body.expiryDate || null) : product.expiryDate,
      price: req.body.price ?? product.price,
      creditCoins: Math.max(0, Number(req.body.creditCoins ?? product.creditCoins ?? 0)),
      image: publicPath("products", req.file) || req.body.image || product.image,
      status: req.body.status ?? product.status
    }, { transaction });
    if (variants) {
      const normalizedRows = normalizeVariantRows(variants);
      assertNoDuplicateVariantSkuSuffix(normalizedRows);
      const existingVariants = await ProductVariant.findAll({ where: { companyId: req.user.companyId, productId: product.id }, transaction });
      for (const row of normalizedRows) {
        const variantName = String(row.variantName || "Standard").trim();
        const colorName = String(row.colorName || "Default").trim();
        const duplicate = existingVariants.find((variant) => Number(variant.id) !== Number(row.id) && variant.variantName.toLowerCase() === variantName.toLowerCase() && variant.colorName.toLowerCase() === colorName.toLowerCase());
        if (duplicate) {
          const error = new Error(`Variant ${variantName} / ${colorName} already exists for this product.`);
          error.status = 409;
          throw error;
        }
        const duplicateSuffix = row.skuSuffix && existingVariants.find((variant) => Number(variant.id) !== Number(row.id) && String(variant.skuSuffix || "").toUpperCase() === String(row.skuSuffix).trim().toUpperCase());
        if (duplicateSuffix) {
          const error = new Error(`Variant SKU suffix ${row.skuSuffix} already exists for this product.`);
          error.status = 409;
          throw error;
        }
        if (row.id) {
          await ProductVariant.update({
            variantName,
            colorName,
            stockQuantity: Math.max(0, Number(row.stockQuantity || 0)),
            priceOverride: row.priceOverride === "" || row.priceOverride == null ? null : Number(row.priceOverride),
            skuSuffix: row.skuSuffix || existingVariants.find((variant) => Number(variant.id) === Number(row.id))?.skuSuffix || generateVariantSuffix(row),
            image: row.image || null,
            status: row.status || "active"
          }, { where: { id: row.id, companyId: req.user.companyId, productId: product.id }, transaction });
        } else {
          await ProductVariant.create({
            companyId: req.user.companyId,
            productId: product.id,
            variantName,
            colorName,
            stockQuantity: Math.max(0, Number(row.stockQuantity || 0)),
            priceOverride: row.priceOverride === "" || row.priceOverride == null ? null : Number(row.priceOverride),
            skuSuffix: generateVariantSuffix(row),
            image: row.image || null,
            status: row.status || "active"
          }, { transaction });
        }
      }
      const total = await ProductVariant.sum("stockQuantity", { where: { companyId: req.user.companyId, productId: product.id }, transaction });
      await CompanyInventory.update({ quantity: Number(total || 0), lastUpdatedBy: req.user.id }, { where: { companyId: req.user.companyId, productId: product.id }, transaction });
    }
  });
  res.json(await Product.findByPk(product.id, { include: [{ model: CompanyInventory }, { model: ProductVariant, as: "variants" }] }));
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ where: { id: req.params.id, ...companyScope(req) } });
  if (!product) return res.status(404).json({ message: "Product not found" });
  const orderCount = await OrderItem.count({ where: { productId: product.id } });
  if (orderCount > 0) {
    await product.update({ status: "inactive" });
    return res.json({ message: "Product has orders, so it was deactivated.", product });
  }
  await ProductVariant.destroy({ where: { companyId: req.user.companyId, productId: product.id } });
  await CompanyInventory.destroy({ where: { companyId: req.user.companyId, productId: product.id } });
  await product.destroy();
  res.json({ message: "Product deleted" });
});

exports.updateInventory = asyncHandler(async (req, res) => {
  const [inventory] = await CompanyInventory.findOrCreate({
    where: { companyId: req.user.companyId, productId: req.params.productId },
    defaults: { quantity: 0, lowStockLimit: 10, lastUpdatedBy: req.user.id }
  });
  await inventory.update({ quantity: req.body.quantity, lowStockLimit: req.body.lowStockLimit, lastUpdatedBy: req.user.id });
  res.json(inventory);
});

exports.updateProductVariant = asyncHandler(async (req, res) => {
  const variant = await ProductVariant.findOne({ where: { id: req.params.variantId, companyId: req.user.companyId } });
  if (!variant) return res.status(404).json({ message: "Variant not found" });
  const stockQuantity = Number(req.body.stockQuantity ?? variant.stockQuantity);
  if (stockQuantity < 0) return res.status(400).json({ message: "Stock quantity cannot be negative" });
  if (req.body.variantName || req.body.colorName) {
    const duplicate = await ProductVariant.findOne({
      where: {
        companyId: req.user.companyId,
        productId: variant.productId,
        id: { [Op.ne]: variant.id },
        variantName: req.body.variantName ?? variant.variantName,
        colorName: req.body.colorName ?? variant.colorName
      }
    });
    if (duplicate) return res.status(409).json({ message: `Variant ${req.body.variantName ?? variant.variantName} / ${req.body.colorName ?? variant.colorName} already exists for this product.` });
  }
  await variant.update({
    variantName: req.body.variantName ?? variant.variantName,
    colorName: req.body.colorName ?? variant.colorName,
    stockQuantity,
    priceOverride: req.body.priceOverride === "" ? null : req.body.priceOverride ?? variant.priceOverride,
    skuSuffix: variant.skuSuffix,
    status: req.body.status ?? variant.status
  });
  const total = await ProductVariant.sum("stockQuantity", { where: { companyId: req.user.companyId, productId: variant.productId } });
  await CompanyInventory.update({ quantity: Number(total || 0), lastUpdatedBy: req.user.id }, { where: { companyId: req.user.companyId, productId: variant.productId } });
  res.json(variant);
});

exports.deleteProductVariant = asyncHandler(async (req, res) => {
  const variant = await ProductVariant.findOne({ where: { id: req.params.variantId, companyId: req.user.companyId } });
  if (!variant) return res.status(404).json({ message: "Variant not found" });
  const productId = variant.productId;
  await variant.destroy();
  const total = await ProductVariant.sum("stockQuantity", { where: { companyId: req.user.companyId, productId } });
  await CompanyInventory.update({ quantity: Number(total || 0), lastUpdatedBy: req.user.id }, { where: { companyId: req.user.companyId, productId } });
  res.json({ message: "Variant deleted" });
});

exports.companyStock = asyncHandler(async (req, res) => {
  res.json(await CompanyInventory.findAll({ where: companyScope(req), include: [{ model: Product }] }));
});

exports.dealerStock = asyncHandler(async (req, res) => {
  res.json(await DealerInventory.findAll({ where: companyScope(req), include: [{ model: Product }, { model: ProductVariant }, { model: Dealer, attributes: ["id", "dealerName", "area", "city", "address"] }] }));
});

exports.dealerSales = asyncHandler(async (req, res) => {
  const where = companyScope(req);
  if (req.query.dealerId) where.dealerId = req.query.dealerId;
  if (req.query.productId) where.productId = req.query.productId;
  if (req.query.from || req.query.to) {
    where.saleDate = {};
    if (req.query.from) where.saleDate[Op.gte] = req.query.from;
    if (req.query.to) where.saleDate[Op.lte] = req.query.to;
  }
  const rows = await DealerSale.findAll({ where, include: [Product, ProductVariant, Dealer], order: [["saleDate", "DESC"], ["createdAt", "DESC"]] });
  const totalSoldUnits = rows.reduce((total, row) => total + Number(row.quantitySold || 0), 0);
  const byProduct = rows.reduce((acc, row) => {
    const key = row.productId;
    acc[key] = acc[key] || { productId: key, productName: row.Product?.productName || `Product #${key}`, quantitySold: 0 };
    acc[key].quantitySold += Number(row.quantitySold || 0);
    return acc;
  }, {});
  const byDealer = rows.reduce((acc, row) => {
    const key = row.dealerId;
    acc[key] = acc[key] || { dealerId: key, dealerName: row.Dealer?.dealerName || `Dealer #${key}`, quantitySold: 0 };
    acc[key].quantitySold += Number(row.quantitySold || 0);
    return acc;
  }, {});
  res.json({
    rows,
    stats: {
      totalSoldUnits,
      topProducts: Object.values(byProduct).sort((a, b) => b.quantitySold - a.quantitySold).slice(0, 5),
      dealerPerformance: Object.values(byDealer).sort((a, b) => b.quantitySold - a.quantitySold)
    }
  });
});

exports.orders = asyncHandler(async (req, res) => {
  const where = companyScope(req);
  if (req.query.status) where.status = req.query.status;
  const orders = await Order.findAll({
    where,
    include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }, Dealer, { model: DeliveryTracking, as: "tracking" }, { model: OrderScheduledMessage, as: "scheduledMessages" }],
    order: [["createdAt", "DESC"]]
  });
  const enriched = [];
  for (const order of orders) {
    const json = order.toJSON();
    json.stockCheck = await stockCheckForOrder(order);
    json.progressPercentage = progressForStatus(order.status);
    json.activeStep = activeDeliveryStep(order.status);
    json.daysLeftUntilDelivered = daysUntil(order.deliveredDate);
    enriched.push(json);
  }
  const priority = { pending: 1, approved: 2, packing: 3, shipping: 3, out_for_delivery: 3, delivered: 4, rejected: 5 };
  res.json(enriched.sort((a, b) => (priority[a.status] || 99) - (priority[b.status] || 99) || new Date(b.createdAt) - new Date(a.createdAt)));
});

exports.pendingOrders = asyncHandler(async (req, res) => {
  const orders = await Order.findAll({
    where: { ...companyScope(req), status: "pending" },
    include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }, Dealer, { model: DeliveryTracking, as: "tracking" }, { model: OrderScheduledMessage, as: "scheduledMessages" }],
    order: [["createdAt", "DESC"]]
  });
  const enriched = [];
  for (const order of orders) {
    const json = order.toJSON();
    json.stockCheck = await stockCheckForOrder(order);
    enriched.push(json);
  }
  res.json(enriched);
});

exports.stockCheck = asyncHandler(async (req, res) => {
  const order = await Order.findOne({
    where: { id: req.params.id, ...companyScope(req) },
    include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }]
  });
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json(await stockCheckForOrder(order));
});

exports.approveWithSchedule = asyncHandler(async (req, res) => {
  const required = ["packingDate", "shippingDate", "outForDeliveryDate", "deliveredDate"];
  const missing = required.filter((field) => !req.body[field]);
  if (missing.length) return res.status(400).json({ message: `Missing delivery dates: ${missing.join(", ")}` });

  const order = await Order.findOne({ where: { id: req.params.id, ...companyScope(req), status: "pending" }, include: [{ model: OrderItem, as: "items" }] });
  if (!order) return res.status(404).json({ message: "Pending order not found" });

  const orderWithProducts = await Order.findByPk(order.id, { include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }] });
  const stockCheck = await stockCheckForOrder(orderWithProducts);
  if (!stockCheck.canApprove) return res.status(400).json({ message: "Stock is not enough. Please update stock before approval.", stockCheck });

  for (const item of order.items) {
    if (item.productVariantId) {
      const variant = await ProductVariant.findOne({ where: { id: item.productVariantId, companyId: order.companyId, productId: item.productId } });
      if (!variant || Number(variant.stockQuantity) < Number(item.quantity)) return res.status(400).json({ message: "Insufficient variant stock" });
    } else {
      const inventory = await CompanyInventory.findOne({ where: { companyId: order.companyId, productId: item.productId } });
      if (!inventory || inventory.quantity < item.quantity) return res.status(400).json({ message: "Insufficient stock" });
    }
  }
  for (const item of order.items) {
    if (item.productVariantId) {
      await ProductVariant.decrement("stockQuantity", { by: item.quantity, where: { id: item.productVariantId, companyId: order.companyId, productId: item.productId } });
      await CompanyInventory.decrement("quantity", { by: item.quantity, where: { companyId: order.companyId, productId: item.productId } });
    } else {
      await CompanyInventory.decrement("quantity", { by: item.quantity, where: { companyId: order.companyId, productId: item.productId } });
    }
  }

  await order.update({
    status: "approved",
    packingDate: req.body.packingDate,
    shippingDate: req.body.shippingDate,
    outForDeliveryDate: req.body.outForDeliveryDate,
    deliveredDate: req.body.deliveredDate,
    approvedAt: new Date(),
    approvedBy: req.user.id,
    currentDeliveryStep: "approved",
    deliveryProgress: progressForStatus("approved")
  });

  await DeliveryTracking.bulkCreate([
    { orderId: order.id, status: "approved", message: "Order Approved", updatedBy: req.user.id },
    { orderId: order.id, status: "packing", message: `Packing Started - ${req.body.packingDate}`, updatedBy: req.user.id },
    { orderId: order.id, status: "shipping", message: `Shipping Started - ${req.body.shippingDate}`, updatedBy: req.user.id },
    { orderId: order.id, status: "out_for_delivery", message: `Out For Delivery - ${req.body.outForDeliveryDate}`, updatedBy: req.user.id },
    { orderId: order.id, status: "delivered", message: `Delivered - ${req.body.deliveredDate}`, updatedBy: req.user.id }
  ]);

  const approvalText = `Your order #${order.orderNumber} has been approved. Your expected delivery date is ${req.body.deliveredDate}.`;
  const scheduleRows = [
    { messageType: "approval", scheduledDate: new Date().toISOString().slice(0, 10), messageText: approvalText, isSent: true, sentAt: new Date() },
    { messageType: "packing", scheduledDate: req.body.packingDate, messageText: `Your order #${order.orderNumber} packing has started today.` },
    { messageType: "shipping", scheduledDate: req.body.shippingDate, messageText: `Your order #${order.orderNumber} has been shipped today.` },
    { messageType: "out_for_delivery", scheduledDate: req.body.outForDeliveryDate, messageText: `Your order #${order.orderNumber} is out for delivery today.` },
    { messageType: "delivered", scheduledDate: req.body.deliveredDate, messageText: `Your order #${order.orderNumber} is scheduled to be delivered today.` }
  ].map((row) => ({
    orderId: order.id,
    dealerId: order.dealerId,
    companyId: order.companyId,
    senderId: req.user.id,
    isSent: false,
    ...row
  }));
  await OrderScheduledMessage.bulkCreate(scheduleRows, { ignoreDuplicates: true });
  await Message.findOrCreate({
    where: { companyId: order.companyId, dealerId: order.dealerId, orderNumber: order.orderNumber, messageType: "system_order_update", message: approvalText },
    defaults: {
      senderId: req.user.id,
      receiverId: null,
      conversationId: `${order.companyId}-${order.dealerId}`,
      title: "Order update",
      message: approvalText,
      isRead: false
    }
  });
  await createInvoiceForApprovedOrder(await Order.findByPk(order.id, { include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }] }), req.user.id);

  res.json(await Order.findByPk(order.id, { include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }, { model: DeliveryTracking, as: "tracking" }, { model: OrderScheduledMessage, as: "scheduledMessages" }] }));
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, rejectionReason, deliveryDate } = req.body;
  const orderId = req.params.id || req.params.orderId;
  const order = await Order.findOne({ where: { id: orderId, ...companyScope(req) }, include: [{ model: OrderItem, as: "items" }] });
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (status === "approved" && order.status === "pending") {
    return res.status(400).json({ message: "Use approve-with-schedule and provide all delivery dates" });
  }
  const nextStatus = { approved: "packing", packing: "shipping", shipping: "out_for_delivery", out_for_delivery: "delivered" };
  if (["packing", "shipping", "out_for_delivery", "delivered"].includes(status) && nextStatus[order.status] !== status) {
    return res.status(400).json({ message: `Invalid delivery transition from ${order.status} to ${status}` });
  }
  if (order.status === "delivered") return res.status(400).json({ message: "Delivered orders cannot be changed" });

  if (status === "delivered" && !order.inventoryAdded) {
    for (const item of order.items) {
      const [dealerInventory] = await DealerInventory.findOrCreate({
        where: { companyId: order.companyId, dealerId: order.dealerId, productId: item.productId, productVariantId: item.productVariantId || null },
        defaults: { quantity: 0, lowStockLimit: 5, variantName: item.variantName, colorName: item.colorName }
      });
      await dealerInventory.increment("quantity", { by: item.quantity });
    }
    await order.update({ inventoryAdded: true, deliveredAt: new Date() });
  }

  await order.update({ status, rejectionReason, deliveryDate });
  await order.update({ currentDeliveryStep: activeDeliveryStep(status), deliveryProgress: progressForStatus(status) });
  await DeliveryTracking.create({ orderId: order.id, status, message: req.body.message || status.replaceAll("_", " "), updatedBy: req.user.id });
  await Message.create({
    companyId: order.companyId,
    senderId: req.user.id,
    receiverId: null,
    dealerId: order.dealerId,
    conversationId: `${order.companyId}-${order.dealerId}`,
    title: "Delivery update",
    message: status === "delivered" ? `Your order #${order.orderNumber} has been delivered and added to your inventory.` : `Your order #${order.orderNumber} is now ${status.replaceAll("_", " ")}.`,
    messageType: "system_delivery",
    orderNumber: order.orderNumber,
    isRead: false
  });
  if (status === "delivered") await awardCreditCoinsForOrder(order.id);
  res.json(order);
});

exports.delivery = asyncHandler(async (req, res) => {
  const where = companyScope(req);
  if (req.query.status) where.status = req.query.status;
  const orders = await Order.findAll({
    where: { ...where, status: { [Op.notIn]: ["pending", "rejected", "cancelled"] } },
    include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }, Dealer, { model: DeliveryTracking, as: "tracking" }, { model: OrderScheduledMessage, as: "scheduledMessages" }],
    order: [["updatedAt", "DESC"]]
  });
  const priority = { approved: 1, packing: 2, shipping: 3, out_for_delivery: 4, delivered: 9 };
  res.json(orders.map((order) => ({
    ...order.toJSON(),
    progressPercentage: progressForStatus(order.status),
    activeStep: activeDeliveryStep(order.status),
    daysLeftUntilDelivered: daysUntil(order.deliveredDate)
  })).sort((a, b) => (priority[a.status] || 99) - (priority[b.status] || 99) || new Date(b.updatedAt) - new Date(a.updatedAt)));
});

exports.payments = asyncHandler(async (req, res) => {
  if (req.method === "POST") {
    const payment = await Payment.create({ ...req.body, companyId: req.user.companyId });
    return res.status(201).json(payment);
  }
  res.json(await Payment.findAll({ where: companyScope(req), include: [Order], order: [["createdAt", "DESC"]] }));
});

exports.approvedOrdersForPayment = asyncHandler(async (req, res) => {
  const paidOrderIds = (await Payment.findAll({ where: companyScope(req), attributes: ["orderId"] })).map((payment) => payment.orderId).filter(Boolean);
  res.json(await Order.findAll({
    where: { ...companyScope(req), status: "approved", id: { [Op.notIn]: paidOrderIds.length ? paidOrderIds : [0] } },
    include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }, Dealer],
    order: [["approvedAt", "DESC"]]
  }));
});

exports.sendPaymentRequest = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ where: { id: req.params.orderId, ...companyScope(req), status: "approved" }, include: [Dealer, { model: OrderItem, as: "items", include: [Product, ProductVariant] }] });
  if (!order) return res.status(404).json({ message: "Approved order not found" });
  const existing = await Payment.findOne({ where: { companyId: req.user.companyId, orderId: order.id } });
  if (existing) return res.status(400).json({ message: "Payment request already sent" });

  const payment = await Payment.create({
    companyId: req.user.companyId,
    dealerId: order.dealerId,
    orderId: order.id,
    invoiceNumber: `INV-${order.orderNumber}`,
    orderNumber: order.orderNumber,
    productSummary: productSummary(order.items || []),
    invoiceStatus: "generated",
    orderApprovedAt: order.approvedAt || new Date(),
    amount: order.totalAmount,
    paymentMethod: null,
    paymentStatus: "pending",
    invoiceFile: publicPath("invoices", req.file),
    paymentRequestSentAt: new Date(),
    approvedBy: req.user.id
  });
  res.status(201).json(payment);
});

exports.financeSummary = asyncHandler(async (req, res) => {
  const payments = (await Payment.findAll({
    where: companyScope(req),
    include: [{ model: Order, include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }] }, Dealer],
    order: [["createdAt", "DESC"]]
  })).map(withFinanceMeta).sort((a, b) => {
    if (a.paymentStatus === "pending" && b.paymentStatus === "pending") return b.daysUnpaid - a.daysUnpaid || new Date(b.createdAt) - new Date(a.createdAt);
    if (a.paymentStatus === "pending") return -1;
    if (b.paymentStatus === "pending") return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  const sum = (rows) => rows.reduce((total, item) => total + Number(item.amount || 0), 0);
  res.json({
    payments,
    stats: {
      pendingPayments: payments.filter((p) => p.paymentStatus === "pending").length,
      paidPayments: payments.filter((p) => p.paymentStatus === "paid").length,
      cashPayments: payments.filter((p) => p.paymentMethod === "cash").length,
      onlinePayments: payments.filter((p) => p.paymentMethod === "online").length,
      totalPendingAmount: sum(payments.filter((p) => p.paymentStatus === "pending")),
      totalPaidAmount: sum(payments.filter((p) => p.paymentStatus === "paid"))
    }
  });
});

exports.policies = asyncHandler(async (req, res) => {
  if (req.method === "POST") return res.status(201).json(await Policy.create({ ...req.body, companyId: req.user.companyId }));
  res.json(await Policy.findAll({ where: companyScope(req), order: [["createdAt", "DESC"]] }));
});

exports.messages = asyncHandler(async (req, res) => {
  if (req.method === "POST") {
    const dealerId = req.body.dealerId || null;
    const conversationId = dealerId ? `${req.user.companyId}-${dealerId}` : `${req.user.companyId}-all`;
    return res.status(201).json(await Message.create({ ...req.body, dealerId, conversationId, companyId: req.user.companyId, senderId: req.user.id }));
  }
  res.json(await Message.findAll({ where: companyScope(req), order: [["createdAt", "DESC"]] }));
});

exports.adminConversations = asyncHandler(async (req, res) => {
  const messages = await Message.findAll({ where: companyScope(req), include: [{ model: User, as: "sender", attributes: ["id", "name", "role"] }], order: [["createdAt", "ASC"]] });
  const dealers = await Dealer.findAll({ where: companyScope(req), order: [["dealerName", "ASC"]] });
  res.json({ dealers, messages });
});

exports.markConversationRead = asyncHandler(async (req, res) => {
  await Message.update({ isRead: true }, { where: { companyId: req.user.companyId, conversationId: req.params.conversationId } });
  res.json({ message: "Conversation marked read" });
});

function monthKey(value) {
  return new Date(value).toISOString().slice(0, 7);
}

exports.dealerPerformance = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const { area, city, dealerId, startDate, endDate, productId, paymentStatus } = req.query;
  const dealerWhere = { companyId };
  if (area) dealerWhere.area = area;
  if (city) dealerWhere.city = city;
  const dealers = await Dealer.findAll({ where: dealerWhere, order: [["dealerName", "ASC"]] });
  const dealerIds = dealers.map((dealer) => dealer.id);
  const selectedDealerId = Number(dealerId || 0);
  const scopedDealerIds = selectedDealerId ? dealerIds.filter((id) => id === selectedDealerId) : dealerIds;
  const createdRange = timestampDateWhere(startDate, endDate);
  const orderWhere = { companyId, dealerId: scopedDealerIds.length ? scopedDealerIds : [0] };
  if (createdRange) orderWhere.createdAt = createdRange;
  const paymentWhere = { companyId, dealerId: scopedDealerIds.length ? scopedDealerIds : [0] };
  if (["paid", "pending", "failed"].includes(paymentStatus)) paymentWhere.paymentStatus = paymentStatus;
  if (["cash", "online"].includes(paymentStatus)) paymentWhere.paymentMethod = paymentStatus;
  if (createdRange) paymentWhere.createdAt = createdRange;
  const salesWhere = { companyId, dealerId: scopedDealerIds.length ? scopedDealerIds : [0] };
  if (productId) salesWhere.productId = productId;
  if (startDate || endDate) salesWhere.saleDate = dateWhere(startDate, endDate);

  const [areasRows, citiesRows, productRows, orders, payments, sales, inventory, wallet, transactions, redemptions] = await Promise.all([
    Dealer.findAll({ where: { companyId }, attributes: ["area"], group: ["area"] }),
    Dealer.findAll({ where: { companyId, ...(area ? { area } : {}) }, attributes: ["city"], group: ["city"] }),
    Product.findAll({ where: { companyId }, attributes: ["id", "productName"], order: [["productName", "ASC"]] }),
    Order.findAll({ where: orderWhere, include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }, { model: Dealer, attributes: ["id", "dealerName", "area", "city", "pincode"] }], order: [["createdAt", "DESC"]] }),
    Payment.findAll({ where: paymentWhere, include: [{ model: Order, include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }] }, { model: Dealer, attributes: ["id", "dealerName", "area", "city", "pincode"] }], order: [["createdAt", "DESC"]] }),
    DealerSale.findAll({ where: salesWhere, include: [Product, ProductVariant], order: [["saleDate", "DESC"], ["createdAt", "DESC"]] }),
    DealerInventory.findAll({ where: { companyId, dealerId: scopedDealerIds.length ? scopedDealerIds : [0] }, include: [Product, ProductVariant], order: [["quantity", "ASC"]] }),
    selectedDealerId ? DealerCreditWallet.findOne({ where: { companyId, dealerId: selectedDealerId } }) : null,
    DealerCreditTransaction.findAll({ where: { companyId, dealerId: scopedDealerIds.length ? scopedDealerIds : [0] }, order: [["createdAt", "DESC"]] }),
    CreditRedemption.findAll({ where: { companyId, dealerId: scopedDealerIds.length ? scopedDealerIds : [0] }, include: [{ model: CreditReward, as: "reward" }, { model: Dealer, attributes: ["id", "dealerName", "area", "city", "pincode"] }], order: [["createdAt", "DESC"]], limit: 10 })
  ]);

  const orderItems = orders.flatMap((order) => order.items || []).filter((item) => !productId || Number(item.productId) === Number(productId));
  const paidAmount = payments.filter((p) => p.paymentStatus === "paid").reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingAmount = payments.filter((p) => p.paymentStatus === "pending").reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const inventoryValue = inventory.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.Product?.price || 0), 0);
  const byMonth = (rows, getDate, getValue) => Object.values(rows.reduce((acc, row) => {
    const key = monthKey(getDate(row));
    acc[key] = acc[key] || { month: key, value: 0 };
    acc[key].value += Number(getValue(row) || 0);
    return acc;
  }, {})).sort((a, b) => a.month.localeCompare(b.month));
  const countBy = (rows, keyFn, label = "status") => Object.values(rows.reduce((acc, row) => {
    const key = keyFn(row) || "Unknown";
    acc[key] = acc[key] || { [label]: key, count: 0 };
    acc[key].count += 1;
    return acc;
  }, {}));
  const productWise = (rows, qtyFn) => Object.values(rows.reduce((acc, row) => {
    const product = row.Product || row.ProductVariant?.Product;
    const key = row.productId;
    acc[key] = acc[key] || { productName: product?.productName || `Product #${key}`, quantity: 0, amount: 0 };
    acc[key].quantity += Number(qtyFn(row) || 0);
    acc[key].amount += Number(row.subtotal || 0);
    return acc;
  }, {}));
  const creditByMonth = Object.values(transactions.reduce((acc, tx) => {
    const key = monthKey(tx.createdAt);
    acc[key] = acc[key] || { month: key, earned: 0, redeemed: 0 };
    if (tx.type === "EARN") acc[key].earned += Number(tx.coins || 0);
    if (tx.type === "REDEEM") acc[key].redeemed += Number(tx.coins || 0);
    return acc;
  }, {})).sort((a, b) => a.month.localeCompare(b.month));
  const dealerPerformance = Object.values(orders.reduce((acc, order) => {
    const id = order.dealerId;
    const dealer = order.Dealer;
    acc[id] = acc[id] || { dealerId: id, dealerName: dealer?.dealerName || "Dealer", area: dealer?.area, city: dealer?.city, purchaseAmount: 0, orderCount: 0, unitsPurchased: 0 };
    acc[id].purchaseAmount += Number(order.totalAmount || 0);
    acc[id].orderCount += 1;
    acc[id].unitsPurchased += (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return acc;
  }, {}));
  const totalUnitsPurchased = orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const currentInventoryQuantity = inventory.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const totalPurchaseAmount = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

  res.json({
    filters: {
      areas: areasRows.map((row) => row.area || "Unassigned"),
      cities: citiesRows.map((row) => row.city).filter(Boolean),
      dealers,
      products: productRows
    },
    summary: {
      totalOrders: orders.length,
      approvedOrders: orders.filter((order) => order.status === "approved").length,
      deliveredOrders: orders.filter((order) => order.status === "delivered").length,
      pendingOrders: orders.filter((order) => order.status === "pending").length,
      rejectedOrders: orders.filter((order) => order.status === "rejected").length,
      totalPurchaseAmount,
      totalUnitsPurchased,
      averageOrderValue: orders.length ? totalPurchaseAmount / orders.length : 0,
      totalPaidAmount: paidAmount,
      pendingPaymentAmount: pendingAmount,
      totalSalesUnits: sales.reduce((sum, sale) => sum + Number(sale.quantitySold || 0), 0),
      currentInventoryValue: inventoryValue,
      currentInventoryQuantity,
      lowStockProducts: inventory.filter((item) => Number(item.quantity || 0) <= Number(item.lowStockLimit || 0)).length,
      creditCoinsEarned: Number(wallet?.totalEarned || 0),
      creditCoinsRedeemed: Number(wallet?.totalRedeemed || 0),
      currentCreditBalance: Number(wallet?.balance || 0)
    },
    charts: {
      monthlyPurchases: byMonth(orders, (order) => order.createdAt, (order) => order.totalAmount),
      monthlySales: byMonth(sales, (sale) => sale.saleDate, (sale) => sale.quantitySold),
      paymentStatus: [
        { status: "paid", count: payments.filter((payment) => payment.paymentStatus === "paid").length },
        { status: "pending", count: payments.filter((payment) => payment.paymentStatus === "pending").length },
        { status: "failed", count: payments.filter((payment) => payment.paymentStatus === "failed").length }
      ].filter((row) => row.count > 0),
      orderStatus: countBy(orders, (order) => order.status),
      productWisePurchases: productWise(orderItems, (item) => item.quantity),
      productWiseSales: productWise(sales, (sale) => sale.quantitySold),
      creditEarnedRedeemed: creditByMonth
    },
    topDealers: {
      byPurchase: [...dealerPerformance].sort((a, b) => b.purchaseAmount - a.purchaseAmount).slice(0, 5),
      byOrders: [...dealerPerformance].sort((a, b) => b.orderCount - a.orderCount).slice(0, 5),
      byUnits: [...dealerPerformance].sort((a, b) => b.unitsPurchased - a.unitsPurchased).slice(0, 5)
    },
    tables: {
      recentOrders: orders.slice(0, 10),
      recentPayments: payments.slice(0, 10),
      recentSales: sales.slice(0, 10),
      lowStockInventory: inventory.filter((item) => Number(item.quantity || 0) <= Number(item.lowStockLimit || 0)).slice(0, 10),
      recentCreditTransactions: transactions.slice(0, 10),
      recentRedemptions: redemptions.slice(0, 3)
    }
  });
});

exports.sendPaymentReminder = asyncHandler(async (req, res) => {
  const payment = await Payment.findOne({ where: { id: req.params.paymentId, ...companyScope(req), paymentStatus: "pending" }, include: [Order, Dealer] });
  if (!payment) return res.status(404).json({ message: "Unpaid invoice not found" });
  const days = daysUnpaid(payment);
  const text = `Reminder: Payment for invoice #${payment.invoiceNumber || payment.id} / order #${payment.orderNumber || payment.Order?.orderNumber || payment.orderId} is still unpaid. Amount: Rs ${payment.amount}. Pending since ${days} days.`;
  await Message.create({
    companyId: req.user.companyId,
    senderId: req.user.id,
    receiverId: null,
    dealerId: payment.dealerId,
    conversationId: `${req.user.companyId}-${payment.dealerId}`,
    title: "Payment reminder",
    message: text,
    messageType: "system_finance",
    orderNumber: payment.orderNumber || payment.Order?.orderNumber,
    isRead: false
  });
  await InternalNotification.create({
    companyId: req.user.companyId,
    dealerId: payment.dealerId,
    roleTarget: "DEALER",
    title: "Payment reminder",
    message: text,
    type: "PAYMENT",
    priority: days > 7 ? "HIGH" : "MEDIUM",
    metadata: { paymentId: payment.id, orderId: payment.orderId }
  });
  res.json({ message: "Reminder sent" });
});

exports.creditSummary = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  const [rewards, redemptions, redeemedCoins, wallets] = await Promise.all([
    CreditReward.findAll({ where: { companyId } }),
    CreditRedemption.findAll({ where: { companyId }, include: [{ model: CreditReward, as: "reward" }, Dealer], order: [["createdAt", "DESC"]] }),
    DealerCreditTransaction.sum("coins", { where: { companyId, type: "REDEEM" } }),
    DealerCreditWallet.findAll({ where: { companyId }, include: [Dealer], order: [["balance", "DESC"]] })
  ]);
  res.json({
    totalRewards: rewards.length,
    activeRewards: rewards.filter((r) => r.status === "active").length,
    totalRedemptions: redemptions.length,
    pendingRedemptions: redemptions.filter((r) => r.status === "PENDING").length,
    completedRedemptions: redemptions.filter((r) => r.status === "PROVIDED").length,
    totalCoinsRedeemed: Number(redeemedCoins || 0),
    topDealerByCredits: wallets[0] ? { dealerName: wallets[0].Dealer?.dealerName, balance: wallets[0].balance } : null,
    remainingRewardStock: rewards.reduce((sum, reward) => sum + Number(reward.quantity || 0), 0),
    ...(await creditStatsForCompany(companyId))
  });
});

exports.creditRewards = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId;
  if (req.method === "POST") {
    const requiredCoins = Number(req.body.requiredCoins);
    const quantity = Number(req.body.quantity);
    if (requiredCoins < 0 || quantity < 0) return res.status(400).json({ message: "Coins and quantity cannot be negative" });
    const reward = await CreditReward.create({ ...req.body, requiredCoins, quantity, companyId, image: publicPath("credit-rewards", req.file) || req.body.image });
    return res.status(201).json(reward);
  }
  res.json(await CreditReward.findAll({ where: { companyId }, order: [["createdAt", "DESC"]] }));
});

exports.updateCreditReward = asyncHandler(async (req, res) => {
  const reward = await CreditReward.findOne({ where: { id: req.params.id, companyId: req.user.companyId } });
  if (!reward) return res.status(404).json({ message: "Reward not found" });
  await reward.update({ ...req.body, image: publicPath("credit-rewards", req.file) || req.body.image || reward.image });
  res.json(reward);
});

exports.deleteCreditReward = asyncHandler(async (req, res) => {
  const reward = await CreditReward.findOne({ where: { id: req.params.id, companyId: req.user.companyId } });
  if (!reward) return res.status(404).json({ message: "Reward not found" });
  await reward.destroy();
  res.json({ message: "Reward deleted" });
});

exports.creditRewardStatus = asyncHandler(async (req, res) => {
  const reward = await CreditReward.findOne({ where: { id: req.params.id, companyId: req.user.companyId } });
  if (!reward) return res.status(404).json({ message: "Reward not found" });
  await reward.update({ status: req.body.status || (reward.status === "active" ? "inactive" : "active") });
  res.json(reward);
});

exports.creditRedemptions = asyncHandler(async (req, res) => {
  res.json(await CreditRedemption.findAll({ where: companyScope(req), include: [{ model: CreditReward, as: "reward" }, Dealer], order: [["createdAt", "DESC"]] }));
});

exports.updateCreditRedemptionStatus = asyncHandler(async (req, res) => {
  const redemption = await CreditRedemption.findOne({ where: { id: req.params.id, companyId: req.user.companyId }, include: [{ model: CreditReward, as: "reward" }, Dealer] });
  if (!redemption) return res.status(404).json({ message: "Redemption not found" });
  const update = { status: req.body.status || redemption.status, expectedProvideDate: req.body.expectedProvideDate || redemption.expectedProvideDate, adminNote: req.body.adminNote ?? redemption.adminNote };
  if (update.status === "APPROVED" && !redemption.approvedAt) update.approvedAt = new Date();
  if (update.status === "PROVIDED" && !redemption.providedAt) update.providedAt = new Date();
  await redemption.update(update);
  const rewardTitle = redemption.reward?.title || "reward";
  let messageText = "";
  if (req.body.expectedProvideDate) messageText = `Your reward '${rewardTitle}' will be provided on ${req.body.expectedProvideDate}.`;
  if (update.status === "PROVIDED") messageText = `Your reward '${rewardTitle}' has been marked as provided.`;
  if (messageText) {
    await Message.create({
      companyId: req.user.companyId,
      senderId: req.user.id,
      receiverId: null,
      dealerId: redemption.dealerId,
      conversationId: `${req.user.companyId}-${redemption.dealerId}`,
      title: "Reward update",
      message: messageText,
      messageType: "credit_reward_update",
      isRead: false
    });
  }
  res.json(redemption);
});

exports.dealerWallets = asyncHandler(async (req, res) => {
  res.json(await DealerCreditWallet.findAll({ where: companyScope(req), include: [Dealer], order: [["balance", "DESC"]] }));
});

exports.reports = asyncHandler(async (req, res) => {
  res.json(await Report.findAll({ where: companyScope(req), include: [Dealer], order: [["createdAt", "DESC"]] }));
});
