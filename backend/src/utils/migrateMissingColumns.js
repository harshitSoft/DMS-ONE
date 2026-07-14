const { DataTypes } = require("sequelize");
const {
  sequelize,
  Product,
  ProductVariant,
  CompanyInventory,
  Company,
  Dealer,
  User,
  LicensePlan,
  CompanyLicense,
  LicenseInventory,
  DealerInternalMessage
} = require("../models");

const userRoles = ["SUPER_ADMIN", "SUPER_ADMIN_CEO", "SUPER_ADMIN_IT_MANAGER", "SUPER_ADMIN_SALES_MANAGER", "SUPER_ADMIN_FINANCE_MANAGER", "ADMIN", "ADMIN_CEO", "DEALER_MANAGER", "PRODUCT_DELIVERY_MANAGER", "FINANCE_MANAGER", "DEALER", "DEALER_CEO", "DEALER_STOCK_INVENTORY_MANAGER", "DEALER_STOCK_DELIVERY_MANAGER", "DEALER_SALES_FINANCE_MANAGER"];

const columns = {
  Users: {
    phone: { type: DataTypes.STRING, allowNull: true },
    isTwoFactorEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    twoFactorOtp: { type: DataTypes.STRING(10), allowNull: true },
    twoFactorOtpExpiry: { type: DataTypes.DATE, allowNull: true },
    twoFactorVerifiedAt: { type: DataTypes.DATE, allowNull: true },
    passwordResetOtp: { type: DataTypes.STRING(10), allowNull: true },
    passwordResetOtpExpiry: { type: DataTypes.DATE, allowNull: true },
    forgotPasswordOtp: { type: DataTypes.STRING(10), allowNull: true },
    forgotPasswordOtpExpiry: { type: DataTypes.DATE, allowNull: true },
    passwordChangeRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    passwordChangedAt: { type: DataTypes.DATE, allowNull: true }
  },
  Companies: {
    phone: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    city: { type: DataTypes.STRING, allowNull: true },
    state: { type: DataTypes.STRING, allowNull: true },
    pincode: { type: DataTypes.STRING, allowNull: true },
    adminPhone: { type: DataTypes.STRING, allowNull: true },
    paymentStatus: { type: DataTypes.ENUM("PENDING", "PAID", "REJECTED"), allowNull: false, defaultValue: "PAID" },
    subscriptionAmount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    approvedByFinance: { type: DataTypes.INTEGER, allowNull: true },
    financeApprovedAt: { type: DataTypes.DATE, allowNull: true },
    createdBySalesManager: { type: DataTypes.INTEGER, allowNull: true },
    selectedLicensePlanId: { type: DataTypes.INTEGER, allowNull: true },
    selectedLicenseQuantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    licenseDeliveredAt: { type: DataTypes.DATE, allowNull: true },
    salesNotes: { type: DataTypes.TEXT, allowNull: true }
  },
  Dealers: {
    pincode: { type: DataTypes.STRING, allowNull: true }
  },
  Products: {
    image: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT },
    manufacturingDate: { type: DataTypes.DATEONLY, allowNull: true },
    expiryDate: { type: DataTypes.DATEONLY, allowNull: true },
    creditCoins: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    variantEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  dealer_inventory: {
    lowStockLimit: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
    productVariantId: { type: DataTypes.INTEGER, allowNull: true },
    variantName: { type: DataTypes.STRING, allowNull: true },
    colorName: { type: DataTypes.STRING, allowNull: true }
  },
  dealer_sales: {
    productVariantId: { type: DataTypes.INTEGER, allowNull: true },
    variantName: { type: DataTypes.STRING, allowNull: true },
    colorName: { type: DataTypes.STRING, allowNull: true }
  },
  Orders: {
    packingDate: { type: DataTypes.DATEONLY },
    shippingDate: { type: DataTypes.DATEONLY },
    outForDeliveryDate: { type: DataTypes.DATEONLY },
    deliveredDate: { type: DataTypes.DATEONLY },
    approvedAt: { type: DataTypes.DATE },
    approvedBy: { type: DataTypes.INTEGER },
    currentDeliveryStep: { type: DataTypes.STRING },
    deliveryProgress: { type: DataTypes.INTEGER, defaultValue: 0 },
    creditAwarded: { type: DataTypes.BOOLEAN, defaultValue: false },
    creditAwardedAt: { type: DataTypes.DATE },
    inventoryAdded: { type: DataTypes.BOOLEAN, defaultValue: false },
    deliveredAt: { type: DataTypes.DATE }
  },
  order_items: {
    productVariantId: { type: DataTypes.INTEGER, allowNull: true },
    variantName: { type: DataTypes.STRING, allowNull: true },
    colorName: { type: DataTypes.STRING, allowNull: true },
    creditCoinsEarned: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
  },
  product_variants: {
    image: { type: DataTypes.STRING, allowNull: true }
  },
  Payments: {
    invoiceNumber: { type: DataTypes.STRING, allowNull: true },
    orderNumber: { type: DataTypes.STRING, allowNull: true },
    productSummary: { type: DataTypes.TEXT, allowNull: true },
    invoiceStatus: { type: DataTypes.STRING, defaultValue: "generated" },
    orderApprovedAt: { type: DataTypes.DATE },
    invoiceFile: { type: DataTypes.STRING },
    paymentRequestSentAt: { type: DataTypes.DATE },
    paidAt: { type: DataTypes.DATE },
    paidBy: { type: DataTypes.INTEGER },
    approvedBy: { type: DataTypes.INTEGER },
    creditAwarded: { type: DataTypes.BOOLEAN, defaultValue: false },
    creditAwardedAt: { type: DataTypes.DATE }
  },
  Messages: {
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    conversationId: { type: DataTypes.STRING },
    messageType: { type: DataTypes.STRING, defaultValue: "manual" },
    orderNumber: { type: DataTypes.STRING },
    productId: { type: DataTypes.INTEGER },
    requestedQuantity: { type: DataTypes.INTEGER },
    availableStock: { type: DataTypes.INTEGER }
  },
  dealer_internal_messages: {
    companyId: { type: DataTypes.INTEGER, allowNull: false },
    dealerId: { type: DataTypes.INTEGER, allowNull: false },
    senderId: { type: DataTypes.INTEGER, allowNull: false },
    receiverId: { type: DataTypes.INTEGER, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }
};

async function migrateMissingColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const userTable = await queryInterface.describeTable("Users").catch(() => null);
  if (userTable) {
    await queryInterface.changeColumn("Users", "role", {
      type: DataTypes.ENUM(...userRoles),
      allowNull: false
    }).catch(() => null);
  }
  const companyTable = await queryInterface.describeTable("Companies").catch(() => null);
  if (companyTable?.status) {
    await queryInterface.changeColumn("Companies", "status", {
      type: DataTypes.ENUM("active", "inactive", "deleted", "expired", "blocked", "pending", "rejected"),
      allowNull: true,
      defaultValue: "active"
    }).catch(() => null);
    await queryInterface.changeColumn("Companies", "endDate", {
      type: DataTypes.DATEONLY,
      allowNull: true
    }).catch(() => null);
  }
  for (const [table, tableColumns] of Object.entries(columns)) {
    const existing = await queryInterface.describeTable(table).catch(() => null);
    if (!existing && table === "dealer_internal_messages") {
      await DealerInternalMessage.sync();
      continue;
    }
    if (!existing) continue;
    for (const [column, definition] of Object.entries(tableColumns)) {
      if (!existing[column]) await queryInterface.addColumn(table, column, definition);
    }
  }
  const variantTable = await queryInterface.describeTable("product_variants").catch(() => null);
  if (variantTable) {
    const products = await Product.findAll({ include: [{ model: ProductVariant, as: "variants" }, { model: CompanyInventory }] });
    for (const product of products) {
      if (product.variants?.length) continue;
      await ProductVariant.create({
        companyId: product.companyId,
        productId: product.id,
        variantName: "Standard",
        colorName: "Default",
        stockQuantity: Number(product.CompanyInventory?.quantity || 0),
        status: "active"
      });
    }
  }
  if (process.env.ENABLE_LICENSE_SYSTEM === "true") await seedLicenseDefaults();
  await migrateMainSuperAdmin();
  await migrateCompanyAdmins();
  if (process.env.ENABLE_LICENSE_SYSTEM === "true") await ensureDefaultCompanyLicenses();
}

