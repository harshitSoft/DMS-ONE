const { Op } = require("sequelize");
const asyncHandler = require("../utils/asyncHandler");
const {
  sequelize,
  User,
  Dealer,
  Product,
  ProductVariant,
  CompanyInventory,
  DealerInventory,
  DealerStockTransferRequest,
  DealerStockTransferLog,
  InternalNotification,
  Message
} = require("../models");

const activeStatuses = ["REQUESTED", "MANAGER_APPROVED"];
function enabled(req, res, next) {
  if (process.env.ENABLE_DEALER_STOCK_EXCHANGE === "false") return res.status(404).json({ message: "Dealer Stock Exchange is disabled" });
  next();
}

function variantWhere(productVariantId) {
  return productVariantId ? { productVariantId } : { productVariantId: { [Op.is]: null } };
}

function requestInclude() {
  return [
    { model: Dealer, as: "requesterDealer", attributes: ["id", "dealerName", "ownerName", "area", "city", "address", "pincode"] },
    { model: Dealer, as: "senderDealer", attributes: ["id", "dealerName", "ownerName", "area", "city", "address", "pincode"] },
    { model: Product, attributes: ["id", "productName", "sku", "image"] },
    { model: ProductVariant, attributes: ["id", "variantName", "colorName"] }
  ];
}

async function dealerDisplay(dealerId) {
  const dealer = await Dealer.findByPk(dealerId);
  return dealer?.dealerName || `Dealer #${dealerId}`;
}

async function notifyCompanyRoles(companyId, roles, payload, transaction) {
  const users = await User.findAll({ where: { companyId, role: roles, status: "active" }, transaction });
  await Promise.all(users.map((user) => InternalNotification.create({
    companyId,
    userId: user.id,
    roleTarget: "ADMIN",
    title: payload.title,
    message: payload.message,
    type: "INVENTORY",
    priority: payload.priority || "MEDIUM",
    metadata: payload.metadata || null
  }, { transaction })));
}

async function notifyDealer(companyId, dealerId, payload, transaction) {
  await InternalNotification.create({
    companyId,
    dealerId,
    roleTarget: "DEALER",
    title: payload.title,
    message: payload.message,
    type: "INVENTORY",
    priority: payload.priority || "MEDIUM",
    metadata: payload.metadata || null
  }, { transaction });
}

async function createDealerMessage(companyId, dealerId, senderId, title, text, transaction) {
  await Message.create({
    companyId,
    senderId,
    receiverId: null,
    dealerId,
    conversationId: `${companyId}-${dealerId}`,
    title,
    message: text,
    messageType: "dealer_stock_exchange",
    isRead: false
  }, { transaction });
}

async function logAction(request, action, actionBy, message, transaction) {
  await DealerStockTransferLog.create({ transferRequestId: request.id, companyId: request.companyId, action, actionBy, message }, { transaction });
}

async function currentSenderStock(request, transaction) {
  return DealerInventory.findOne({
    where: {
      companyId: request.companyId,
      dealerId: request.senderDealerId,
      productId: request.productId,
      ...variantWhere(request.productVariantId)
    },
    lock: transaction ? true : undefined,
    transaction
  });
}

exports.enabled = enabled;

