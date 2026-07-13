const jwt = require("jsonwebtoken");
const { User, Company, Dealer } = require("../models");
const { hasAnyRole, normalizeRole } = require("./roles");

const dealerManagerRolesEnabled = () => process.env.ENABLE_DEALER_MANAGER_ROLES !== "false";
const subscriptionBlockedMessage = "Your company subscription has expired or is blocked. Please contact DMS support.";
const accountSuspendedMessage = "Your account is currently suspended. Please contact your administrator.";

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentication required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "dms_super_secret_key");
    const user = await User.findByPk(decoded.id, { attributes: { exclude: ["password", "twoFactorOtp", "twoFactorOtpExpiry", "passwordResetOtp", "passwordResetOtpExpiry"] } });
    if (!user) return res.status(401).json({ message: "Invalid user" });
    if (user.status !== "active") return res.status(403).json({ message: accountSuspendedMessage });

    if (user.companyId) {
      const company = await Company.findByPk(user.companyId);
      const today = new Date().toISOString().slice(0, 10);
      const expired = company?.endDate && String(company.endDate) < today;
      if (!company || ["blocked", "expired", "pending", "rejected"].includes(company.status) || expired) {
        return res.status(403).json({ message: subscriptionBlockedMessage });
      }
    }
    if (user.dealerId) {
      const dealer = await Dealer.findByPk(user.dealerId);
      if (!dealer || dealer.status !== "active") return res.status(403).json({ message: accountSuspendedMessage });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

const permit = (...roles) => (req, res, next) => {
  const requestedRoles = dealerManagerRolesEnabled() ? roles : roles.filter((role) => !["DEALER_CEO", "DEALER_STOCK_INVENTORY_MANAGER", "DEALER_STOCK_DELIVERY_MANAGER", "DEALER_SALES_FINANCE_MANAGER"].includes(role));
  if (!hasAnyRole(req.user, requestedRoles)) return res.status(403).json({ message: "Access denied" });
  next();
};

const requireCompanyScope = (req, res, next) => {
  if (!req.user?.companyId) return res.status(403).json({ message: "Company access is not assigned to this account" });
  next();
};

module.exports = { protect, permit, requireCompanyScope, dealerManagerRolesEnabled, normalizeRole, subscriptionBlockedMessage, accountSuspendedMessage };
