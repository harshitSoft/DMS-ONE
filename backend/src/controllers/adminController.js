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

const companyScope = (req) => ({ companyId: req.user.companyId });

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
  const [summary, orderCounts, inventory, dealerInventory, payments, dealers, recentOrders, recentPayments, recentMessages, recentDeliveryUpdates, stockRequestMessages, salesRows, todaySalesRows, monthSalesRows, recentLowStockNotifications] = await Promise.all([
    exports.dashboardData(companyId),
    Promise.all(statuses.map(async (status) => ({ status, count: await Order.count({ where: { companyId, status } }) }))),
    CompanyInventory.findAll({ where: { companyId }, include: [Product], order: [["quantity", "DESC"]] }),
    DealerInventory.findAll({ where: { companyId }, include: [Product, ProductVariant], order: [["quantity", "DESC"]] }),
    Payment.findAll({ where: { companyId }, include: [{ model: Order, include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }] }, Dealer], order: [["createdAt", "DESC"]] }),
    Dealer.findAll({ where: { companyId }, order: [["dealerName", "ASC"]] }),
    Order.findAll({ where: { companyId }, include: [Dealer], order: [["createdAt", "DESC"]], limit: 5 }),
    Payment.findAll({ where: { companyId }, include: [{ model: Order, include: [{ model: OrderItem, as: "items", include: [Product, ProductVariant] }] }, Dealer], order: [["createdAt", "DESC"]], limit: 5 }),
    Message.findAll({ where: { companyId }, include: [{ model: User, as: "sender", attributes: ["id", "name", "role"] }], order: [["createdAt", "DESC"]], limit: 5 }),
    DeliveryTracking.findAll({
      include: [{ model: Order, required: true, where: { companyId }, attributes: ["orderNumber", "dealerId"] }],
      order: [["createdAt", "DESC"]],
      limit: 5
    }),
    Message.count({ where: { companyId, messageType: "stock_request" } }),
    DealerSale.findAll({ where: { companyId }, include: [Product, Dealer], order: [["saleDate", "DESC"], ["createdAt", "DESC"]] }),
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
  const orderTotals = (await Order.findAll({ where: { companyId }, attributes: ["dealerId", "totalAmount"] })).reduce((acc, order) => {
    acc[order.dealerId] = (acc[order.dealerId] || 0) + Number(order.totalAmount || 0);
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
    acc[key] = acc[key] || { productId: key, productName: sale.Product?.productName || `Product #${key}`, quantitySold: 0 };
    acc[key].quantitySold += Number(sale.quantitySold || 0);
    return acc;
  }, {});
  const salesByDealer = salesRows.reduce((acc, sale) => {
    const key = sale.dealerId;
    acc[key] = acc[key] || { dealerId: key, dealerName: sale.Dealer?.dealerName || dealerName(key), quantitySold: 0 };
    acc[key].quantitySold += Number(sale.quantitySold || 0);
    return acc;
  }, {});

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
      topHighestStockProducts: inventory.slice(0, 5).map((item) => ({ productName: item.Product?.productName, quantity: item.quantity })),
      topLowStockProducts: inventory.filter((item) => item.quantity <= item.lowStockLimit).sort((a, b) => a.quantity - b.quantity).slice(0, 5).map((item) => ({ productName: item.Product?.productName, quantity: item.quantity, lowStockLimit: item.lowStockLimit })),
      dealerWiseStockSummary: Object.entries(stockByDealer).map(([dealerId, quantity]) => ({ dealerId: Number(dealerId), dealerName: dealerName(Number(dealerId)), quantity }))
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
      areaWiseDealerCount: Object.entries(areaWise).map(([area, count]) => ({ area, count })),
      topDealersByOrderAmount: Object.entries(orderTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([dealerId, amount]) => ({ dealerId: Number(dealerId), dealerName: dealerName(Number(dealerId)), amount })),
      topDealersByPendingPayment: Object.entries(pendingPaymentsByDealer).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([dealerId, amount]) => ({ dealerId: Number(dealerId), dealerName: dealerName(Number(dealerId)), amount }))
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
    recentOrders,
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
  const license = await licenseCapacity(req.user.companyId);
  if (license.limitReached) {
    return res.status(403).json({
      code: "LICENSE_LIMIT_REACHED",
      message: "Great to see your business growing. To add more dealers, please purchase an additional license and continue expanding your network.",
      licenseStatus: license
    });
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
  const where = companyScope(req);
  if (req.query.area) where.area = req.query.area;
  const dealers = await Dealer.findAll({ where, order: [["createdAt", "DESC"]] });
  res.json(dealers);
});

exports.updateDealer = asyncHandler(async (req, res) => {
  const dealer = await Dealer.findOne({ where: { id: req.params.id, ...companyScope(req) } });
  if (!dealer) return res.status(404).json({ message: "Dealer not found" });
  await dealer.update(req.body);
  res.json(dealer);
});

exports.deleteDealer = asyncHandler(async (req, res) => {
  const dealer = await Dealer.findOne({ where: { id: req.params.id, ...companyScope(req) } });
  if (!dealer) return res.status(404).json({ message: "Dealer not found" });
  await dealer.destroy();
  res.json({ message: "Dealer deleted" });
});

