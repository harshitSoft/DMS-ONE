const progressByStatus = {
  pending: 0,
  approved: 10,
  packing: 25,
  shipping: 50,
  out_for_delivery: 75,
  delivered: 100,
  rejected: 0,
  cancelled: 0
};

const deliverySteps = ["packing", "shipping", "out_for_delivery", "delivered"];

function progressForStatus(status) {
  return progressByStatus[status] ?? 0;
}

function activeDeliveryStep(status) {
  if (deliverySteps.includes(status)) return status;
  if (status === "approved") return "packing";
  return status;
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateValue);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

module.exports = { progressForStatus, activeDeliveryStep, daysUntil, deliverySteps };
