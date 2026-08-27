const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { superAdminManagerRolesEnabled } = require("./utils/featureFlags");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "https://dms-one.netlify.app/",
  "https://dms-one.netlify.app"
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 600 }));

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "DMS API" }));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/super-admin", require("./routes/superAdminRoutes"));
if (superAdminManagerRolesEnabled()) {
  app.use("/api/super-admin-ceo", require("./routes/superAdminCeoRoutes"));
  app.use("/api/super-admin-it", require("./routes/superAdminItRoutes"));
  app.use("/api/super-admin-sales", require("./routes/superAdminSalesRoutes"));
  app.use("/api/super-admin-finance", require("./routes/superAdminFinanceRoutes"));
  app.use("/api/super-admin-chat", require("./routes/superAdminChatRoutes"));
} else {
  app.use(["/api/super-admin-ceo", "/api/super-admin-it", "/api/super-admin-sales", "/api/super-admin-finance", "/api/super-admin-chat"], (req, res) => {
    res.status(410).json({ message: "This Super Admin manager feature is no longer active." });
  });
}
app.use("/api/admin/stock-transfer-requests", require("./routes/stockTransferAdminRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/admin-ceo/stock-transfer-requests", require("./routes/stockTransferAdminCeoRoutes"));
app.use("/api/admin-ceo", require("./routes/adminCeoRoutes"));
app.use("/api/admin-internal-chat", require("./routes/adminInternalChatRoutes"));
app.use("/api/dealer", require("./routes/dealerRoutes"));
app.use("/api/dealer-ceo", require("./routes/dealerCeoRoutes"));
app.use("/api/dealer-stock-exchange", require("./routes/dealerStockExchangeRoutes"));
app.use("/api/dealer-internal-chat", require("./routes/dealerInternalChatRoutes"));
app.use("/api/profile", require("./routes/profileRoutes"));
app.use("/api/internal-updates", require("./routes/internalUpdatesRoutes"));
app.use("/api", require("./routes/compatRoutes"));

app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

module.exports = app;