exports.createProduct = asyncHandler(async (req, res) => {
  const image = publicPath("products", req.file);
  const variants = JSON.parse(req.body.variants || "[]").filter((row) => row.variantName || row.colorName);
  const creditCoins = Math.max(0, Number(req.body.creditCoins || 0));
  if (variants.some((row) => Number(row.stockQuantity || 0) < 0)) return res.status(400).json({ message: "Stock quantity cannot be negative" });
  const result = await Product.sequelize.transaction(async (transaction) => {
    const product = await Product.create({
      ...req.body,
      creditCoins,
      variantEnabled: req.body.variantEnabled !== "false",
      image: image || req.body.image,
      companyId: req.user.companyId
    }, { transaction });
    const variantRows = variants.length ? variants : [{ variantName: "Standard", colorName: "Default", stockQuantity: Number(req.body.quantity || 0), priceOverride: null, skuSuffix: null }];
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
      skuSuffix: row.skuSuffix || null,
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
      sku: req.body.sku ?? product.sku,
      category: req.body.category ?? product.category,
      description: req.body.description ?? product.description,
      price: req.body.price ?? product.price,
      creditCoins: Math.max(0, Number(req.body.creditCoins ?? product.creditCoins ?? 0)),
      image: publicPath("products", req.file) || req.body.image || product.image,
      status: req.body.status ?? product.status
    }, { transaction });
    if (variants) {
      for (const row of variants) {
        if (row.id) {
          await ProductVariant.update({
            variantName: row.variantName || "Standard",
            colorName: row.colorName || "Default",
            stockQuantity: Math.max(0, Number(row.stockQuantity || 0)),
            priceOverride: row.priceOverride === "" || row.priceOverride == null ? null : Number(row.priceOverride),
            skuSuffix: row.skuSuffix || null,
            image: row.image || null,
            status: row.status || "active"
          }, { where: { id: row.id, companyId: req.user.companyId, productId: product.id }, transaction });
        } else {
          await ProductVariant.create({
            companyId: req.user.companyId,
            productId: product.id,
            variantName: row.variantName || "Standard",
            colorName: row.colorName || "Default",
            stockQuantity: Math.max(0, Number(row.stockQuantity || 0)),
            priceOverride: row.priceOverride === "" || row.priceOverride == null ? null : Number(row.priceOverride),
            skuSuffix: row.skuSuffix || null,
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
  await variant.update({
    variantName: req.body.variantName ?? variant.variantName,
    colorName: req.body.colorName ?? variant.colorName,
    stockQuantity,
    priceOverride: req.body.priceOverride === "" ? null : req.body.priceOverride ?? variant.priceOverride,
    skuSuffix: req.body.skuSuffix ?? variant.skuSuffix,
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
  const rows = await DealerSale.findAll({ where, include: [Product, Dealer], order: [["saleDate", "DESC"], ["createdAt", "DESC"]] });
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
  const { area, dealerId, startDate, endDate, productId, paymentStatus } = req.query;
  const dealerWhere = { companyId };
  if (area) dealerWhere.area = area;
  const dealers = await Dealer.findAll({ where: dealerWhere, order: [["dealerName", "ASC"]] });
  const dealerIds = dealers.map((dealer) => dealer.id);
  const selectedDealerId = Number(dealerId || dealerIds[0] || 0);
  const scopedDealerIds = selectedDealerId ? dealerIds.filter((id) => id === selectedDealerId) : dealerIds;
  const createdRange = dateWhere(startDate, endDate);
  const orderWhere = { companyId, dealerId: scopedDealerIds.length ? scopedDealerIds : [0] };
  if (createdRange) orderWhere.createdAt = createdRange;
  const paymentWhere = { companyId, dealerId: scopedDealerIds.length ? scopedDealerIds : [0] };
  if (["paid", "pending", "failed"].includes(paymentStatus)) paymentWhere.paymentStatus = paymentStatus;
  if (["cash", "online"].includes(paymentStatus)) paymentWhere.paymentMethod = paymentStatus;
  if (createdRange) paymentWhere.createdAt = createdRange;
  const salesWhere = { companyId, dealerId: scopedDealerIds.length ? scopedDealerIds : [0] };
  if (productId) salesWhere.productId = productId;
  if (startDate || endDate) salesWhere.saleDate = dateWhere(startDate, endDate);

  const [areasRows, orders, payments, sales, inventory, wallet, transactions, redemptions] = await Promise.all([
    Dealer.findAll({ where: { companyId }, attributes: ["area"], group: ["area"] }),
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

  res.json({
    filters: {
      areas: areasRows.map((row) => row.area || "Unassigned"),
      dealers
    },
    summary: {
      totalOrders: orders.length,
      approvedOrders: orders.filter((order) => order.status === "approved").length,
      deliveredOrders: orders.filter((order) => order.status === "delivered").length,
      rejectedOrders: orders.filter((order) => order.status === "rejected").length,
      totalPurchaseAmount: orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0),
      totalPaidAmount: paidAmount,
      pendingPaymentAmount: pendingAmount,
      totalSalesUnits: sales.reduce((sum, sale) => sum + Number(sale.quantitySold || 0), 0),
      currentInventoryValue: inventoryValue,
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
        { status: "cash", count: payments.filter((payment) => payment.paymentMethod === "cash").length },
        { status: "online", count: payments.filter((payment) => payment.paymentMethod === "online").length }
      ].filter((row) => row.count > 0),
      orderStatus: countBy(orders, (order) => order.status),
      productWisePurchases: productWise(orderItems, (item) => item.quantity),
      productWiseSales: productWise(sales, (sale) => sale.quantitySold),
      creditEarnedRedeemed: creditByMonth
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
