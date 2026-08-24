const bcrypt = require("bcryptjs");
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const User = sequelize.define("User", {
  name: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  phone: { type: DataTypes.STRING, allowNull: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM("SUPER_ADMIN", "SUPER_ADMIN_CEO", "SUPER_ADMIN_IT_MANAGER", "SUPER_ADMIN_SALES_MANAGER", "SUPER_ADMIN_FINANCE_MANAGER", "ADMIN", "ADMIN_CEO", "DEALER_MANAGER", "PRODUCT_DELIVERY_MANAGER", "FINANCE_MANAGER", "DEALER", "DEALER_CEO", "DEALER_STOCK_INVENTORY_MANAGER", "DEALER_STOCK_DELIVERY_MANAGER", "DEALER_SALES_FINANCE_MANAGER"), allowNull: false },
  companyId: { type: DataTypes.INTEGER, allowNull: true },
  dealerId: { type: DataTypes.INTEGER, allowNull: true },
  isTwoFactorEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  twoFactorOtp: { type: DataTypes.STRING(10), allowNull: true },
  twoFactorOtpExpiry: { type: DataTypes.DATE, allowNull: true },
  twoFactorVerifiedAt: { type: DataTypes.DATE, allowNull: true },
  passwordResetOtp: { type: DataTypes.STRING(10), allowNull: true },
  passwordResetOtpExpiry: { type: DataTypes.DATE, allowNull: true },
  forgotPasswordOtp: { type: DataTypes.STRING(10), allowNull: true },
  forgotPasswordOtpExpiry: { type: DataTypes.DATE, allowNull: true },
  passwordChangeRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  passwordChangedAt: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" }
}, {
  hooks: {
    beforeCreate: async (user) => { user.password = await bcrypt.hash(user.password, 12); },
    beforeUpdate: async (user) => {
      if (user.changed("password")) user.password = await bcrypt.hash(user.password, 12);
    }
  }
});

const Company = sequelize.define("Company", {
  companyName: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  phone: { type: DataTypes.STRING, allowNull: true },
  address: { type: DataTypes.TEXT, allowNull: true },
  city: { type: DataTypes.STRING, allowNull: true },
  state: { type: DataTypes.STRING, allowNull: true },
  pincode: { type: DataTypes.STRING, allowNull: true },
  adminName: { type: DataTypes.STRING, allowNull: false },
  adminEmail: { type: DataTypes.STRING, allowNull: false, validate: { isEmail: true } },
  adminPhone: { type: DataTypes.STRING, allowNull: true },
  startDate: { type: DataTypes.DATEONLY, allowNull: false },
  endDate: { type: DataTypes.DATEONLY, allowNull: true },
  paymentStatus: { type: DataTypes.ENUM("PENDING", "PAID", "REJECTED"), allowNull: false, defaultValue: "PAID" },
  subscriptionAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  approvedByFinance: { type: DataTypes.INTEGER, allowNull: true },
  financeApprovedAt: { type: DataTypes.DATE, allowNull: true },
  createdBySalesManager: { type: DataTypes.INTEGER, allowNull: true },
  selectedLicensePlanId: { type: DataTypes.INTEGER, allowNull: true },
  selectedLicenseQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  licenseDeliveredAt: { type: DataTypes.DATE, allowNull: true },
  salesNotes: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM("active", "inactive", "deleted", "expired", "blocked", "pending", "rejected"), defaultValue: "active" }
});

const LicensePlan = sequelize.define("LicensePlan", {
  name: { type: DataTypes.ENUM("Gold", "Platinum"), allowNull: false, unique: true },
  dealerLimit: { type: DataTypes.INTEGER, allowNull: false },
  price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  description: DataTypes.TEXT,
  status: { type: DataTypes.ENUM("active", "inactive"), allowNull: false, defaultValue: "active" }
}, { tableName: "license_plans" });