exports.search = asyncHandler(async (req, res) => {
  const sku = String(req.query.sku || "").trim();
  if (!sku) return res.status(400).json({ message: "SKU is required" });
  const product = await Product.findOne({
    where: { companyId: req.user.companyId, sku, status: "active" },
    include: [{ model: CompanyInventory }, { model: ProductVariant, as: "variants", where: { status: "active" }, required: false }]
  });
  if (!product) return res.status(404).json({ message: "Product not found" });
  const dealerInventory = await DealerInventory.findAll({
    where: { companyId: req.user.companyId, productId: product.id, dealerId: { [Op.ne]: req.user.dealerId }, quantity: { [Op.gt]: 0 } },
    include: [{ model: Dealer, where: { companyId: req.user.companyId, status: "active" } }, ProductVariant],
    order: [[Dealer, "dealerName", "ASC"]]
  });
  res.json({
    product: {
      id: product.id,
      productName: product.productName,
      sku: product.sku,
      image: product.image,
      description: product.description,
      companyStock: Number(product.CompanyInventory?.quantity || 0),
      isCompanyOutOfStock: Number(product.CompanyInventory?.quantity || 0) <= 0
    },
    availableDealers: dealerInventory.map((item) => ({
      dealerId: item.dealerId,
      dealerName: item.Dealer?.dealerName,
      ownerName: item.Dealer?.ownerName,
      city: item.Dealer?.city,
      area: item.Dealer?.area,
      address: item.Dealer?.address,
      pincode: item.Dealer?.pincode,
      productId: item.productId,
      productVariantId: item.productVariantId,
      variantName: item.variantName || item.ProductVariant?.variantName,
      colorName: item.colorName || item.ProductVariant?.colorName,
      skuSuffix: item.ProductVariant?.skuSuffix,
      availableQuantity: Number(item.quantity || 0),
      lowStockLimit: Number(item.lowStockLimit || 0)
    }))
  });
});

exports.createRequest = asyncHandler(async (req, res) => {
  const senderDealerId = Number(req.body.senderDealerId);
  const productId = Number(req.body.productId);
  const productVariantId = req.body.productVariantId ? Number(req.body.productVariantId) : null;
  const requestedQuantity = Number(req.body.requestedQuantity);
  if (!Number.isInteger(requestedQuantity) || requestedQuantity <= 0) return res.status(400).json({ message: "requestedQuantity must be greater than 0" });
  if (senderDealerId === Number(req.user.dealerId)) return res.status(400).json({ message: "You cannot request stock from yourself" });

  const result = await sequelize.transaction(async (transaction) => {
    const [sender, requester, product] = await Promise.all([
      Dealer.findOne({ where: { id: senderDealerId, companyId: req.user.companyId, status: "active" }, transaction }),
      Dealer.findOne({ where: { id: req.user.dealerId, companyId: req.user.companyId, status: "active" }, transaction }),
      Product.findOne({ where: { id: productId, companyId: req.user.companyId, status: "active" }, transaction })
    ]);
    if (!sender || !requester) {
      const error = new Error("Requester and sender must belong to the same company");
      error.status = 400;
      throw error;
    }
    if (!product) {
      const error = new Error("Product not found");
      error.status = 404;
      throw error;
    }
    const inventory = await DealerInventory.findOne({
      where: { companyId: req.user.companyId, dealerId: senderDealerId, productId, ...variantWhere(productVariantId), quantity: { [Op.gt]: 0 } },
      lock: true,
      transaction
    });
    if (!inventory) {
      const error = new Error("Sender dealer does not have stock for this product");
      error.status = 400;
      throw error;
    }
    const available = Number(inventory.quantity || 0);
    if (requestedQuantity > available) {
      const error = new Error("Requested quantity cannot exceed sender dealer available stock");
      error.status = 400;
      error.availableStock = available;
      throw error;
    }
    const duplicate = await DealerStockTransferRequest.findOne({
      where: { companyId: req.user.companyId, requesterDealerId: req.user.dealerId, senderDealerId, productId, ...variantWhere(productVariantId), status: activeStatuses },
      transaction
    });
    if (duplicate) {
      const error = new Error("An active request for this product from this dealer already exists");
      error.status = 409;
      throw error;
    }
    const request = await DealerStockTransferRequest.create({
      companyId: req.user.companyId,
      requesterDealerId: req.user.dealerId,
      senderDealerId,
      productId,
      productVariantId,
      sku: product.sku,
      productNameSnapshot: product.productName,
      variantNameSnapshot: inventory.variantName,
      colorNameSnapshot: inventory.colorName,
      requestedQuantity,
      availableQuantityAtRequest: available,
      reason: req.body.reason || null,
      status: "REQUESTED"
    }, { transaction });
    const text = `New inter-dealer stock request: ${requester.dealerName} requested ${requestedQuantity} ${product.productName} from ${sender.dealerName}.`;
    await notifyCompanyRoles(req.user.companyId, ["PRODUCT_DELIVERY_MANAGER"], { title: "Inter-dealer stock request", message: text, metadata: { transferRequestId: request.id } }, transaction);
    await notifyCompanyRoles(req.user.companyId, ["ADMIN_CEO", "ADMIN"], { title: "Inter-dealer stock request", message: text, priority: "LOW", metadata: { transferRequestId: request.id } }, transaction);
    await notifyDealer(req.user.companyId, senderDealerId, { title: "Stock requested from your inventory", message: `${requester.dealerName} has requested ${requestedQuantity} ${product.productName} from your inventory. Awaiting approvals.`, metadata: { transferRequestId: request.id } }, transaction);
    await createDealerMessage(req.user.companyId, senderDealerId, req.user.id, "Inter-dealer stock request", `${requester.dealerName} has requested ${requestedQuantity} ${product.productName} from your inventory. Awaiting approvals.`, transaction);
    await logAction(request, "REQUESTED", req.user.id, text, transaction);
    return request;
  }).catch((error) => {
    if (error.status) {
      res.status(error.status).json({ message: error.message, availableStock: error.availableStock });
      return null;
    }
    throw error;
  });
  if (!result) return;
  res.status(201).json(await DealerStockTransferRequest.findByPk(result.id, { include: requestInclude() }));
});

