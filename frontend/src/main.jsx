import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import SuperAdmin from "./pages/SuperAdmin.jsx";
import SuperAdminRoleDashboard from "./pages/SuperAdminRoleDashboard.jsx";
import Admin from "./pages/Admin.jsx";
import Dealer from "./pages/Dealer.jsx";
import Profile from "./pages/Profile.jsx";
import { AuthProvider, useAuth } from "./state/AuthContext.jsx";
import { dashboardRoute } from "./utils/roleRouting.js";
import "./styles.css";

function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role && !(Array.isArray(role) ? role.includes(user.role) : user.role === role)) return <Navigate to="/" replace />;
  return children;
}

const dealerRoles = ["DEALER", "DEALER_CEO", "DEALER_STOCK_INVENTORY_MANAGER", "DEALER_STOCK_DELIVERY_MANAGER", "DEALER_SALES_FINANCE_MANAGER"];

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={dashboardRoute(user.role)} replace />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<App />}>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/super-admin" element={<ProtectedRoute role={["SUPER_ADMIN", "SUPER_ADMIN_CEO"]}><SuperAdmin /></ProtectedRoute>} />
            <Route path="/super-admin-ceo" element={<ProtectedRoute role="SUPER_ADMIN_CEO"><SuperAdminRoleDashboard role="SUPER_ADMIN_CEO" /></ProtectedRoute>} />
            <Route path="/super-admin-it" element={<ProtectedRoute role="SUPER_ADMIN_IT_MANAGER"><SuperAdminRoleDashboard role="SUPER_ADMIN_IT_MANAGER" /></ProtectedRoute>} />
            <Route path="/super-admin-sales" element={<ProtectedRoute role="SUPER_ADMIN_SALES_MANAGER"><SuperAdminRoleDashboard role="SUPER_ADMIN_SALES_MANAGER" /></ProtectedRoute>} />
            <Route path="/super-admin-finance" element={<ProtectedRoute role="SUPER_ADMIN_FINANCE_MANAGER"><SuperAdminRoleDashboard role="SUPER_ADMIN_FINANCE_MANAGER" /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute role={["ADMIN", "ADMIN_CEO", "DEALER_MANAGER", "PRODUCT_DELIVERY_MANAGER", "FINANCE_MANAGER"]}><Admin /></ProtectedRoute>} />
            <Route path="/dealer" element={<ProtectedRoute role={dealerRoles}><Dealer /></ProtectedRoute>} />
            <Route path="/dealer/dashboard" element={<ProtectedRoute role={dealerRoles}><Dealer /></ProtectedRoute>} />
            <Route path="/dealer-ceo/dashboard" element={<ProtectedRoute role={["DEALER", "DEALER_CEO"]}><Dealer /></ProtectedRoute>} />
            <Route path="/dealer-stock-delivery/dashboard" element={<ProtectedRoute role={["DEALER_STOCK_INVENTORY_MANAGER", "DEALER_STOCK_DELIVERY_MANAGER"]}><Dealer /></ProtectedRoute>} />
            <Route path="/dealer-sales-finance/dashboard" element={<ProtectedRoute role="DEALER_SALES_FINANCE_MANAGER"><Dealer /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