async function seedLicenseDefaults() {
  const plans = [
    { name: "Gold", dealerLimit: 10, price: 10000, description: "Gold License - adds capacity for 10 dealers", status: "active" },
    { name: "Platinum", dealerLimit: 20, price: 18000, description: "Platinum License - adds capacity for 20 dealers", status: "active" }
  ];
  for (const plan of plans) {
    const [row] = await LicensePlan.findOrCreate({ where: { name: plan.name }, defaults: plan });
    await LicenseInventory.findOrCreate({
      where: { licensePlanId: row.id },
      defaults: { licensePlanId: row.id, totalQuantity: 0, availableQuantity: 0, soldQuantity: 0 }
    });
  }
}

async function migrateMainSuperAdmin() {
  await User.update(
    { role: "SUPER_ADMIN", status: "active" },
    { where: { email: "harshit.nigam@itsoftlab.com" } }
  );
  await User.update(
    { role: "SUPER_ADMIN" },
    { where: { role: "SUPER_ADMIN_CEO" } }
  );
  await User.update(
    { status: "inactive" },
    { where: { role: ["SUPER_ADMIN_SALES_MANAGER", "SUPER_ADMIN_IT_MANAGER", "SUPER_ADMIN_FINANCE_MANAGER"] } }
  );
}

async function migrateCompanyAdmins() {
  if (process.env.ENABLE_ADMIN_MANAGER_ROLES === "false") return;
  await User.update({ role: "ADMIN_CEO" }, { where: { role: "ADMIN" } });
}

async function ensureDefaultCompanyLicenses() {
  const gold = await LicensePlan.findOne({ where: { name: "Gold" } });
  if (!gold) return;
  const companies = await Company.findAll();
  for (const company of companies) {
    const activeCount = await CompanyLicense.count({ where: { companyId: company.id, status: "active" } });
    if (activeCount) continue;
    const dealerCount = await Dealer.count({ where: { companyId: company.id } });
    const quantity = Math.max(1, Math.ceil(dealerCount / Number(gold.dealerLimit || 10)));
    await CompanyLicense.create({
      companyId: company.id,
      licensePlanId: gold.id,
      quantity,
      dealerLimitAdded: quantity * Number(gold.dealerLimit || 10),
      status: "active",
      activatedAt: new Date()
    });
  }
}

module.exports = migrateMissingColumns;