const LicenseInventory = sequelize.define("LicenseInventory", {
  licensePlanId: { type: DataTypes.INTEGER, allowNull: false },
  totalQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  availableQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  soldQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  createdBy: { type: DataTypes.INTEGER, allowNull: true },
  updatedBy: { type: DataTypes.INTEGER, allowNull: true }
}, { tableName: "license_inventory" });

const CompanyLicense = sequelize.define("CompanyLicense", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  licensePlanId: { type: DataTypes.INTEGER, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  dealerLimitAdded: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM("active", "expired", "revoked"), allowNull: false, defaultValue: "active" },
  purchaseRequestId: { type: DataTypes.INTEGER, allowNull: true },
  activatedAt: { type: DataTypes.DATE, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: true }
}, { tableName: "company_licenses" });

const LicensePurchaseRequest = sequelize.define("LicensePurchaseRequest", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  requestedBy: { type: DataTypes.INTEGER, allowNull: false },
  licensePlanId: { type: DataTypes.INTEGER, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  totalDealerLimit: { type: DataTypes.INTEGER, allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM("REQUESTED", "SALES_APPROVED", "FINANCE_PENDING", "PAYMENT_CONFIRMED", "PAYMENT_REJECTED", "LICENSE_DELIVERED", "REJECTED"), allowNull: false, defaultValue: "REQUESTED" },
  salesApprovedBy: { type: DataTypes.INTEGER, allowNull: true },
  salesApprovedAt: { type: DataTypes.DATE, allowNull: true },
  financeVerifiedBy: { type: DataTypes.INTEGER, allowNull: true },
  financeVerifiedAt: { type: DataTypes.DATE, allowNull: true },
  paymentStatus: { type: DataTypes.ENUM("PENDING", "PAID", "REJECTED"), allowNull: false, defaultValue: "PENDING" },
  paymentMethod: { type: DataTypes.STRING, allowNull: true },
  transactionReference: { type: DataTypes.STRING, allowNull: true },
  invoiceFile: { type: DataTypes.STRING, allowNull: true },
  note: { type: DataTypes.TEXT, allowNull: true }
}, { tableName: "license_purchase_requests" });

const SuperAdminTarget = sequelize.define("SuperAdminTarget", {
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
  assignedTo: { type: DataTypes.INTEGER, allowNull: false },
  targetType: { type: DataTypes.ENUM("SALES", "LICENSE_CREATION", "REVENUE", "GENERAL"), allowNull: false, defaultValue: "GENERAL" },
  title: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  targetValue: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  achievedValue: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  startDate: { type: DataTypes.DATEONLY, allowNull: true },
  endDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.ENUM("active", "completed", "cancelled"), allowNull: false, defaultValue: "active" }
}, { tableName: "super_admin_targets" });

