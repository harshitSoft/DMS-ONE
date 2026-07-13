require("dotenv").config();
const bcrypt = require("bcryptjs");
const ensureDatabase = require("../utils/ensureDatabase");
const {
  sequelize,
  User,
  Company,
  Dealer,
  Product,
  CompanyInventory,
  DealerInventory,
  Order,
  OrderItem,
  DeliveryTracking,
  Payment,
  Policy,
  Message,
  Report
} = require("../models");

const seed = async () => {
  await ensureDatabase();
  await sequelize.sync({ force: true });
  const superAdminPasswordHash = await bcrypt.hash("harshit123", 12);

  const superAdmin = await User.create({
    name: "Harshit Nigam",
    email: "harshit.nigam@itsoftlab.com",
    password: superAdminPasswordHash,
    role: "SUPER_ADMIN_CEO",
    status: "active"
  }, { hooks: false });

  const companies = await Company.bulkCreate([
    { companyName: "TVS", category: "Automobile", description: "Two-wheeler dealer network", adminName: "TVS Admin", adminEmail: "admin@tvs.com", startDate: "2026-01-01", endDate: "2026-12-31", status: "active" },
    { companyName: "Bajaj", category: "Automobile", description: "Vehicle and spare parts network", adminName: "Bajaj Admin", adminEmail: "admin@bajaj.com", startDate: "2026-01-01", endDate: "2026-12-31", status: "active" },
    { companyName: "Lakme", category: "Cosmetic", description: "Beauty product dealer network", adminName: "Lakme Admin", adminEmail: "admin@lakme.com", startDate: "2026-01-01", endDate: "2026-12-31", status: "active" }
  ]);

  for (const company of companies) {
    await User.create({ name: company.adminName, email: company.adminEmail, password: "admin123", role: "ADMIN_CEO", companyId: company.id });
    const dealer = await Dealer.create({
      companyId: company.id,
      dealerName: `${company.companyName} Central Dealer`,
      ownerName: "Dealer Owner",
      email: `dealer@${company.companyName.toLowerCase()}.com`,
      phone: "9876543210",
      area: "Central",
      city: "Mumbai",
      state: "Maharashtra",
      address: "Main market road",
      status: "active"
    });
    await User.create({ name: dealer.ownerName, email: dealer.email, password: "dealer123", role: "DEALER", companyId: company.id, dealerId: dealer.id });

    const productA = await Product.create({
      companyId: company.id,
      productName: company.category === "Cosmetic" ? "Matte Lip Color" : "Premium Engine Oil",
      sku: `${company.companyName.toUpperCase()}-001`,
      category: company.category === "Cosmetic" ? "Makeup" : "Spares",
      description: "High demand dealer product",
      price: company.category === "Cosmetic" ? 799 : 1250,
      status: "active"
    });
    const productB = await Product.create({
      companyId: company.id,
      productName: company.category === "Cosmetic" ? "Skin Serum" : "Brake Pad Set",
      sku: `${company.companyName.toUpperCase()}-002`,
      category: company.category === "Cosmetic" ? "Skincare" : "Spares",
      description: "Fast moving product",
      price: company.category === "Cosmetic" ? 1299 : 950,
      status: "active"
    });
    await CompanyInventory.bulkCreate([
      { companyId: company.id, productId: productA.id, quantity: 150, lowStockLimit: 25, lastUpdatedBy: superAdmin.id },
      { companyId: company.id, productId: productB.id, quantity: 80, lowStockLimit: 15, lastUpdatedBy: superAdmin.id }
    ]);
    await DealerInventory.create({ companyId: company.id, dealerId: dealer.id, productId: productA.id, quantity: 10, lowStockLimit: 3 });
    await Policy.create({ companyId: company.id, title: "Dealer order policy", description: "Orders are reviewed within one business day.", visibleToDealers: true });
    await Message.create({ companyId: company.id, senderId: superAdmin.id, title: "Welcome", message: "Welcome to DMS.", dealerId: dealer.id });
    await Payment.create({ companyId: company.id, dealerId: dealer.id, amount: 12500, paymentMethod: "UPI", paymentStatus: "pending", transactionId: `TXN-${company.id}` });
    await Report.create({ companyId: company.id, dealerId: dealer.id, title: "Opening stock update", type: "inventory", description: "Initial dealer stock received." });
  }

  console.log("Seed complete");
  console.log("Super Admin: harshit.nigam@itsoftlab.com / harshit123");
  console.log("Company Admin examples: admin@tvs.com / admin123");
  console.log("Dealer examples: dealer@tvs.com / dealer123");
  await sequelize.close();
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
