const cron = require("node-cron");
const { OrderScheduledMessage, Message, sequelize } = require("../models");
const { localDateOnly } = require("../utils/date");

function orderNumberFromMessage(messageText) {
  const match = messageText.match(/#([A-Za-z0-9-]+)/);
  return match ? match[1] : null;
}

async function sendDueScheduledMessages(runDate = localDateOnly()) {
  const dueMessages = await OrderScheduledMessage.findAll({
    where: { scheduledDate: runDate, isSent: false },
    order: [["createdAt", "ASC"]]
  });

  for (const scheduled of dueMessages) {
    await sequelize.transaction(async (transaction) => {
      const locked = await OrderScheduledMessage.findOne({
        where: { id: scheduled.id, isSent: false },
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      if (!locked) return;

      await Message.create({
        companyId: locked.companyId,
        senderId: locked.senderId,
        receiverId: null,
        dealerId: locked.dealerId,
        conversationId: `${locked.companyId}-${locked.dealerId}`,
        title: "Order update",
        message: locked.messageText,
        messageType: "system_order_update",
        orderNumber: orderNumberFromMessage(locked.messageText),
        isRead: false
      }, { transaction });

      await locked.update({ isSent: true, sentAt: new Date() }, { transaction });
    });
  }

  return dueMessages.length;
}

function startScheduledMessagesJob() {
  cron.schedule("5 0 * * *", () => {
    sendDueScheduledMessages().catch((error) => console.error("Scheduled message job failed", error));
  });

  sendDueScheduledMessages().catch((error) => console.error("Scheduled message startup check failed", error));
}

module.exports = { startScheduledMessagesJob, sendDueScheduledMessages };