exports.sentRequests = asyncHandler(async (req, res) => {
  const where = { companyId: req.user.companyId, requesterDealerId: req.user.dealerId };
  if (req.query.status && req.query.status !== "ALL") where.status = req.query.status;
  if (req.query.search) {
    where[Op.or] = [{ productNameSnapshot: { [Op.like]: `%${req.query.search}%` } }, { sku: { [Op.like]: `%${req.query.search}%` } }];
  }
  res.json(await DealerStockTransferRequest.findAll({ where, include: requestInclude(), order: [["createdAt", "DESC"]] }));
});

exports.receivedRequests = asyncHandler(async (req, res) => {
  const where = { companyId: req.user.companyId, senderDealerId: req.user.dealerId };
  if (req.query.completedOnly === "true") where.status = "TRANSFER_COMPLETED";
  if (req.query.search) {
    where[Op.or] = [{ productNameSnapshot: { [Op.like]: `%${req.query.search}%` } }, { sku: { [Op.like]: `%${req.query.search}%` } }];
  }
  res.json(await DealerStockTransferRequest.findAll({ where, include: requestInclude(), order: [["createdAt", "DESC"]] }));
});

exports.history = asyncHandler(async (req, res) => {
  res.json(await DealerStockTransferRequest.findAll({
    where: { companyId: req.user.companyId, [Op.or]: [{ requesterDealerId: req.user.dealerId }, { senderDealerId: req.user.dealerId }] },
    include: requestInclude(),
    order: [["createdAt", "DESC"]]
  }));
});

exports.cancel = asyncHandler(async (req, res) => {
  const request = await DealerStockTransferRequest.findOne({ where: { id: req.params.id, companyId: req.user.companyId, requesterDealerId: req.user.dealerId, status: "REQUESTED" } });
  if (!request) return res.status(404).json({ message: "Cancelable request not found" });
  await request.update({ status: "CANCELLED" });
  await logAction(request, "CANCELLED", req.user.id, "Request cancelled by dealer");
  res.json(request);
});

exports.reminder = asyncHandler(async (req, res) => {
  const request = await DealerStockTransferRequest.findOne({ where: { id: req.params.id, companyId: req.user.companyId, senderDealerId: req.user.dealerId, status: "TRANSFER_COMPLETED" }, include: requestInclude() });
  if (!request) return res.status(404).json({ message: "Completed transfer not found" });
  const note = req.body.note || `Reminder: We shared ${request.requestedQuantity} units of ${request.productNameSnapshot} with you. Please return the product when available in your stock or complete the payment/settlement as discussed.`;
  await request.update({ reminderSentAt: new Date(), returnReminderNote: note });
  await createDealerMessage(request.companyId, request.requesterDealerId, req.user.id, "Return/Payment reminder", note);
  await notifyDealer(request.companyId, request.requesterDealerId, { title: "Return/Payment reminder", message: note, metadata: { transferRequestId: request.id } });
  await logAction(request, "REMINDER_SENT", req.user.id, note);
  res.json({ message: "Reminder sent", request });
});