const SuperAdminPinnedMessage = sequelize.define("SuperAdminPinnedMessage", {
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
  assignedTo: { type: DataTypes.INTEGER, allowNull: true },
  roleTarget: { type: DataTypes.STRING, allowNull: true },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  isPinned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, { tableName: "super_admin_pinned_messages" });

const SuperAdminChat = sequelize.define("SuperAdminChat", {
  senderId: { type: DataTypes.INTEGER, allowNull: false },
  receiverId: { type: DataTypes.INTEGER, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, { tableName: "super_admin_chats" });

const AdminInternalMessage = sequelize.define("AdminInternalMessage", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  senderId: { type: DataTypes.INTEGER, allowNull: false },
  receiverId: { type: DataTypes.INTEGER, allowNull: true },
  message: { type: DataTypes.TEXT, allowNull: false },
  attachmentUrl: { type: DataTypes.STRING, allowNull: true },
  attachmentName: { type: DataTypes.STRING, allowNull: true },
  isEdited: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, { tableName: "admin_internal_messages" });

const DealerInternalMessage = sequelize.define("DealerInternalMessage", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  dealerId: { type: DataTypes.INTEGER, allowNull: false },
  senderId: { type: DataTypes.INTEGER, allowNull: false },
  receiverId: { type: DataTypes.INTEGER, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, { tableName: "dealer_internal_messages" });

const AdminPinnedMessage = sequelize.define("AdminPinnedMessage", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  createdBy: { type: DataTypes.INTEGER, allowNull: false },
  assignedTo: { type: DataTypes.INTEGER, allowNull: true },
  roleTarget: { type: DataTypes.STRING, allowNull: true },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  priority: { type: DataTypes.ENUM("low", "medium", "high"), allowNull: false, defaultValue: "medium" },
  isPinned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, { tableName: "admin_pinned_messages" });

const Dealer = sequelize.define("Dealer", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  dealerName: { type: DataTypes.STRING, allowNull: false },
  ownerName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, validate: { isEmail: true } },
  phone: DataTypes.STRING,
  area: DataTypes.STRING,
  city: DataTypes.STRING,
  state: DataTypes.STRING,
  pincode: DataTypes.STRING,
  address: DataTypes.TEXT,
  status: { type: DataTypes.ENUM("active", "inactive", "blocked"), defaultValue: "active" }
});

const Product = sequelize.define("Product", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  productName: { type: DataTypes.STRING, allowNull: false },
  sku: { type: DataTypes.STRING, allowNull: false },
  category: DataTypes.STRING,
  description: DataTypes.TEXT,
  manufacturingDate: { type: DataTypes.DATEONLY, allowNull: true },
  expiryDate: { type: DataTypes.DATEONLY, allowNull: true },
  price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  creditCoins: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  variantEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  image: DataTypes.STRING,
  status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" }
});

const ProductVariant = sequelize.define("ProductVariant", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  variantName: { type: DataTypes.STRING, allowNull: false, defaultValue: "Standard" },
  colorName: { type: DataTypes.STRING, allowNull: false, defaultValue: "Default" },
  stockQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  priceOverride: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  skuSuffix: { type: DataTypes.STRING, allowNull: true },
  image: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" }
}, { tableName: "product_variants" });

const CompanyInventory = sequelize.define("CompanyInventory", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lowStockLimit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
  lastUpdatedBy: DataTypes.INTEGER
}, { tableName: "company_inventory" });

const DealerInventory = sequelize.define("DealerInventory", {
  dealerId: { type: DataTypes.INTEGER, allowNull: false },
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  productVariantId: { type: DataTypes.INTEGER, allowNull: true },
  variantName: { type: DataTypes.STRING, allowNull: true },
  colorName: { type: DataTypes.STRING, allowNull: true },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lowStockLimit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 }
}, { tableName: "dealer_inventory" });

const InternalNotification = sequelize.define("InternalNotification", {
  companyId: { type: DataTypes.INTEGER, allowNull: true },
  dealerId: { type: DataTypes.INTEGER, allowNull: true },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  roleTarget: { type: DataTypes.ENUM("ADMIN", "DEALER", "SUPER_ADMIN", "ALL"), allowNull: false, defaultValue: "ALL" },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.ENUM("LOW_STOCK", "SALES_UPDATE", "INVENTORY", "PAYMENT", "DELIVERY", "GENERAL"), allowNull: false, defaultValue: "GENERAL" },
  priority: { type: DataTypes.ENUM("LOW", "MEDIUM", "HIGH", "CRITICAL"), allowNull: false, defaultValue: "MEDIUM" },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  metadata: { type: DataTypes.JSON, allowNull: true }
}, { tableName: "internal_notifications" });

const DealerSale = sequelize.define("DealerSale", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  dealerId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  productVariantId: { type: DataTypes.INTEGER, allowNull: true },
  variantName: { type: DataTypes.STRING, allowNull: true },
  colorName: { type: DataTypes.STRING, allowNull: true },
  saleDate: { type: DataTypes.DATEONLY, allowNull: false },
  quantitySold: { type: DataTypes.INTEGER, allowNull: false },
  stockBefore: { type: DataTypes.INTEGER, allowNull: false },
  stockAfter: { type: DataTypes.INTEGER, allowNull: false },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  createdBy: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: "dealer_sales" });

