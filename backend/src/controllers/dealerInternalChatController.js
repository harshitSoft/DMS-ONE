const { Op } = require("sequelize");
const asyncHandler = require("../utils/asyncHandler");
const { DealerInternalMessage, User } = require("../models");
const { normalizeRole } = require("../middleware/auth");

const dealerTeamRoles = ["DEALER", "DEALER_CEO", "DEALER_STOCK_INVENTORY_MANAGER", "DEALER_STOCK_DELIVERY_MANAGER", "DEALER_SALES_FINANCE_MANAGER"];

function teamWhere(req) {
  return {
    companyId: req.user.companyId,
    dealerId: req.user.dealerId,
    role: dealerTeamRoles,
    status: "active"
  };
}

exports.conversations = asyncHandler(async (req, res) => {
  const users = await User.findAll({
    where: { ...teamWhere(req), id: { [Op.ne]: req.user.id } },
    attributes: ["id", "name", "email", "role", "status"],
    order: [["name", "ASC"]]
  });
  const unread = await DealerInternalMessage.findAll({
    where: { receiverId: req.user.id, isRead: false },
    attributes: ["senderId"]
  });
  const unreadMap = unread.reduce((acc, row) => ({ ...acc, [row.senderId]: (acc[row.senderId] || 0) + 1 }), {});
  res.json(users.map((user) => ({ ...user.toJSON(), role: normalizeRole(user.role), unreadCount: unreadMap[user.id] || 0 })));
});

exports.messages = asyncHandler(async (req, res) => {
  const other = await User.findOne({ where: { ...teamWhere(req), id: req.params.userId } });
  if (!other) return res.status(404).json({ message: "Team member not found" });
  res.json(await DealerInternalMessage.findAll({
    where: {
      companyId: req.user.companyId,
      dealerId: req.user.dealerId,
      [Op.or]: [
        { senderId: req.user.id, receiverId: other.id },
        { senderId: other.id, receiverId: req.user.id }
      ]
    },
    include: [{ model: User, as: "sender", attributes: ["id", "name", "role"] }],
    order: [["createdAt", "ASC"]]
  }));
});

exports.send = asyncHandler(async (req, res) => {
  if (!req.body.receiverId || !req.body.message) return res.status(400).json({ message: "Receiver and message are required" });
  const receiver = await User.findOne({ where: { ...teamWhere(req), id: req.body.receiverId } });
  if (!receiver) return res.status(404).json({ message: "Team member not found" });
  const message = await DealerInternalMessage.create({
    companyId: req.user.companyId,
    dealerId: req.user.dealerId,
    senderId: req.user.id,
    receiverId: receiver.id,
    message: req.body.message
  });
  res.status(201).json(message);
});

exports.markRead = asyncHandler(async (req, res) => {
  const message = await DealerInternalMessage.findOne({
    where: { id: req.params.messageId, companyId: req.user.companyId, dealerId: req.user.dealerId, receiverId: req.user.id }
  });
  if (!message) return res.status(404).json({ message: "Message not found" });
  await message.update({ isRead: true });
  res.json(message);
});