exports.adminRequests = asyncHandler(async (req, res) => {
  const where = { companyId: req.user.companyId };
  if (req.query.status) where.status = req.query.status;
  const rows = await DealerStockTransferRequest.findAll({ where, include: requestInclude(), order: [["createdAt", "DESC"]] });
  const counts = await Promise.all(["REQUESTED", "MANAGER_APPROVED", "TRANSFER_COMPLETED", "MANAGER_REJECTED", "ADMIN_REJECTED"].map(async (status) => ({ status, count: await DealerStockTransferRequest.count({ where: { companyId: req.user.companyId, status } }) })));
  res.json({ rows, analytics: Object.fromEntries(counts.map((row) => [row.status, row.count])) });
});

exports.managerApprove = asyncHandler(async (req, res) => {
  const request = await DealerStockTransferRequest.findOne({ where: { id: req.params.id, companyId: req.user.companyId, status: "REQUESTED" } });
  if (!request) return res.status(404).json({ message: "Pending request not found" });
  await request.update({ status: "MANAGER_APPROVED", managerApprovedBy: req.user.id, managerApprovedAt: new Date(), managerRejectReason: null });
  await notifyCompanyRoles(request.companyId, ["ADMIN_CEO", "ADMIN"], { title: "Final approval required", message: "Inter-dealer stock request approved by Product & Delivery Manager. Final approval required.", metadata: { transferRequestId: request.id } });
  await logAction(request, "MANAGER_APPROVED", req.user.id, "Manager approved request");
  res.json(await DealerStockTransferRequest.findByPk(request.id, { include: requestInclude() }));
});

exports.managerReject = asyncHandler(async (req, res) => {
  const request = await DealerStockTransferRequest.findOne({ where: { id: req.params.id, companyId: req.user.companyId, status: "REQUESTED" } });
  if (!request) return res.status(404).json({ message: "Pending request not found" });
  await request.update({ status: "MANAGER_REJECTED", managerApprovedBy: req.user.id, managerApprovedAt: new Date(), managerRejectReason: req.body.reason || "Rejected by Product & Delivery Manager" });
  await notifyDealer(request.companyId, request.requesterDealerId, { title: "Stock request rejected", message: request.managerRejectReason, metadata: { transferRequestId: request.id } });
  await logAction(request, "MANAGER_REJECTED", req.user.id, request.managerRejectReason);
  res.json(request);
});

exports.adminCeoRequests = asyncHandler(async (req, res) => {
  const rows = await DealerStockTransferRequest.findAll({ where: { companyId: req.user.companyId }, include: requestInclude(), order: [["createdAt", "DESC"]] });
  const completed = rows.filter((row) => row.status === "TRANSFER_COMPLETED");
  const topBy = (field, labelFn) => {
    const map = completed.reduce((acc, row) => {
      const key = row[field];
      acc[key] = acc[key] || { id: key, label: labelFn(row), count: 0 };
      acc[key].count += 1;
      return acc;
    }, {});
    return Object.values(map).sort((a, b) => b.count - a.count)[0] || null;
  };
  res.json({
    rows,
    approvals: rows.filter((row) => row.status === "MANAGER_APPROVED"),
    analytics: {
      totalTransferRequests: rows.length,
      pendingApprovals: rows.filter((row) => ["REQUESTED", "MANAGER_APPROVED"].includes(row.status)).length,
      completedTransfers: completed.length,
      rejectedRequests: rows.filter((row) => ["MANAGER_REJECTED", "ADMIN_REJECTED"].includes(row.status)).length,
      topProductRequested: topBy("productId", (row) => row.productNameSnapshot),
      topDealerSender: topBy("senderDealerId", (row) => row.senderDealer?.dealerName),
      topDealerRequester: topBy("requesterDealerId", (row) => row.requesterDealer?.dealerName)
    }
  });
});