const DealerStockTransferRequest = sequelize.define("DealerStockTransferRequest", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  requesterDealerId: { type: DataTypes.INTEGER, allowNull: false },
  senderDealerId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  productVariantId: { type: DataTypes.INTEGER, allowNull: true },
  sku: { type: DataTypes.STRING, allowNull: false },
  productNameSnapshot: { type: DataTypes.STRING, allowNull: false },
  variantNameSnapshot: { type: DataTypes.STRING, allowNull: true },
  colorNameSnapshot: { type: DataTypes.STRING, allowNull: true },
  requestedQuantity: { type: DataTypes.INTEGER, allowNull: false },
  availableQuantityAtRequest: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM("REQUESTED", "MANAGER_APPROVED", "MANAGER_REJECTED", "ADMIN_APPROVED", "ADMIN_REJECTED", "TRANSFER_COMPLETED", "CANCELLED"), allowNull: false, defaultValue: "REQUESTED" },
  managerApprovedBy: { type: DataTypes.INTEGER, allowNull: true },
  managerApprovedAt: { type: DataTypes.DATE, allowNull: true },
  managerRejectReason: { type: DataTypes.TEXT, allowNull: true },
  adminApprovedBy: { type: DataTypes.INTEGER, allowNull: true },
  adminApprovedAt: { type: DataTypes.DATE, allowNull: true },
  adminRejectReason: { type: DataTypes.TEXT, allowNull: true },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  reminderSentAt: { type: DataTypes.DATE, allowNull: true },
  returnReminderNote: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: "dealer_stock_transfer_requests",
  indexes: [
    { fields: ["companyId", "status"] },
    { fields: ["requesterDealerId"] },
    { fields: ["senderDealerId"] },
    { fields: ["productId", "productVariantId"] }
  ]
});

const DealerStockTransferLog = sequelize.define("DealerStockTransferLog", {
  transferRequestId: { type: DataTypes.INTEGER, allowNull: false },
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  action: { type: DataTypes.STRING, allowNull: false },
  actionBy: { type: DataTypes.INTEGER, allowNull: true },
  message: { type: DataTypes.TEXT, allowNull: true }
}, { tableName: "dealer_stock_transfer_logs", updatedAt: false });

const Order = sequelize.define("Order", {
  orderNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  dealerId: { type: DataTypes.INTEGER, allowNull: false },
  status: {
    type: DataTypes.ENUM("pending", "approved", "rejected", "packing", "shipping", "out_for_delivery", "delivered", "cancelled"),
    defaultValue: "pending"
  },
  totalAmount: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  deliveryDate: DataTypes.DATEONLY,
  rejectionReason: DataTypes.TEXT,
  packingDate: DataTypes.DATEONLY,
  shippingDate: DataTypes.DATEONLY,
  outForDeliveryDate: DataTypes.DATEONLY,
  deliveredDate: DataTypes.DATEONLY,
  approvedAt: DataTypes.DATE,
  approvedBy: DataTypes.INTEGER,
  currentDeliveryStep: DataTypes.STRING,
  deliveryProgress: { type: DataTypes.INTEGER, defaultValue: 0 },
  creditAwarded: { type: DataTypes.BOOLEAN, defaultValue: false },
  creditAwardedAt: DataTypes.DATE,
  inventoryAdded: { type: DataTypes.BOOLEAN, defaultValue: false },
  deliveredAt: DataTypes.DATE
});

const OrderItem = sequelize.define("OrderItem", {
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  productId: { type: DataTypes.INTEGER, allowNull: false },
  productVariantId: { type: DataTypes.INTEGER, allowNull: true },
  variantName: { type: DataTypes.STRING, allowNull: true },
  colorName: { type: DataTypes.STRING, allowNull: true },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  creditCoinsEarned: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false }
}, { tableName: "order_items", timestamps: false });

const DeliveryTracking = sequelize.define("DeliveryTracking", {
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING, allowNull: false },
  message: DataTypes.TEXT,
  updatedBy: DataTypes.INTEGER
}, { tableName: "delivery_tracking", updatedAt: false });

