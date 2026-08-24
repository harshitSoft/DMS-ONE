const models = require('../models');

async function hardDeleteUser(id) {
  try {
    if (models.SuperAdminTarget) {
      await models.SuperAdminTarget.destroy({ where: { createdBy: id } });
      await models.SuperAdminTarget.destroy({ where: { assignedTo: id } });
    }
    if (models.SuperAdminPinnedMessage) {
      await models.SuperAdminPinnedMessage.destroy({ where: { createdBy: id } });
      await models.SuperAdminPinnedMessage.destroy({ where: { assignedTo: id } });
    }
    if (models.SuperAdminChat) {
      await models.SuperAdminChat.destroy({ where: { senderId: id } });
      await models.SuperAdminChat.destroy({ where: { receiverId: id } });
    }
    if (models.AdminInternalMessage) {
      await models.AdminInternalMessage.destroy({ where: { senderId: id } });
      await models.AdminInternalMessage.destroy({ where: { receiverId: id } });
    }
    if (models.DealerInternalMessage) {
      await models.DealerInternalMessage.destroy({ where: { senderId: id } });
      await models.DealerInternalMessage.destroy({ where: { receiverId: id } });
    }
    if (models.AdminPinnedMessage) {
      await models.AdminPinnedMessage.destroy({ where: { createdBy: id } });
      await models.AdminPinnedMessage.destroy({ where: { assignedTo: id } });
    }
    if (models.InternalNotification) {
      await models.InternalNotification.destroy({ where: { userId: id } });
    }
    if (models.DealerStockTransferLog) {
      await models.DealerStockTransferLog.destroy({ where: { actionBy: id } });
    }
    if (models.Message) {
      await models.Message.destroy({ where: { senderId: id } });
    }
    
    // Nullify references that shouldn't be hard-deleted
    if (models.LicensePurchaseRequest) {
      await models.LicensePurchaseRequest.update({ requestedBy: null }, { where: { requestedBy: id } }).catch(() => {});
      await models.LicensePurchaseRequest.update({ salesApprovedBy: null }, { where: { salesApprovedBy: id } }).catch(() => {});
      await models.LicensePurchaseRequest.update({ financeVerifiedBy: null }, { where: { financeVerifiedBy: id } }).catch(() => {});
    }
  } catch (error) {
    console.error("Cleanup error before user deletion:", error);
  }
}

module.exports = { hardDeleteUser };