exports.finalApprove = asyncHandler(async (req, res) => {
  const result = await sequelize.transaction(async (transaction) => {
    const request = await DealerStockTransferRequest.findOne({ where: { id: req.params.id, companyId: req.user.companyId, status: "MANAGER_APPROVED" }, lock: true, transaction });
    if (!request) {
      const error = new Error("Manager-approved request not found");
      error.status = 404;
      throw error;
    }
    const senderInventory = await currentSenderStock(request, transaction);
    const available = Number(senderInventory?.quantity || 0);
    if (!senderInventory || available < Number(request.requestedQuantity)) {
      const error = new Error("Sender dealer no longer has enough stock.");
      error.status = 400;
      throw error;
    }
    const [requesterInventory] = await DealerInventory.findOrCreate({
      where: { companyId: request.companyId, dealerId: request.requesterDealerId, productId: request.productId, ...variantWhere(request.productVariantId) },
      defaults: {
        companyId: request.companyId,
        dealerId: request.requesterDealerId,
        productId: request.productId,
        productVariantId: request.productVariantId,
        variantName: request.variantNameSnapshot,
        colorName: request.colorNameSnapshot,
        quantity: 0,
        lowStockLimit: 5
      },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    await senderInventory.update({ quantity: available - Number(request.requestedQuantity) }, { transaction });
    await requesterInventory.update({ quantity: Number(requesterInventory.quantity || 0) + Number(request.requestedQuantity) }, { transaction });
    await request.update({ status: "TRANSFER_COMPLETED", adminApprovedBy: req.user.id, adminApprovedAt: new Date(), completedAt: new Date() }, { transaction });
    await logAction(request, "TRANSFER_COMPLETED", req.user.id, "Admin CEO final approval completed inventory transfer", transaction);
    const senderName = await dealerDisplay(request.senderDealerId);
    const requesterName = await dealerDisplay(request.requesterDealerId);
    await notifyDealer(request.companyId, request.requesterDealerId, { title: "Stock transfer completed", message: `${request.requestedQuantity} ${request.productNameSnapshot} transferred from ${senderName}.`, metadata: { transferRequestId: request.id } }, transaction);
    await notifyDealer(request.companyId, request.senderDealerId, { title: "Stock transfer completed", message: `${request.requestedQuantity} ${request.productNameSnapshot} transferred to ${requesterName}.`, metadata: { transferRequestId: request.id } }, transaction);
    await notifyCompanyRoles(request.companyId, ["PRODUCT_DELIVERY_MANAGER"], { title: "Transfer completed", message: "Admin CEO final approval completed the inter-dealer stock transfer.", metadata: { transferRequestId: request.id } }, transaction);
    return request;
  }).catch((error) => {
    if (error.status) {
      res.status(error.status).json({ message: error.message });
      return null;
    }
    throw error;
  });
  if (!result) return;
  res.json(await DealerStockTransferRequest.findByPk(result.id, { include: requestInclude() }));
});

exports.finalReject = asyncHandler(async (req, res) => {
  const request = await DealerStockTransferRequest.findOne({ where: { id: req.params.id, companyId: req.user.companyId, status: "MANAGER_APPROVED" } });
  if (!request) return res.status(404).json({ message: "Manager-approved request not found" });
  await request.update({ status: "ADMIN_REJECTED", adminApprovedBy: req.user.id, adminApprovedAt: new Date(), adminRejectReason: req.body.reason || "Rejected by Admin CEO" });
  await notifyDealer(request.companyId, request.requesterDealerId, { title: "Stock request rejected", message: request.adminRejectReason, metadata: { transferRequestId: request.id } });
  await logAction(request, "ADMIN_REJECTED", req.user.id, request.adminRejectReason);
  res.json(request);
});