const Payment = sequelize.define("Payment", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  dealerId: { type: DataTypes.INTEGER, allowNull: false },
  orderId: { type: DataTypes.INTEGER, allowNull: true },
  invoiceNumber: { type: DataTypes.STRING, allowNull: true, unique: true },
  orderNumber: { type: DataTypes.STRING, allowNull: true },
  productSummary: { type: DataTypes.TEXT, allowNull: true },
  invoiceStatus: { type: DataTypes.STRING, defaultValue: "generated" },
  orderApprovedAt: { type: DataTypes.DATE, allowNull: true },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  paymentMethod: DataTypes.STRING,
  paymentStatus: { type: DataTypes.ENUM("pending", "paid", "failed"), defaultValue: "pending" },
  transactionId: DataTypes.STRING,
  invoiceFile: DataTypes.STRING,
  paymentRequestSentAt: DataTypes.DATE,
  paidAt: DataTypes.DATE,
  paidBy: DataTypes.INTEGER,
  approvedBy: DataTypes.INTEGER,
  creditAwarded: { type: DataTypes.BOOLEAN, defaultValue: false },
  creditAwardedAt: DataTypes.DATE
});

const Policy = sequelize.define("Policy", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  visibleToDealers: { type: DataTypes.BOOLEAN, defaultValue: true }
});

const Message = sequelize.define("Message", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  senderId: { type: DataTypes.INTEGER, allowNull: false },
  receiverId: { type: DataTypes.INTEGER, allowNull: true },
  dealerId: { type: DataTypes.INTEGER, allowNull: true },
  title: { type: DataTypes.STRING, allowNull: false },
  message: DataTypes.TEXT,
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  conversationId: DataTypes.STRING,
  messageType: { type: DataTypes.STRING, defaultValue: "manual" },
  orderNumber: DataTypes.STRING,
  productId: DataTypes.INTEGER,
  requestedQuantity: DataTypes.INTEGER,
  availableStock: DataTypes.INTEGER
}, { updatedAt: false });

const OrderScheduledMessage = sequelize.define("OrderScheduledMessage", {
  orderId: { type: DataTypes.INTEGER, allowNull: false },
  dealerId: { type: DataTypes.INTEGER, allowNull: false },
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  senderId: { type: DataTypes.INTEGER, allowNull: false },
  messageType: { type: DataTypes.ENUM("approval", "packing", "shipping", "out_for_delivery", "delivered"), allowNull: false },
  scheduledDate: { type: DataTypes.DATEONLY, allowNull: false },
  messageText: { type: DataTypes.TEXT, allowNull: false },
  isSent: { type: DataTypes.BOOLEAN, defaultValue: false },
  sentAt: DataTypes.DATE
}, {
  tableName: "order_scheduled_messages",
  indexes: [
    { fields: ["orderId"] },
    { fields: ["scheduledDate"] },
    { fields: ["isSent"] },
    { unique: true, fields: ["orderId", "messageType"] }
  ]
});

const Report = sequelize.define("Report", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  dealerId: { type: DataTypes.INTEGER, allowNull: true },
  title: { type: DataTypes.STRING, allowNull: false },
  type: DataTypes.STRING,
  description: DataTypes.TEXT
}, { updatedAt: false });

const DealerCreditWallet = sequelize.define("DealerCreditWallet", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  dealerId: { type: DataTypes.INTEGER, allowNull: false },
  balance: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  totalEarned: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  totalRedeemed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  tableName: "dealer_credit_wallets",
  indexes: [{ unique: true, fields: ["companyId", "dealerId"] }]
});

const DealerCreditTransaction = sequelize.define("DealerCreditTransaction", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  dealerId: { type: DataTypes.INTEGER, allowNull: false },
  orderId: { type: DataTypes.INTEGER, allowNull: true },
  orderItemId: { type: DataTypes.INTEGER, allowNull: true },
  redemptionId: { type: DataTypes.INTEGER, allowNull: true },
  type: { type: DataTypes.ENUM("EARN", "REDEEM", "ADJUST"), allowNull: false },
  coins: { type: DataTypes.INTEGER, allowNull: false },
  balanceBefore: { type: DataTypes.INTEGER, allowNull: false },
  balanceAfter: { type: DataTypes.INTEGER, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: "dealer_credit_transactions",
  indexes: [{ fields: ["companyId", "dealerId"] }, { fields: ["orderId", "orderItemId", "type"] }]
});

