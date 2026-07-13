const { Op } = require("sequelize");
const asyncHandler = require("../utils/asyncHandler");
const { InternalNotification } = require("../models");

function visibilityWhere(user) {
  if (["SUPER_ADMIN", "SUPER_ADMIN_CEO", "SUPER_ADMIN_IT_MANAGER", "SUPER_ADMIN_SALES_MANAGER", "SUPER_ADMIN_FINANCE_MANAGER"].includes(user.role)) {
    return {
      [Op.or]: [
        { roleTarget: "SUPER_ADMIN" },
        { roleTarget: "ALL", companyId: null },
        { userId: user.id }
      ]
    };
  }
  if (["ADMIN", "ADMIN_CEO", "DEALER_MANAGER", "PRODUCT_DELIVERY_MANAGER", "FINANCE_MANAGER"].includes(user.role)) {
    return {
      companyId: user.companyId,
      [Op.or]: [
        { roleTarget: "ADMIN" },
        { roleTarget: "ALL" },
        { userId: user.id },
        { dealerId: { [Op.ne]: null } }
      ]
    };
  }
  return {
    companyId: user.companyId,
    [Op.or]: [
      { roleTarget: "DEALER", dealerId: user.dealerId },
      { roleTarget: "ALL", dealerId: user.dealerId },
      { userId: user.id }
    ]
  };
}

exports.list = asyncHandler(async (req, res) => {
  const where = visibilityWhere(req.user);
  if (req.query.unread === "true") where.isRead = false;
  if (req.query.type) where.type = req.query.type;
  const rows = await InternalNotification.findAll({ where, order: [["createdAt", "DESC"]] });
  const unreadCount = await InternalNotification.count({ where: { ...visibilityWhere(req.user), isRead: false } });
  res.json({ rows, unreadCount });
});

exports.markRead = asyncHandler(async (req, res) => {
  const notification = await InternalNotification.findOne({ where: { id: req.params.id, ...visibilityWhere(req.user) } });
  if (!notification) return res.status(404).json({ message: "Notification not found" });
  await notification.update({ isRead: true });
  res.json(notification);
});

exports.markAllRead = asyncHandler(async (req, res) => {
  const [updated] = await InternalNotification.update({ isRead: true }, { where: { ...visibilityWhere(req.user), isRead: false } });
  res.json({ updated });
});

exports.remove = asyncHandler(async (req, res) => {
  const notification = await InternalNotification.findOne({ where: { id: req.params.id, ...visibilityWhere(req.user) } });
  if (!notification) return res.status(404).json({ message: "Notification not found" });
  await notification.destroy();
  res.json({ message: "Notification deleted" });
});