const CreditReward = sequelize.define("CreditReward", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  requiredCoins: { type: DataTypes.INTEGER, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  image: { type: DataTypes.STRING, allowNull: true },
  category: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.ENUM("active", "inactive"), defaultValue: "active" },
  terms: { type: DataTypes.TEXT, allowNull: true }
}, { tableName: "credit_rewards" });

const CreditRedemption = sequelize.define("CreditRedemption", {
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  dealerId: { type: DataTypes.INTEGER, allowNull: false },
  rewardId: { type: DataTypes.INTEGER, allowNull: false },
  coinsUsed: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM("PENDING", "APPROVED", "PROVIDED", "CANCELLED"), defaultValue: "PENDING" },
  requestedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  approvedAt: { type: DataTypes.DATE, allowNull: true },
  providedAt: { type: DataTypes.DATE, allowNull: true },
  expectedProvideDate: { type: DataTypes.DATEONLY, allowNull: true },
  adminNote: { type: DataTypes.TEXT, allowNull: true }
}, { tableName: "credit_redemptions" });

Company.hasMany(Dealer, { foreignKey: "companyId" });
Dealer.belongsTo(Company, { foreignKey: "companyId" });
Company.hasMany(User, { foreignKey: "companyId" });
User.belongsTo(Company, { foreignKey: "companyId" });
Company.hasMany(CompanyLicense, { foreignKey: "companyId" });
CompanyLicense.belongsTo(Company, { foreignKey: "companyId" });
LicensePlan.hasMany(LicenseInventory, { foreignKey: "licensePlanId" });
LicenseInventory.belongsTo(LicensePlan, { foreignKey: "licensePlanId" });
LicensePlan.hasMany(CompanyLicense, { foreignKey: "licensePlanId" });
CompanyLicense.belongsTo(LicensePlan, { foreignKey: "licensePlanId" });
LicensePlan.hasMany(LicensePurchaseRequest, { foreignKey: "licensePlanId" });
LicensePurchaseRequest.belongsTo(LicensePlan, { foreignKey: "licensePlanId" });
Company.hasMany(LicensePurchaseRequest, { foreignKey: "companyId" });
LicensePurchaseRequest.belongsTo(Company, { foreignKey: "companyId" });
LicensePurchaseRequest.belongsTo(User, { foreignKey: "requestedBy", as: "requester" });
LicensePurchaseRequest.belongsTo(User, { foreignKey: "salesApprovedBy", as: "salesApprover" });
LicensePurchaseRequest.belongsTo(User, { foreignKey: "financeVerifiedBy", as: "financeVerifier" });
SuperAdminTarget.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
SuperAdminTarget.belongsTo(User, { foreignKey: "assignedTo", as: "assignee" });
SuperAdminPinnedMessage.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
SuperAdminPinnedMessage.belongsTo(User, { foreignKey: "assignedTo", as: "assignee" });
SuperAdminChat.belongsTo(User, { foreignKey: "senderId", as: "sender" });
SuperAdminChat.belongsTo(User, { foreignKey: "receiverId", as: "receiver" });
AdminInternalMessage.belongsTo(User, { foreignKey: "senderId", as: "sender" });
AdminInternalMessage.belongsTo(User, { foreignKey: "receiverId", as: "receiver" });
DealerInternalMessage.belongsTo(User, { foreignKey: "senderId", as: "sender" });
DealerInternalMessage.belongsTo(User, { foreignKey: "receiverId", as: "receiver" });
AdminPinnedMessage.belongsTo(User, { foreignKey: "createdBy", as: "creator" });
AdminPinnedMessage.belongsTo(User, { foreignKey: "assignedTo", as: "assignee" });
Company.hasMany(Product, { foreignKey: "companyId" });
Product.belongsTo(Company, { foreignKey: "companyId" });
Product.hasOne(CompanyInventory, { foreignKey: "productId" });
CompanyInventory.belongsTo(Product, { foreignKey: "productId" });
Product.hasMany(ProductVariant, { foreignKey: "productId", as: "variants" });
ProductVariant.belongsTo(Product, { foreignKey: "productId" });
DealerInventory.belongsTo(Product, { foreignKey: "productId" });
DealerInventory.belongsTo(ProductVariant, { foreignKey: "productVariantId" });
DealerInventory.belongsTo(Dealer, { foreignKey: "dealerId" });
InternalNotification.belongsTo(Dealer, { foreignKey: "dealerId" });
InternalNotification.belongsTo(User, { foreignKey: "userId" });
DealerSale.belongsTo(Product, { foreignKey: "productId" });
DealerSale.belongsTo(ProductVariant, { foreignKey: "productVariantId" });
DealerSale.belongsTo(Dealer, { foreignKey: "dealerId" });
DealerStockTransferRequest.belongsTo(Dealer, { foreignKey: "requesterDealerId", as: "requesterDealer" });
DealerStockTransferRequest.belongsTo(Dealer, { foreignKey: "senderDealerId", as: "senderDealer" });
DealerStockTransferRequest.belongsTo(Product, { foreignKey: "productId" });
DealerStockTransferRequest.belongsTo(ProductVariant, { foreignKey: "productVariantId" });
DealerStockTransferLog.belongsTo(DealerStockTransferRequest, { foreignKey: "transferRequestId", as: "transferRequest" });
DealerStockTransferLog.belongsTo(User, { foreignKey: "actionBy", as: "actor" });
Order.hasMany(OrderItem, { foreignKey: "orderId", as: "items" });
OrderItem.belongsTo(Product, { foreignKey: "productId" });
OrderItem.belongsTo(ProductVariant, { foreignKey: "productVariantId" });
Order.belongsTo(Dealer, { foreignKey: "dealerId" });
Order.hasMany(DeliveryTracking, { foreignKey: "orderId", as: "tracking" });
DeliveryTracking.belongsTo(Order, { foreignKey: "orderId" });
Order.hasMany(OrderScheduledMessage, { foreignKey: "orderId", as: "scheduledMessages" });
OrderScheduledMessage.belongsTo(Order, { foreignKey: "orderId" });
Payment.belongsTo(Order, { foreignKey: "orderId" });
Payment.belongsTo(Dealer, { foreignKey: "dealerId" });
Policy.belongsTo(Company, { foreignKey: "companyId" });
Message.belongsTo(User, { foreignKey: "senderId", as: "sender" });
Report.belongsTo(Dealer, { foreignKey: "dealerId" });
DealerCreditWallet.belongsTo(Dealer, { foreignKey: "dealerId" });
DealerCreditTransaction.belongsTo(Dealer, { foreignKey: "dealerId" });
DealerCreditTransaction.belongsTo(Order, { foreignKey: "orderId" });
CreditReward.hasMany(CreditRedemption, { foreignKey: "rewardId" });
CreditRedemption.belongsTo(CreditReward, { foreignKey: "rewardId", as: "reward" });
CreditRedemption.belongsTo(Dealer, { foreignKey: "dealerId" });

module.exports = {
  sequelize,
  User,
  Company,
  LicensePlan,
  LicenseInventory,
  CompanyLicense,
  LicensePurchaseRequest,
  SuperAdminTarget,
  SuperAdminPinnedMessage,
  SuperAdminChat,
  AdminInternalMessage,
  DealerInternalMessage,
  AdminPinnedMessage,
  Dealer,
  Product,
  CompanyInventory,
  ProductVariant,
  DealerInventory,
  InternalNotification,
  DealerSale,
  DealerStockTransferRequest,
  DealerStockTransferLog,
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
  CreditRedemption
};
