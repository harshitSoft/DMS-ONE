  import { useEffect, useState } from "react";
import { formatTitleCase } from "../utils/textFormatter";
  import { AlertTriangle, CheckCircle2, Clock, Eye, EyeOff, Gift, IndianRupee, PackageCheck, Pencil, Star, Trash2, Truck, Users, X, Paperclip, Clock3, Banknote, CreditCard, AlertCircle } from "lucide-react";
  import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
  import Layout from "../components/Layout";
  import { api, fileUrl } from "../api/client";
  import { Button, Card, DeliveryTimeline, Empty, FileUploadPreview, FormGrid, formatDate, formatMoney, Loading, PageHeader, PaymentBadge, Plus, Section, Select, SearchableSelect, StatusBadge, TextField } from "../components/UI";
  import { useAuth } from "../state/AuthContext";
  import { consumeProfileTargetTab, roleTabs } from "../utils/profileNavigation";
  import { useNavigate, useParams } from "react-router-dom";
  import { cachedGet } from "../utils/sessionApiCache";
  import AdminCeoAnalyticsDashboard from "../components/AdminCeoAnalyticsDashboard";
  import AdminCeoDealersOverview from "../components/AdminCeoDealersOverview";
  import AdminCeoProductsOverview from "../components/AdminCeoProductsOverview";
  import { AdminCeoDeliveryOverview, AdminCeoFinanceOverview, AdminCeoOrdersOverview, AdminCeoCreditOverview, MetricGrid } from "../components/AdminCeoOperationsOverviews";

  const INDIA_STATES_CITIES = {
    "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Rajahmundry", "Tirupati"],
    "Arunachal Pradesh": ["Itanagar", "Tawang", "Pasighat"],
    "Assam": ["Guwahati", "Silchar", "Dibrugarh", "Jorhat"],
    "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia"],
    "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Durg"],
    "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar"],
    "Haryana": ["Gurugram", "Faridabad", "Panipat", "Ambala", "Rohtak", "Hisar", "Karnal"],
    "Himachal Pradesh": ["Shimla", "Manali", "Dharamshala", "Solan", "Mandi"],
    "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar"],
    "Karnataka": ["Bengaluru", "Mysuru", "Hubli", "Mangaluru", "Belagavi", "Davanagere"],
    "Kerala": ["Thiruvananthapuram", "Kochi", "Kozhikode", "Kollam", "Thrissur"],
    "Madhya Pradesh": ["Bhopal", "Indore", "Gwalior", "Jabalpur", "Ujjain", "Sagar"],
    "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Aurangabad", "Solapur"],
    "Manipur": ["Imphal", "Thoubal"],
    "Meghalaya": ["Shillong", "Tura"],
    "Mizoram": ["Aizawl", "Lunglei"],
    "Nagaland": ["Kohima", "Dimapur"],
    "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur"],
    "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer"],
    "Sikkim": ["Gangtok", "Namchi"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli"],
    "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Ramagundam"],
    "Tripura": ["Agartala", "Udaipur"],
    "Uttar Pradesh": ["Lucknow", "Kanpur", "Noida", "Agra", "Varanasi", "Meerut", "Prayagraj", "Ghaziabad"],
    "Uttarakhand": ["Dehradun", "Haridwar", "Roorkee", "Haldwani"],
    "West Bengal": ["Kolkata", "Howrah", "Darjeeling", "Asansol", "Siliguri", "Durgapur"],
    "Andaman and Nicobar Islands": ["Port Blair"],
    "Chandigarh": ["Chandigarh"],
    "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Silvassa"],
    "Delhi": ["New Delhi", "North Delhi", "South Delhi"],
    "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag"],
    "Ladakh": ["Leh", "Kargil"],
    "Lakshadweep": ["Kavaratti"],
    "Puducherry": ["Pondicherry", "Auroville", "Karaikal"]
  };
  const fullSku = (product, variant) => [product?.sku, variant?.skuSuffix].filter(Boolean).join("-") || product?.sku || "-";
  const productNameWithSku = (product, variant) => `${product?.productName || "Product"} (${fullSku(product, variant)})`;
  const rowNameWithSku = (row, nameKey = "productName", skuKey = "sku") => `${row?.[nameKey] || "Product"}${row?.[skuKey] ? ` (${row[skuKey]})` : ""}`;
  const orderItemLabel = (item) => {
    const variant = item.ProductVariant || item;
    const variantText = item.variantName ? ` - ${item.variantName}/${item.colorName || "-"}` : "";
    return `${productNameWithSku(item.Product, variant)}${variantText} x ${item.quantity}`;
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
    { id: "dealers", label: "Dealers", icon: "dealers" },
    { id: "dealerPerformance", label: "Dealer Performance", icon: "performance" },
    { id: "products", label: "Products", icon: "products" },
    { id: "inventory", label: "Inventory", icon: "inventory" },
    { id: "orders", label: "Orders", icon: "orders" },
    { id: "delivery", label: "Delivery", icon: "delivery" },
    { id: "finance", label: "Finance", icon: "finance" },
    { id: "creditManagement", label: "Credit Management", icon: "credits" },
    { id: "dealerSales", label: "Dealer Sales", icon: "reports" },
    { id: "messages", label: "Messages", icon: "messages" },
    { id: "internalUpdates", label: "Internal Updates", icon: "internalUpdates" },
    { id: "policies", label: "Policies", icon: "policies" },
    { id: "reports", label: "Reports", icon: "reports" }
  ];

  export default function Admin() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { section } = useParams();
    const currentTabs = roleTabs[user?.role] || tabs;
    const profileTab = consumeProfileTargetTab("", currentTabs);
    const activeTab = currentTabs.some((tab) => tab.id === section) ? section : (profileTab || "dashboard");
    const setActiveTab = (tab) => navigate(`/admin/${tab}`);
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [dealerForm, setDealerForm] = useState({ dealerName: "", ownerName: "", email: "", password: "", confirmPassword: "", phone: "", state: "", city: "", pincode: "", address: "" });
    const [showDealerPassword, setShowDealerPassword] = useState(false);
    const [showDealerConfirmPassword, setShowDealerConfirmPassword] = useState(false);
    const [productForm, setProductForm] = useState({ productName: "", category: "", description: "", manufacturingDate: "", expiryDate: "", price: 0, quantity: 0, lowStockLimit: 10, creditCoins: 0, status: "active" });
    const [variantRows, setVariantRows] = useState([{ variantName: "Standard", colorName: "Default", stockQuantity: 0, priceOverride: "", skuSuffix: "", status: "active" }]);
    const [editingProduct, setEditingProduct] = useState(null);
    const [policyForm, setPolicyForm] = useState({ title: "", description: "", visibleToDealers: true });
    const [messageForm, setMessageForm] = useState({ title: "", message: "", dealerId: "" });
    const [paymentForm, setPaymentForm] = useState({ dealerId: "", orderId: "", amount: 0, paymentMethod: "UPI", paymentStatus: "pending", transactionId: "" });
    const [productImage, setProductImage] = useState(null);
    const [productPreview, setProductPreview] = useState("");
    const [schedules, setSchedules] = useState({});
    const [invoiceFiles, setInvoiceFiles] = useState({});
    const [internalFilter, setInternalFilter] = useState("all");
    const [financeFilter, setFinanceFilter] = useState("all");
    const [dealerError, setDealerError] = useState("");
    const [performanceFilter, setPerformanceFilter] = useState({ area: "", dealerId: "", startDate: "", endDate: "", productId: "", paymentStatus: "" });
    const [rewardForm, setRewardForm] = useState({ title: "", description: "", requiredCoins: 0, quantity: 0, category: "", terms: "", status: "active" });
    const [rewardImage, setRewardImage] = useState(null);
    const [rewardPreview, setRewardPreview] = useState("");
    const [orderFilter, setOrderFilter] = useState("all");
    const [orderPage, setOrderPage] = useState(1);
    const [deliveryFilter, setDeliveryFilter] = useState("all");
    const [deliveryPage, setDeliveryPage] = useState(1);
    const [chatTarget, setChatTarget] = useState(null);

    const load = async (force = false) => {
      setLoading(true);
      setLoadError("");
      const endpointByTab = {
        dashboard: ["dashboard", "dashboard/analytics"], dealers: ["dealers"], dealerPerformance: ["dealer-performance", "products"],
        products: ["products", "stock/dealers"], inventory: ["products", "stock/dealers"], orders: ["orders"], delivery: ["orders"],
        finance: ["finance/approved-orders", "finance/payments", "dealers"], creditManagement: ["credit/summary", "credit/rewards", "credit/redemptions", "credit/dealer-wallets"],
        dealerSales: ["dealer-sales", "dealers", "products"], messages: ["messages/conversations"], policies: ["policies"], reports: ["reports"]
      };
      const endpoints = user?.role === "ADMIN_CEO" && activeTab === "dashboard" ? [] : (endpointByTab[activeTab] || []);
      const result = await Promise.allSettled([
        ...endpoints.map((e) => cachedGet(api, `/admin/${e}`, {}, { force })),
        cachedGet(api, "/internal-updates", {}, { force })
      ]);
      const payload = {};
      endpoints.forEach((e, i) => {
        payload[e.replace("/", "_")] = result[i].status === "fulfilled" ? result[i].value.data : [];
      });
      payload.internalUpdates = result.at(-1).status === "fulfilled" ? result.at(-1).value.data : { rows: [], unreadCount: 0 };
      setData((current) => ({ ...current, ...payload }));
      const failedCount = result.filter((entry) => entry.status === "rejected").length;
      if (failedCount) {
        const forbiddenCount = result.filter((entry) => entry.status === "rejected" && entry.reason?.response?.status === 403).length;
        setLoadError(forbiddenCount
          ? "You do not have access to one or more dashboard sections. Authorized information is still shown below."
          : `${failedCount} dashboard ${failedCount === 1 ? "section" : "sections"} could not be loaded. Available information is still shown below.`);
      }
      setLoading(false);
    };

    useEffect(() => {
      if (!currentTabs.some((tab) => tab.id === section)) {
        navigate(`/admin/${activeTab}`, { replace: true });
        return;
      }
      load();
    }, [activeTab, user?.role]);

    const create = async (url, form, reset) => {
      if (form.pincode && !/^\d{6}$/.test(String(form.pincode))) {
        const message = "Pincode must be 6 digits";
        setDealerError(message);
        alert(message);
        return;
      }
      try {
        await api.post(url, form);
        setDealerError("");
        reset();
        alert("Saved successfully");
        load(true);
      } catch (error) {
        const message = error.response?.data?.message || "Unable to save. Please check the form.";
        setDealerError(message);
        if (error.response?.data?.code === "LICENSE_LIMIT_REACHED") setActiveTab("licenseUpgrade");
        alert(message);
      }
    };

    const updateOrder = async (id, status) => {
      const rejectionReason = status === "rejected" ? prompt("Reason for rejection") : "";
      await api.patch(`/admin/orders/${id}/status`, { status, rejectionReason, message: status.replaceAll("_", " ") });
      load(true);
    };

    const approveOrder = async (orderId) => {
      const schedule = schedules[orderId] || {};
      if (!schedule.packingDate || !schedule.shippingDate || !schedule.outForDeliveryDate || !schedule.deliveredDate) {
        alert("Select all delivery timeline dates before approval.");
        return;
      }
      await api.post(`/admin/orders/${orderId}/approve-with-schedule`, schedule);
      load(true);
    };

    const createProduct = async (e) => {
      e.preventDefault();
      const formData = new FormData();
      Object.entries(productForm).forEach(([key, value]) => formData.append(key, value));
      formData.append("variants", JSON.stringify(variantRows));
      if (productImage) formData.append("image", productImage);
      await api.post("/admin/products", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setProductForm({ ...productForm, productName: "", description: "", manufacturingDate: "", expiryDate: "", quantity: 0 });
      setVariantRows([{ variantName: "Standard", colorName: "Default", stockQuantity: 0, priceOverride: "", skuSuffix: "", status: "active" }]);
      setProductImage(null);
      setProductPreview("");
      load(true);
    };

    const loadDealerPerformance = async (next = performanceFilter) => {
      const res = await api.get("/admin/dealer-performance", { params: next });
      setData((current) => ({ ...current, "dealer-performance": res.data }));
    };

    const createReward = async (e) => {
      e.preventDefault();
      const formData = new FormData();
      Object.entries(rewardForm).forEach(([key, value]) => formData.append(key, value));
      if (rewardImage) formData.append("image", rewardImage);
      await api.post("/admin/credit/rewards", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setRewardForm({ title: "", description: "", requiredCoins: 0, quantity: 0, category: "", terms: "", status: "active" });
      setRewardImage(null);
      setRewardPreview("");
      load(true);
    };

    const updateRedemption = async (id, patch) => {
      await api.patch(`/admin/credit/redemptions/${id}/status`, patch);
      load(true);
    };

    const sendPaymentRequest = async (orderId) => {
      const formData = new FormData();
      if (invoiceFiles[orderId]) formData.append("invoice", invoiceFiles[orderId]);
      await api.post(`/admin/finance/send-payment-request/${orderId}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      setInvoiceFiles({ ...invoiceFiles, [orderId]: null });
      load(true);
    };

    const sendPaymentReminder = async (paymentId) => {
      await api.post(`/admin/finance/reminder/${paymentId}`);
      alert("Payment reminder sent");
      load(true);
    };

    const quickEditProduct = async (product) => {
      setEditingProduct(product);
    };

    const saveProductEdit = async (form) => {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (!["id", "variants", "imageFile"].includes(key)) formData.append(key, value ?? "");
      });
      formData.append("variants", JSON.stringify(form.variants || []));
      if (form.imageFile) formData.append("image", form.imageFile);
      await api.put(`/admin/products/${form.id}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      setEditingProduct(null);
      load(true);
    };

    const deleteProduct = async (product) => {
      if (!confirm(`Delete or deactivate ${product.productName}?`)) return;
      await api.delete(`/admin/products/${product.id}`);
      load(true);
    };

    const sendMessage = async (messageFormOverride) => {
      await api.post("/admin/messages/send", messageFormOverride);
      setMessageForm({ title: "", message: "", dealerId: "" });
      load(true);
    };

    const markUpdateRead = async (id) => {
      await api.patch(`/internal-updates/${id}/read`);
      load(true);
    };

    const markAllUpdatesRead = async () => {
      await api.patch("/internal-updates/read-all");
      load(true);
    };

    if (loading) return <Layout title="Company Admin" subtitle="Company operations workspace" tabs={currentTabs} activeTab={activeTab} onTab={setActiveTab}><Loading /></Layout>;

    const dashboardCards = [
      ["Total Dealers", data.dashboard?.totalDealers], ["Products", data.dashboard?.totalProducts], ["Company Stock", data.dashboard?.totalCompanyStock],
      ["Low Stock", data.dashboard?.lowStockProducts], ["Pending Orders", data.dashboard?.pendingOrders], ["Delivered Orders", data.dashboard?.deliveredOrders],
      ["Pending Payments", data.dashboard?.pendingPayments], ["Revenue", formatMoney(data.dashboard?.totalRevenue)]
    ];

    return (
      <Layout title="Company Admin" subtitle={`${data.company?.companyName || "Company"} control center`} tabs={currentTabs} activeTab={activeTab} onTab={setActiveTab} unreadUpdates={data.internalUpdates?.unreadCount || 0}>
        <PageHeader
          eyebrow={String(user?.role || "Organization").replaceAll("_", " ")}
          title={currentTabs.find((tab) => tab.id === activeTab)?.label || "Dashboard"}
          description="Monitor organization operations, dealer performance, stock, orders, delivery and finance from one workspace."
        />
        {loadError && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 shadow-sm"><span>{loadError}</span><Button variant="ghost" onClick={load}>Retry</Button></div>}
        {activeTab === "dashboard" && (user?.role === "ADMIN_CEO" ? <AdminCeoReadOnlyOverview endpoint="/admin-ceo/dashboard" type="dashboard" /> : user?.role === "PRODUCT_DELIVERY_MANAGER" ? <ProductDeliveryManagerDashboard analytics={data.dashboard_analytics} products={data.products || []} orders={data.orders || []} dealerStock={data.stock_dealers || []} fallbackCards={dashboardCards} /> : user?.role === "FINANCE_MANAGER" ? <FinanceManagerDashboard analytics={data.dashboard_analytics} payments={data.finance_payments?.payments || []} stats={data.finance_payments?.stats || {}} fallbackCards={dashboardCards} /> : <AdminAnalytics analytics={data.dashboard_analytics} fallbackCards={dashboardCards} />)}
        {activeTab === "adminManagers" && <AdminManagers />}
        {activeTab === "adminChat" && <AdminTeamChat chatTarget={chatTarget} />}
        {activeTab === "dealersOverview" && <AdminCeoReadOnlyOverview endpoint="/admin-ceo/dealers-overview" type="dealers" />}
        {activeTab === "productOverview" && <AdminCeoReadOnlyOverview endpoint="/admin-ceo/product-overview" type="products" />}
        {activeTab === "orderOverview" && <AdminCeoReadOnlyOverview endpoint="/admin-ceo/order-overview" type="orders" />}
        {activeTab === "deliveryOverview" && <AdminCeoReadOnlyOverview endpoint="/admin-ceo/delivery-overview" type="delivery" />}
        {activeTab === "financeOverview" && <AdminCeoReadOnlyOverview endpoint="/admin-ceo/finance-overview" type="finance" />}
        {activeTab === "creditOverview" && <AdminCeoReadOnlyOverview endpoint="/admin-ceo/credit-overview" type="credit" />}
        {activeTab === "transferApprovals" && <AdminCeoTransferApprovals />}
        {activeTab === "transferHistory" && <AdminCeoTransferHistory />}
        {activeTab === "interDealerRequests" && <InterDealerRequests />}
        {activeTab === "dealerPerformance" && <DealerPerformancePanel data={data["dealer-performance"]} filters={performanceFilter} setFilters={setPerformanceFilter} reload={loadDealerPerformance} products={data.products || []} />}
        {activeTab === "dealers" && (
          <>
            <Section title="Create dealer">
              {dealerError && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{dealerError}</div>}
              <FormGrid onSubmit={(e) => {
                e.preventDefault();
                if (dealerForm.password !== dealerForm.confirmPassword) return alert("Passwords do not match");
                create("/admin/dealers", dealerForm, () => setDealerForm({ dealerName: "", ownerName: "", email: "", password: "", confirmPassword: "", phone: "", city: "", state: "", pincode: "", address: "" }));
              }}>
                <TextField label="Dealer Name" value={dealerForm.dealerName} onChange={(e) => setDealerForm({ ...dealerForm, dealerName: e.target.value })} required />
                <TextField label="Owner Name" value={dealerForm.ownerName} onChange={(e) => setDealerForm({ ...dealerForm, ownerName: e.target.value })} required />
                <TextField label="Email" type="email" value={dealerForm.email} onChange={(e) => setDealerForm({ ...dealerForm, email: e.target.value })} required />
                <TextField label="Phone" type="tel" pattern="\d{10}" title="Phone must be exactly 10 digits" maxLength={10} minLength={10} value={dealerForm.phone} onChange={(e) => setDealerForm({ ...dealerForm, phone: e.target.value.replace(/\D/g, '') })} required />
                <TextField label="Password" type={showDealerPassword ? "text" : "password"} value={dealerForm.password} onChange={(e) => setDealerForm({ ...dealerForm, password: e.target.value })} required suffix={<button type="button" onClick={() => setShowDealerPassword(!showDealerPassword)} className="text-slate-400 hover:text-slate-600 focus:outline-none">{showDealerPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>} />
                <TextField label="Confirm Password" type={showDealerConfirmPassword ? "text" : "password"} value={dealerForm.confirmPassword} onChange={(e) => setDealerForm({ ...dealerForm, confirmPassword: e.target.value })} required suffix={<button type="button" onClick={() => setShowDealerConfirmPassword(!showDealerConfirmPassword)} className="text-slate-400 hover:text-slate-600 focus:outline-none">{showDealerConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>} />
                <SearchableSelect label="State" options={Object.keys(INDIA_STATES_CITIES)} value={dealerForm.state} onChange={(val) => setDealerForm({ ...dealerForm, state: val, city: "" })} placeholder="Select State..." required />
                <SearchableSelect label="City" options={INDIA_STATES_CITIES[dealerForm.state] || []} value={dealerForm.city} onChange={(val) => setDealerForm({ ...dealerForm, city: val })} placeholder="Select City..." required disabled={!dealerForm.state} />
                <TextField label="Pincode" value={dealerForm.pincode} onChange={(e) => setDealerForm({ ...dealerForm, pincode: e.target.value })} required />
                <div className="md:col-span-2">
                  <TextField label="Address" value={dealerForm.address} onChange={(e) => setDealerForm({ ...dealerForm, address: e.target.value })} required />
                </div>
                <div className="md:col-span-2"><Button type="submit"><Plus size={16} /> Create Dealer</Button></div>
              </FormGrid>
            </Section>
            <SimpleTable title="Dealer list" rows={data.dealers} cols={["dealerName", "ownerName", "email", "state", "city", "pincode", "status"]} />
          </>
        )}
        {activeTab === "products" && (
          <>
            <Section title="Create product" actions={<span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">SKU auto-generates after save</span>}>
              <FormGrid onSubmit={createProduct}>
                {Object.keys(productForm).map((k) => <TextField key={k} label={k.replace(/([A-Z])/g, " $1")} value={productForm[k]} onChange={(e) => setProductForm({ ...productForm, [k]: e.target.value })} type={["price", "quantity", "lowStockLimit", "creditCoins"].includes(k) ? "number" : ["manufacturingDate", "expiryDate"].includes(k) ? "date" : "text"} min={["quantity", "lowStockLimit", "creditCoins"].includes(k) ? "0" : undefined} />)}
                <FileUploadPreview label="Product photo" preview={productPreview} accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; setProductImage(file || null); setProductPreview(file ? URL.createObjectURL(file) : ""); }} />
                <div className="md:col-span-2">
                  <VariantEditor rows={variantRows} setRows={setVariantRows} />
                </div>
                <div className="md:col-span-2"><Button type="submit"><Plus size={16} /> Add Product</Button></div>
              </FormGrid>
            </Section>
            <ProductTable rows={(data.products || []).map((p) => ({ ...p, quantity: p.CompanyInventory?.quantity || 0, lowStockLimit: p.CompanyInventory?.lowStockLimit || 0 }))} onEdit={quickEditProduct} onDelete={deleteProduct} />
            {editingProduct && <ProductEditModal product={editingProduct} onClose={() => setEditingProduct(null)} onSave={saveProductEdit} />}
            <SimpleTable title="Dealer-wise stock" rows={(data.stock_dealers || []).map((s) => ({ dealer: s.Dealer?.dealerName || "Dealer", location: [s.Dealer?.area, s.Dealer?.city].filter(Boolean).join(", "), product: productNameWithSku(s.Product, s.ProductVariant || s), variant: s.variantName || "-", color: s.colorName || "-", quantity: s.quantity, lowStockLimit: s.lowStockLimit }))} cols={["dealer", "location", "product", "variant", "color", "quantity", "lowStockLimit"]} />
          </>
        )}
        {activeTab === "inventory" && <InventoryBoard products={(data.products || []).map((p) => ({ ...p, quantity: p.CompanyInventory?.quantity || 0, lowStockLimit: p.CompanyInventory?.lowStockLimit || 0 }))} dealerStock={data.stock_dealers || []} />}
        {activeTab === "orders" && <OrderTable rows={data.orders || []} updateOrder={updateOrder} approveOrder={approveOrder} schedules={schedules} setSchedules={setSchedules} filter={orderFilter} setFilter={setOrderFilter} page={orderPage} setPage={setOrderPage} />}
        {activeTab === "delivery" && <DeliveryManagement rows={(data.orders || []).filter((o) => ["approved", "packing", "shipping", "out_for_delivery", "delivered"].includes(o.status))} updateOrder={updateOrder} filter={deliveryFilter} setFilter={setDeliveryFilter} page={deliveryPage} setPage={setDeliveryPage} />}
        {activeTab === "finance" && (
          <>
            <MetricGrid items={[[Clock3, "Pending Payments", data.finance_payments?.stats?.pendingPayments || 0, "#F59E0B"], [CheckCircle2, "Paid Payments", data.finance_payments?.stats?.paidPayments || 0, "#10B981"], [Banknote, "Cash Payments", data.finance_payments?.stats?.cashPayments || 0, "#8B5CF6"], [CreditCard, "Online Payments", data.finance_payments?.stats?.onlinePayments || 0, "#4F46E5"], [AlertCircle, "Total Pending", formatMoney(data.finance_payments?.stats?.totalPendingAmount || 0), "#EF4444"], [IndianRupee, "Total Paid", formatMoney(data.finance_payments?.stats?.totalPaidAmount || 0), "#10B981"]]} cols="xl:grid-cols-3" />
            <Section title="Approved orders waiting for payment request">
              {data["finance_approved-orders"]?.length ? <div className="space-y-3">{data["finance_approved-orders"].map((o) => <div key={o.id} className="rounded-md border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{o.orderNumber} · {formatMoney(o.totalAmount)}</p><p className="text-sm text-slate-500">{o.Dealer?.dealerName} · approved {o.approvedAt ? new Date(o.approvedAt).toLocaleString() : ""}</p></div><div className="flex flex-wrap items-center gap-2"><input type="file" className="max-w-56 text-sm" onChange={(e) => setInvoiceFiles({ ...invoiceFiles, [o.id]: e.target.files?.[0] || null })} /><Button onClick={() => sendPaymentRequest(o.id)}>Send Payment Request</Button></div></div></div>)}</div> : <Empty text="No approved orders waiting for payment request" />}
            </Section>
            <FinanceTable rows={data.finance_payments?.payments || []} dealers={data.dealers || []} filter={financeFilter} setFilter={setFinanceFilter} sendReminder={sendPaymentReminder} />
          </>
        )}
        {activeTab === "creditManagement" && <CreditManagement data={data} form={rewardForm} setForm={setRewardForm} preview={rewardPreview} setPreview={setRewardPreview} setImage={setRewardImage} createReward={createReward} updateRedemption={updateRedemption} />}
        {activeTab === "dealerSales" && <AdminDealerSales data={data["dealer-sales"]} dealers={data.dealers || []} products={data.products || []} />}
        {activeTab === "policies" && <Composer title="Policy & information" form={policyForm} setForm={setPolicyForm} submit={() => create("/admin/policies", policyForm, () => setPolicyForm({ ...policyForm, title: "", description: "" }))} rows={data.policies} cols={["title", "description", "visibleToDealers"]} />}
        {activeTab === "messages" && <AdminChat data={data.messages_conversations} form={messageForm} setForm={setMessageForm} sendMessage={sendMessage} />}
        {activeTab === "internalUpdates" && <InternalUpdates data={data.internalUpdates} filter={internalFilter} setFilter={setInternalFilter} markRead={markUpdateRead} markAll={markAllUpdatesRead} openChat={(targetId) => { setChatTarget(targetId); setActiveTab("adminChat"); }} />}
        {activeTab === "reports" && <SimpleTable title="Dealer reports and updates" rows={data.reports} cols={["title", "type", "description", "dealerId", "createdAt"]} />}
      </Layout>
    );
  }

  function ProductDeliveryManagerDashboard({ analytics, products = [], orders = [], dealerStock = [], fallbackCards = [] }) {
    const summary = analytics?.summary || {};
    const normalizedProducts = products.map((p) => ({ ...p, quantity: Number(p.CompanyInventory?.quantity ?? p.quantity ?? 0), lowStockLimit: Number(p.CompanyInventory?.lowStockLimit ?? p.lowStockLimit ?? 0) }));
    const statusCounts = orders.reduce((acc, order) => ({ ...acc, [order.status || "pending"]: (acc[order.status || "pending"] || 0) + 1 }), {});
    const orderStatusData = Object.entries(statusCounts).map(([status, count]) => ({ status: status.replaceAll("_", " "), count }));
    const stockHealth = [
      { name: "Available", value: normalizedProducts.filter((p) => p.quantity > p.lowStockLimit).length },
      { name: "Low stock", value: normalizedProducts.filter((p) => p.quantity > 0 && p.quantity <= p.lowStockLimit).length },
      { name: "Out of stock", value: normalizedProducts.filter((p) => p.quantity <= 0).length }
    ];
    const stockArea = normalizedProducts.slice().sort((a, b) => b.quantity - a.quantity).slice(0, 10).map((p) => ({ product: productNameWithSku(p), stock: p.quantity, lowLimit: p.lowStockLimit, sku: p.sku }));
    const dealerStockArea = Object.values(dealerStock.reduce((acc, row) => {
      const dealerName = row.Dealer?.dealerName || "Dealer";
      acc[dealerName] = acc[dealerName] || { dealerName, quantity: 0 };
      acc[dealerName].quantity += Number(row.quantity || 0);
      return acc;
    }, {})).slice(0, 10);
    const radarData = ["pending", "approved", "packing", "shipping", "out_for_delivery", "delivered", "rejected"].map((status) => ({ status: status.replaceAll("_", " "), orders: statusCounts[status] || 0 }));
    const cards = [
      ["Products", summary.totalProducts ?? normalizedProducts.length],
      ["Company Stock", summary.totalCompanyStock ?? normalizedProducts.reduce((sum, p) => sum + p.quantity, 0)],
      ["Low Stock", summary.lowStockProducts ?? stockHealth[1].value],
      ["Pending Orders", summary.pendingOrders ?? (statusCounts.pending || 0)],
      ["Approved Orders", summary.approvedOrders ?? (statusCounts.approved || 0)],
      ["Delivered Orders", summary.deliveredOrders ?? (statusCounts.delivered || 0)],
      ["Dealer Stock Rows", dealerStock.length],
      ["Delivery In Progress", ["packing", "shipping", "out_for_delivery"].reduce((sum, status) => sum + (statusCounts[status] || 0), 0)]
    ];
    const colors = ["#16A34A", "#F59E0B", "#DC2626", "#4F46E5", "#0EA5E9", "#8B5CF6"];
    const displayCards = cards.length ? cards : fallbackCards;
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{displayCards.map(([label, value]) => <Card key={label} label={label} value={value ?? 0} />)}</div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Product stock health">
            <div className="h-80"><ResponsiveContainer><PieChart><Pie data={stockHealth} dataKey="value" nameKey="name" outerRadius={95} label>{stockHealth.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div>
          </Section>
          <Section title="Order status radar">
            <div className="h-80"><ResponsiveContainer><RadarChart data={radarData}><PolarGrid /><PolarAngleAxis dataKey="status" /><PolarRadiusAxis allowDecimals={false} /><Radar name="Orders" dataKey="orders" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.35} /><Tooltip /><Legend /></RadarChart></ResponsiveContainer></div>
          </Section>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Company stock area graph">
            <div className="h-80"><ResponsiveContainer><AreaChart data={stockArea}><defs><linearGradient id="productStockFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.45} /><stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.05} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="product" /><YAxis /><Tooltip formatter={(value, name, row) => [value, name === "stock" ? `Stock (${row.payload.sku || "-"})` : "Low limit"]} /><Legend /><Area type="monotone" dataKey="stock" stroke="#0EA5E9" fill="url(#productStockFill)" /><Area type="monotone" dataKey="lowLimit" stroke="#F59E0B" fill="#F59E0B22" /></AreaChart></ResponsiveContainer></div>
          </Section>
          <Section title="Dealer inventory distribution">
            <div className="h-80"><ResponsiveContainer><AreaChart data={dealerStockArea}><defs><linearGradient id="dealerStockFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.45} /><stop offset="95%" stopColor="#10B981" stopOpacity={0.05} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dealerName" /><YAxis /><Tooltip /><Legend /><Area type="monotone" dataKey="quantity" stroke="#10B981" fill="url(#dealerStockFill)" /></AreaChart></ResponsiveContainer></div>
          </Section>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <MiniList title="Top stock products with SKU" rows={stockArea.map((p) => ({ productName: `${p.product} (${p.sku || "-"})`, quantity: p.stock }))} left="productName" right="quantity" />
          <MiniList title="Order status summary" rows={orderStatusData.map((row) => ({ status: row.status, count: row.count }))} left="status" right="count" />
        </div>
      </div>
    );
  }

  function FinanceManagerDashboard({ analytics, payments = [], stats = {}, fallbackCards = [] }) {
    const summary = analytics?.summary || {};
    const statusData = Object.entries(payments.reduce((acc, payment) => ({ ...acc, [payment.paymentStatus || "pending"]: (acc[payment.paymentStatus || "pending"] || 0) + 1 }), {})).map(([status, count]) => ({ status, count }));
    const methodData = Object.entries(payments.reduce((acc, payment) => ({ ...acc, [payment.paymentMethod || "not selected"]: (acc[payment.paymentMethod || "not selected"] || 0) + 1 }), {})).map(([method, count]) => ({ method, count, fill: method === "online" ? "#4F46E5" : method === "cash" ? "#0EA5E9" : "#94A3B8" }));
    const dealerOutstanding = Object.values(payments.filter((payment) => payment.paymentStatus === "pending").reduce((acc, payment) => {
      const dealer = payment.Dealer?.dealerName || "Dealer";
      acc[dealer] = acc[dealer] || { dealer, amount: 0, invoices: 0 };
      acc[dealer].amount += Number(payment.amount || 0);
      acc[dealer].invoices += 1;
      return acc;
    }, {})).sort((a, b) => b.amount - a.amount).slice(0, 10);
    const monthlyArea = payments.reduce((acc, payment) => {
      const key = payment.createdAt ? new Date(payment.createdAt).toISOString().slice(0, 10) : "No date";
      acc[key] = acc[key] || { date: key, paid: 0, pending: 0 };
      if (payment.paymentStatus === "paid") acc[key].paid += Number(payment.amount || 0);
      else acc[key].pending += Number(payment.amount || 0);
      return acc;
    }, {});
    const cashOnline = [
      { name: "Cash", value: stats.cashPayments || payments.filter((p) => p.paymentMethod === "cash").length, fill: "#0EA5E9" },
      { name: "Online", value: stats.onlinePayments || payments.filter((p) => p.paymentMethod === "online").length, fill: "#4F46E5" },
      { name: "Pending", value: stats.pendingPayments || payments.filter((p) => p.paymentStatus === "pending").length, fill: "#F59E0B" }
    ];
    const cards = [
      ["Pending Payments", stats.pendingPayments ?? summary.pendingPayments ?? 0],
      ["Paid Payments", stats.paidPayments ?? payments.filter((p) => p.paymentStatus === "paid").length],
      ["Cash Payments", stats.cashPayments ?? payments.filter((p) => p.paymentMethod === "cash").length],
      ["Online Payments", stats.onlinePayments ?? payments.filter((p) => p.paymentMethod === "online").length],
      ["Total Pending", formatMoney(stats.totalPendingAmount ?? summary.totalPendingAmount ?? 0)],
      ["Total Paid", formatMoney(stats.totalPaidAmount ?? summary.totalRevenue ?? 0)]
    ];
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(cards.length ? cards : fallbackCards).map(([label, value]) => <Card key={label} label={label} value={value ?? 0} />)}</div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Payment status bar graph">
            <div className="h-80"><ResponsiveContainer><BarChart data={statusData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="status" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="count" fill="#4F46E5" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
          </Section>
          <Section title="Payment method radial graph">
            <div className="h-80"><ResponsiveContainer><RadialBarChart innerRadius="25%" outerRadius="90%" data={cashOnline} startAngle={90} endAngle={-270}><RadialBar dataKey="value" background cornerRadius={10} /><Tooltip /><Legend iconSize={10} /></RadialBarChart></ResponsiveContainer></div>
          </Section>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Paid vs pending amount area graph">
            <div className="h-80"><ResponsiveContainer><AreaChart data={Object.values(monthlyArea).sort((a, b) => a.date.localeCompare(b.date)).slice(-14)}><defs><linearGradient id="paidFinanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16A34A" stopOpacity={0.45} /><stop offset="95%" stopColor="#16A34A" stopOpacity={0.05} /></linearGradient><linearGradient id="pendingFinanceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F59E0B" stopOpacity={0.45} /><stop offset="95%" stopColor="#F59E0B" stopOpacity={0.05} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip formatter={(value) => formatMoney(value)} /><Legend /><Area type="monotone" dataKey="paid" stroke="#16A34A" fill="url(#paidFinanceFill)" /><Area type="monotone" dataKey="pending" stroke="#F59E0B" fill="url(#pendingFinanceFill)" /></AreaChart></ResponsiveContainer></div>
          </Section>
          <Section title="Dealer-wise outstanding amount">
            <div className="h-80"><ResponsiveContainer><BarChart data={dealerOutstanding}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dealer" /><YAxis /><Tooltip formatter={(value) => formatMoney(value)} /><Legend /><Bar dataKey="amount" fill="#0EA5E9" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
          </Section>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <MiniList title="Outstanding dealers" rows={dealerOutstanding} left="dealer" right="amount" prefix="Rs " />
          <Recent title="Recent messages" rows={analytics?.recentMessages || []} primary={(row) => row.sender?.name || row.title || "Message"} secondary={(row) => `${row.sender?.role ? `${row.sender.role.replaceAll("_", " ")} - ` : ""}${row.message || row.title || ""}`} />
        </div>
      </div>
    );
  }

  function AdminAnalytics({ analytics, fallbackCards }) {
    if (!analytics) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{fallbackCards.map(([label, value]) => <Card key={label} label={label} value={value} />)}</div>;
    const summaryCards = [
      ["Total Dealers", analytics.summary.totalDealers, Users],
      ["Total Products", analytics.summary.totalProducts, PackageCheck],
      ["Total Company Stock", analytics.summary.totalCompanyStock, PackageCheck],
      ["Low Stock Products", analytics.summary.lowStockProducts, AlertTriangle],
      ["Pending Orders", analytics.summary.pendingOrders, Clock],
      ["Approved Orders", analytics.summary.approvedOrders, CheckCircle2],
      ["Delivered Orders", analytics.summary.deliveredOrders, Truck],
      ["Pending Payments", analytics.summary.pendingPayments, IndianRupee],
      ["Total Revenue", formatMoney(analytics.summary.totalRevenue), IndianRupee],
      ["Total Pending Amount", formatMoney(analytics.summary.totalPendingAmount), IndianRupee],
      ["Today Dealer Sales", analytics.salesStats?.todayCompanyDealerSales || 0, PackageCheck],
      ["Monthly Dealer Sales", analytics.salesStats?.monthlyDealerSales || 0, PackageCheck]
    ];
    const maxOrders = Math.max(...analytics.orderStatusCounts.map((row) => row.count), 1);
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{summaryCards.map(([label, value, Icon]) => <Card key={label} label={label} value={value ?? 0} icon={Icon} />)}</div>
        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Order analytics">{analytics.orderStatusCounts.map((row) => <div key={row.status} className="mb-3"><div className="mb-1 flex justify-between text-sm"><span className="capitalize">{row.status.replaceAll("_", " ")}</span><span>{row.count}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand" style={{ width: `${(row.count / maxOrders) * 100}%` }} /></div></div>)}</Section>
          <Section title="Payment status ratio"><div className="h-72"><ResponsiveContainer><PieChart><Pie data={analytics.financeStats.paymentStatusRatio} dataKey="count" nameKey="status" outerRadius={90} label>{analytics.financeStats.paymentStatusRatio.map((entry, index) => <Cell key={entry.status} fill={["#F59E0B", "#16A34A", "#DC2626"][index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></Section>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <MiniList title="Top 5 highest stock products" rows={(analytics.inventoryStats.topHighestStockProducts || []).map((row) => ({ ...row, productName: rowNameWithSku(row) }))} left="productName" right="quantity" />
          <MiniList title="Top 5 low stock products" rows={(analytics.inventoryStats.topLowStockProducts || []).map((row) => ({ ...row, productName: rowNameWithSku(row) }))} left="productName" right="quantity" />
          <MiniList title="Dealer-wise outstanding payment" rows={analytics.financeStats.dealerWiseOutstandingPayment} left="dealerName" right="amount" prefix="Rs " />
          <MiniList title="Area-wise dealer count" rows={analytics.dealerStats.areaWiseDealerCount} left="area" right="count" />
          <MiniList title="Top selling products" rows={(analytics.salesStats?.topSellingProducts || []).map((row) => ({ ...row, productName: rowNameWithSku(row) }))} left="productName" right="quantitySold" />
          <MiniList title="Dealer sales performance" rows={analytics.salesStats?.dealerSalesPerformance || []} left="dealerName" right="quantitySold" />
        </div>
        <Section title="Dealer stock summary"><div className="h-72"><ResponsiveContainer><BarChart data={analytics.inventoryStats.dealerWiseStockSummary}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dealerName" /><YAxis /><Tooltip /><Bar dataKey="quantity" fill="#0E7490" /></BarChart></ResponsiveContainer></div></Section>
        <div className="grid gap-6 xl:grid-cols-2">
          <Recent title="Recent orders" rows={analytics.recentOrders} primary={(row) => row.orderNumber} secondary={(row) => `${row.status} | ${formatMoney(row.totalAmount)}`} />
          <Recent title="Recent payments" rows={analytics.recentPayments} primary={(row) => row.Dealer?.dealerName || row.invoiceNumber || "Payment"} secondary={(row) => `${row.Order?.items?.map(orderItemLabel).join(", ") || row.productSummary || row.paymentStatus} | ${formatMoney(row.amount)}`} />
          <Recent title="Recent messages" rows={analytics.recentMessages} primary={(row) => row.sender?.name || row.title || "Message"} secondary={(row) => `${row.sender?.role ? `${row.sender.role.replaceAll("_", " ")} - ` : ""}${row.message || row.title || ""}`} />
          <Recent title="Recent delivery updates" rows={analytics.recentDeliveryUpdates} primary={(row) => row.status} secondary={(row) => row.message} />
        </div>
      </div>
    );
  }

  function InterDealerRequests() {
    const [payload, setPayload] = useState({ rows: [], analytics: {} });
    const [loading, setLoading] = useState(true);
    const load = async () => {
      setLoading(true);
      const { data } = await api.get("/admin/stock-transfer-requests");
      setPayload(data);
      setLoading(false);
    };
    useEffect(() => { load(); }, []);
    const approve = async (row) => {
      await api.patch(`/admin/stock-transfer-requests/${row.id}/manager-approve`);
      load();
    };
    const reject = async (row) => {
      const reason = prompt("Reason for rejection") || "";
      if (!reason.trim()) return;
      await api.patch(`/admin/stock-transfer-requests/${row.id}/manager-reject`, { reason });
      load();
    };
    if (loading) return <Loading />;
    const cards = [
      ["Pending inter-dealer requests", payload.analytics.REQUESTED || 0],
      ["Manager approved requests", payload.analytics.MANAGER_APPROVED || 0],
      ["Completed transfers", payload.analytics.TRANSFER_COMPLETED || 0],
      ["Rejected requests", (payload.analytics.MANAGER_REJECTED || 0) + (payload.analytics.ADMIN_REJECTED || 0)]
    ];
    return <div className="space-y-6"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <Card key={label} label={label} value={value} />)}</div><TransferRequestTable rows={payload.rows || []} mode="manager" onApprove={approve} onReject={reject} /></div>;
  }

  function AdminCeoTransferApprovals() {
    const [payload, setPayload] = useState({ approvals: [], analytics: {} });
    const [loading, setLoading] = useState(true);
    const load = async () => {
      setLoading(true);
      const { data } = await api.get("/admin-ceo/stock-transfer-requests");
      setPayload(data);
      setLoading(false);
    };
    useEffect(() => { load(); }, []);
    const approve = async (row) => {
      if (!confirm(`Final approve transfer of ${row.requestedQuantity} ${row.productNameSnapshot}?`)) return;
      await api.patch(`/admin-ceo/stock-transfer-requests/${row.id}/final-approve`);
      load();
    };
    const reject = async (row) => {
      const reason = prompt("Reason for final rejection") || "";
      if (!reason.trim()) return;
      await api.patch(`/admin-ceo/stock-transfer-requests/${row.id}/final-reject`, { reason });
      load();
    };
    if (loading) return <Loading />;
    return <div className="space-y-6"><TransferAnalytics analytics={payload.analytics} /><TransferRequestTable rows={payload.approvals || []} mode="admin" onApprove={approve} onReject={reject} /></div>;
  }

  function AdminCeoTransferHistory() {
    const [payload, setPayload] = useState({ rows: [], analytics: {} });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("ALL");
    useEffect(() => {
      setLoading(true);
      api.get("/admin-ceo/stock-transfer-requests").then((res) => setPayload(res.data)).finally(() => setLoading(false));
    }, []);
    if (loading) return <Loading />;
    const rows = (payload.rows || []).filter((row) => filter === "ALL" || row.status === filter);
    return <div className="space-y-6"><TransferAnalytics analytics={payload.analytics} /><Section title="Transfer history" actions={<select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>{["ALL", "REQUESTED", "MANAGER_APPROVED", "TRANSFER_COMPLETED", "MANAGER_REJECTED", "ADMIN_REJECTED", "CANCELLED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select>}><TransferRequestTable rows={rows} mode="readonly" /></Section></div>;
  }

  function TransferAnalytics({ analytics = {} }) {
    const cards = [
      ["Total transfer requests", analytics.totalTransferRequests || 0],
      ["Pending approvals", analytics.pendingApprovals || 0],
      ["Completed transfers", analytics.completedTransfers || 0],
      ["Rejected requests", analytics.rejectedRequests || 0],
      ["Top product requested", analytics.topProductRequested?.label || "-"],
      ["Top sender dealer", analytics.topDealerSender?.label || "-"],
      ["Top requester dealer", analytics.topDealerRequester?.label || "-"]
    ];
    return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <Card key={label} label={label} value={value} />)}</div>;
  }

  function TransferRequestTable({ rows = [], mode, onApprove, onReject }) {
    if (!rows.length) return <Section title="Inter-dealer transfer requests"><Empty text="No inter-dealer transfer requests found" /></Section>;
    return <Section title="Inter-dealer transfer requests"><div className="overflow-x-auto rounded-md border border-slate-200"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500"><tr>{["Requester", "Sender", "Product", "Quantity", "Current Sender Stock", "Reason", "Status", "Approval Timeline", "Action"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="align-top"><td className="px-4 py-3"><DealerCell dealer={row.requesterDealer} /></td><td className="px-4 py-3"><DealerCell dealer={row.senderDealer} /></td><td className="px-4 py-3"><p className="font-semibold text-slate-950">{row.productNameSnapshot}</p><p className="text-xs text-slate-500">{row.sku} {row.variantNameSnapshot ? `| ${row.variantNameSnapshot} / ${row.colorNameSnapshot || "-"}` : ""}</p></td><td className="px-4 py-3 text-lg font-semibold text-slate-950">{row.requestedQuantity}</td><td className="px-4 py-3">{row.availableQuantityAtRequest} at request</td><td className="px-4 py-3 max-w-56 text-slate-600">{row.reason || "-"}</td><td className="px-4 py-3"><StatusBadge value={row.status} /></td><td className="px-4 py-3"><ApprovalTimeline row={row} /></td><td className="px-4 py-3"><div className="flex flex-wrap gap-2">{mode !== "readonly" && ((mode === "manager" && row.status === "REQUESTED") || (mode === "admin" && row.status === "MANAGER_APPROVED")) ? <><Button className="min-h-9 px-3 py-1.5 text-xs" onClick={() => onApprove(row)}>Approve</Button><Button variant="danger" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => onReject(row)}>Reject</Button></> : <span className="text-xs font-semibold text-slate-400">No action</span>}</div></td></tr>)}</tbody></table></div></Section>;
  }

  function DealerCell({ dealer }) {
    return <div><p className="font-semibold text-slate-950">{dealer?.dealerName || "-"}</p><p className="text-xs text-slate-500">{[dealer?.area, dealer?.city, dealer?.pincode].filter(Boolean).join(", ") || dealer?.address || "-"}</p></div>;
  }

  function ApprovalTimeline({ row }) {
    const steps = [
      ["Request Created", row.createdAt, true],
      ["Manager Approval", row.managerApprovedAt, ["MANAGER_APPROVED", "TRANSFER_COMPLETED"].includes(row.status)],
      ["Admin CEO Final Approval", row.adminApprovedAt, row.status === "TRANSFER_COMPLETED"],
      ["Transfer Completed", row.completedAt, row.status === "TRANSFER_COMPLETED"]
    ];
    return <div className="space-y-1">{steps.map(([label, date, done]) => <div key={label} className="flex items-center gap-2 text-xs"><span className={`h-2 w-2 rounded-full ${done ? "bg-emerald-500" : "bg-slate-300"}`} /><span className={done ? "font-semibold text-slate-700" : "text-slate-400"}>{label}</span><span className="text-slate-400">{date ? formatDate(date) : ""}</span></div>)}{(row.managerRejectReason || row.adminRejectReason) && <p className="mt-2 text-xs font-semibold text-rose-600">{row.managerRejectReason || row.adminRejectReason}</p>}</div>;
  }

  function MiniList({ title, rows = [], left, right, prefix = "" }) {
    return <Section title={title}>{rows.length ? <div className="space-y-2">{rows.map((row, i) => <div key={`${title}-${i}`} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"><span>{row[left] || "Unassigned"}</span><span className="font-semibold">{prefix}{row[right] ?? 0}</span></div>)}</div> : <Empty />}</Section>;
  }

  function Recent({ title, rows = [], primary, secondary }) {
    return <Section title={title}>{rows.length ? <div className="space-y-2">{rows.map((row) => <div key={`${title}-${row.id}`} className="rounded-md border border-slate-100 p-3"><p className="font-semibold">{primary(row)}</p><p className="truncate text-sm text-slate-500">{secondary(row)}</p></div>)}</div> : <Empty />}</Section>;
  }

  function statusBadgeClasses(value) {
    const normalized = String(value || "").toLowerCase();
    if (normalized === "paid") return "bg-green-50 text-green-700 border-green-200";
    if (normalized === "pending") return "bg-yellow-50 text-yellow-700 border-yellow-200";
    if (["failed", "rejected"].includes(normalized)) return "bg-red-50 text-red-700 border-red-200";
    if (normalized === "cash") return "bg-slate-100 text-slate-700 border-slate-200";
    if (normalized === "online") return "bg-cyan-50 text-brand border-cyan-200";
    return "bg-slate-50 text-slate-600 border-slate-200";
  }

  function Badge({ children }) {
    return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusBadgeClasses(children)}`}>{children || "-"}</span>;
  }

  function FinanceMetric({ label, value, tone }) {
    return <div className={`rounded-md border bg-white p-5 shadow-soft ${statusBadgeClasses(tone)}`}><p className="text-sm">{label}</p><p className="mt-2 text-2xl font-semibold">{value ?? 0}</p></div>;
  }

  function fullVariantSku(product, variant) {
    return [product.sku, variant.skuSuffix].filter(Boolean).join("-");
  }

  function ProductTable({ rows, onEdit, onDelete }) {
    const [selected, setSelected] = useState(null);
    return (
      <>
        <Section title="Company stock">
          {rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{["Photo", "Product + SKU", "Category", "Description", "Price", "Quantity", "Variants with SKU", "Status", "Actions"].map((h) => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((p, index) => <tr className={`border-t border-slate-100 transition hover:bg-slate-50 ${index % 2 ? "bg-stone-50/70" : "bg-white"}`} key={p.id}><td className="p-3">{p.image ? <img src={fileUrl(p.image)} alt={p.productName} className="h-12 w-12 rounded-md object-cover" /> : <div className="h-12 w-12 rounded-md bg-slate-100" />}</td><td className="p-3"><button type="button" onClick={() => setSelected(p)} className="font-semibold text-indigo-700 hover:underline">{productNameWithSku(p)}</button><p className="mt-1 font-mono text-xs text-slate-500">Main SKU: {p.sku || "-"}</p><p className="mt-1 text-xs text-slate-500">{formatDate(p.manufacturingDate)} - {formatDate(p.expiryDate)}</p></td><td>{p.category || "-"}</td><td className="max-w-xs truncate">{p.description || "-"}</td><td>{formatMoney(p.price)}</td><td><span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{p.quantity}</span></td><td className="max-w-sm"><div className="space-y-1">{(p.variants || []).map((v) => <div key={v.id || v.skuSuffix} className="rounded-md bg-slate-50 px-2 py-1"><span className="font-semibold">{v.variantName}/{v.colorName}</span><span className="ml-2 font-mono text-xs text-indigo-700">{fullVariantSku(p, v)}</span><span className="ml-2 text-xs text-slate-500">{v.stockQuantity} qty</span></div>) || "-"}</div></td><td><StatusBadge value={p.status} /></td><td><div className="flex flex-nowrap gap-1"><button className="rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50" onClick={() => onEdit(p)}>Edit</button><button className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50" onClick={() => onDelete(p)}>Delete</button></div></td></tr>)}</tbody></table></div> : <Empty />}
        </Section>
        {selected && <ProductDetailsModal product={selected} onClose={() => setSelected(null)} />}
      </>
    );
  }

  function VariantEditor({ rows, setRows }) {
    const update = (index, key, value) => setRows(rows.map((row, i) => i === index ? { ...row, [key]: value } : row));
    const add = () => setRows([...rows, { variantName: "", colorName: "", stockQuantity: 0, priceOverride: "", skuSuffix: "", status: "active" }]);
    const remove = (index) => setRows(rows.filter((_, i) => i !== index));
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-semibold text-slate-900">Variant, color and stock</p>
          <Button type="button" variant="ghost" onClick={add}><Plus size={16} /> Add Variant Color Stock</Button>
        </div>
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="grid gap-3 rounded-md bg-white p-3 md:grid-cols-5">
              <TextField label="Variant name" value={row.variantName} onChange={(e) => update(index, "variantName", e.target.value)} required />
              <TextField label="Color name" value={row.colorName} onChange={(e) => update(index, "colorName", e.target.value)} required />
              <TextField label="Stock quantity" type="number" min="0" value={row.stockQuantity} onChange={(e) => update(index, "stockQuantity", e.target.value)} required />
              <TextField label="Price override" type="number" min="0" value={row.priceOverride} onChange={(e) => update(index, "priceOverride", e.target.value)} />
              <div className="flex items-end"><Button type="button" variant="ghost" disabled={rows.length === 1} onClick={() => remove(index)}>Remove</Button></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function ProductModalShell({ title, onClose, children, footer }) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
        <div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">Close</button>
          </div>
          <div className="p-5">{children}</div>
          {footer && <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">{footer}</div>}
        </div>
      </div>
    );
  }

  function ProductDetailsModal({ product, onClose }) {
    const detailRows = [
      ["Car image / model", product.productName],
      ["Main SKU", product.sku],
      ["Manufacturing Date", formatDate(product.manufacturingDate)],
      ["Expiry Date", formatDate(product.expiryDate)],
      ["Category", product.category],
      ["Description", product.description],
      ["Price", formatMoney(product.price)],
      ["Low Stock Limit", product.lowStockLimit],
      ["Credit Coins", product.creditCoins || 0],
      ["Available Stock", product.quantity || 0],
      ["Status", product.status]
    ];
    return (
      <ProductModalShell title={productNameWithSku(product)} onClose={onClose}>
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          {product.image ? <img src={fileUrl(product.image)} alt={product.productName} className="h-72 w-full rounded-xl object-cover" /> : <div className="grid h-72 w-full place-items-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-400">No image</div>}
          <div>
            <div className="grid gap-3 sm:grid-cols-2">
              {detailRows.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-stone-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words font-semibold text-slate-900">{value ?? "-"}</p></div>)}
            </div>
            <div className="mt-5 rounded-xl border border-slate-200">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 font-semibold">Variants and SKU numbers</div>
              <div className="divide-y divide-slate-100">
                {(product.variants || []).map((variant) => <div key={variant.id || variant.skuSuffix} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-5"><span className="font-semibold">{variant.variantName}</span><span>{variant.colorName}</span><span className="font-mono text-xs text-indigo-700">{fullVariantSku(product, variant)}</span><span>{variant.stockQuantity} stock</span><StatusBadge value={variant.status} /></div>)}
              </div>
            </div>
          </div>
        </div>
      </ProductModalShell>
    );
  }

  function ProductEditModal({ product, onClose, onSave }) {
    const [form, setForm] = useState({
      id: product.id,
      productName: product.productName || "",
      category: product.category || "",
      description: product.description || "",
      manufacturingDate: product.manufacturingDate || "",
      expiryDate: product.expiryDate || "",
      price: product.price || 0,
      creditCoins: product.creditCoins || 0,
      status: product.status || "active",
      variants: (product.variants || []).map((variant) => ({ ...variant, priceOverride: variant.priceOverride ?? "" })),
      image: product.image || "",
      imageFile: null
    });
    const [preview, setPreview] = useState(product.image ? fileUrl(product.image) : "");
    const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
    const updateVariant = (index, key, value) => update("variants", form.variants.map((row, i) => i === index ? { ...row, [key]: value } : row));
    const addVariant = () => update("variants", [...form.variants, { variantName: "", colorName: "", stockQuantity: 0, priceOverride: "", status: "active" }]);
    return (
      <ProductModalShell title={`Edit ${productNameWithSku(product)}`} onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(form)}>Save Product</Button></>}>
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">SKU is locked and will not change: <span className="font-mono">{product.sku}</span></div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Product name" value={form.productName} onChange={(e) => update("productName", e.target.value)} required />
          <TextField label="Category" value={form.category} onChange={(e) => update("category", e.target.value)} />
          <TextField label="Manufacturing date" type="date" value={form.manufacturingDate || ""} onChange={(e) => update("manufacturingDate", e.target.value)} />
          <TextField label="Expiry date" type="date" value={form.expiryDate || ""} onChange={(e) => update("expiryDate", e.target.value)} />
          <TextField label="Price" type="number" min="0" value={form.price} onChange={(e) => update("price", e.target.value)} />
          <TextField label="Credit coins" type="number" min="0" value={form.creditCoins} onChange={(e) => update("creditCoins", e.target.value)} />
          <label className="text-sm font-semibold text-slate-600">Status toggle<button type="button" onClick={() => update("status", form.status === "active" ? "inactive" : "active")} className={`mt-1 flex h-11 w-full items-center justify-between rounded-full border px-4 text-sm font-bold ${form.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-600"}`}><span>{form.status === "active" ? "Active" : "Inactive"}</span><span className={`h-6 w-11 rounded-full p-1 ${form.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${form.status === "active" ? "translate-x-5" : ""}`} /></span></button></label>
          <div><FileUploadPreview label="Product photo" preview={preview} accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; update("imageFile", file); setPreview(URL.createObjectURL(file)); }} /></div>
          <label className="md:col-span-2 text-sm font-semibold text-slate-600">Description<textarea className="mt-1 min-h-28 w-full rounded-md border border-slate-200 p-3 text-sm" value={form.description} onChange={(e) => update("description", e.target.value)} /></label>
        </div>
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">Variants</p><Button type="button" variant="ghost" onClick={addVariant}><Plus size={16} /> Add Variant</Button></div>
          <div className="space-y-3">{form.variants.map((variant, index) => <div key={variant.id || index} className="grid gap-3 rounded-md bg-white p-3 md:grid-cols-6"><TextField label="Variant name" value={variant.variantName || ""} onChange={(e) => updateVariant(index, "variantName", e.target.value)} /><TextField label="Color" value={variant.colorName || ""} onChange={(e) => updateVariant(index, "colorName", e.target.value)} /><TextField label="Stock" type="number" min="0" value={variant.stockQuantity || 0} onChange={(e) => updateVariant(index, "stockQuantity", e.target.value)} /><TextField label="Price override" type="number" min="0" value={variant.priceOverride || ""} onChange={(e) => updateVariant(index, "priceOverride", e.target.value)} /><div><p className="text-sm font-semibold text-slate-600">Variant SKU</p><p className="mt-2 rounded-md bg-slate-100 px-3 py-2 font-mono text-xs text-slate-700">{fullVariantSku(product, variant)}</p></div><div className="flex items-end"><button type="button" onClick={() => updateVariant(index, "status", variant.status === "active" ? "inactive" : "active")} className={`rounded-full px-3 py-2 text-xs font-bold ${variant.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{variant.status === "active" ? "Active" : "Inactive"}</button></div></div>)}</div>
        </div>
      </ProductModalShell>
    );
  }

  function DealerPerformancePanel({ data = {}, filters, setFilters, reload, products = [] }) {
    const summary = data.summary || {};
    const charts = data.charts || {};
    const tables = data.tables || {};
    const dealers = data.filters?.dealers || [];
    const areas = data.filters?.areas || [];
    const set = (key, value) => {
      const next = { ...filters, [key]: value, ...(key === "area" ? { dealerId: "" } : {}) };
      setFilters(next);
      reload(next);
    };
    const cards = [
      ["Total orders", summary.totalOrders], ["Approved orders", summary.approvedOrders], ["Delivered orders", summary.deliveredOrders], ["Rejected orders", summary.rejectedOrders],
      ["Purchase amount", formatMoney(summary.totalPurchaseAmount)], ["Paid amount", formatMoney(summary.totalPaidAmount)], ["Pending payment", formatMoney(summary.pendingPaymentAmount)], ["Sales units", summary.totalSalesUnits],
      ["Inventory value", formatMoney(summary.currentInventoryValue)], ["Low stock", summary.lowStockProducts], ["Coins earned", summary.creditCoinsEarned], ["Credit balance", summary.currentCreditBalance]
    ];
    return (
      <div className="space-y-6">
        <Section title="Dealer Performance Filters">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <label className="block"><span className="text-sm font-semibold text-slate-600">Area</span><select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={filters.area} onChange={(e) => set("area", e.target.value)}><option value="">All areas</option>{areas.map((area) => <option key={area} value={area}>{area}</option>)}</select></label>
            <label className="block"><span className="text-sm font-semibold text-slate-600">Dealer</span><select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={filters.dealerId} onChange={(e) => set("dealerId", e.target.value)}><option value="">Select dealer</option>{dealers.map((dealer) => <option key={dealer.id} value={dealer.id}>{dealer.dealerName}</option>)}</select></label>
            <TextField label="Start Date" type="date" value={filters.startDate} onChange={(e) => set("startDate", e.target.value)} />
            <TextField label="End Date" type="date" value={filters.endDate} onChange={(e) => set("endDate", e.target.value)} />
            <label className="block"><span className="text-sm font-semibold text-slate-600">Product</span><select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={filters.productId} onChange={(e) => set("productId", e.target.value)}><option value="">All products</option>{products.map((p) => <option key={p.id} value={p.id}>{productNameWithSku(p)}</option>)}</select></label>
            <label className="block"><span className="text-sm font-semibold text-slate-600">Payment</span><select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={filters.paymentStatus} onChange={(e) => set("paymentStatus", e.target.value)}><option value="">All</option><option value="paid">Paid</option><option value="pending">Unpaid/Pending</option><option value="cash">Cash</option><option value="online">Online</option></select></label>
          </div>
          {filters.dealerId && <p className="mt-4 text-sm font-semibold text-slate-700">{(() => { const dealer = dealers.find((d) => String(d.id) === String(filters.dealerId)); return dealer ? `${dealer.dealerName} - ${[dealer.area, dealer.city, dealer.pincode].filter(Boolean).join(", ")}` : ""; })()}</p>}
        </Section>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <Card key={label} label={label} value={value ?? 0} />)}</div>
        <div className="grid gap-6 xl:grid-cols-2">
          <ChartBlock title="Monthly purchase amount" data={charts.monthlyPurchases || []} x="month" y="value" />
          <ChartBlock title="Monthly sales units" data={charts.monthlySales || []} x="month" y="value" />
          <PieBlock title="Payment status" data={charts.paymentStatus || []} name="status" />
          <PieBlock title="Order status" data={charts.orderStatus || []} name="status" />
          <ChartBlock title="Product-wise purchase" data={charts.productWisePurchases || []} x="productName" y="quantity" />
          <ChartBlock title="Credit earned vs redeemed" data={charts.creditEarnedRedeemed || []} x="month" y="earned" second="redeemed" />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <SimpleTable title="Recent orders" rows={(tables.recentOrders || []).map((o) => ({ order: o.orderNumber, dealer: o.Dealer?.dealerName, status: o.status, amount: formatMoney(o.totalAmount) }))} cols={["order", "dealer", "status", "amount"]} />
          <SimpleTable title="Recent payments" rows={(tables.recentPayments || []).map((p) => ({ dealer: p.Dealer?.dealerName || "Dealer", products: p.Order?.items?.map(orderItemLabel).join(", ") || p.productSummary || "-", amount: formatMoney(p.amount), method: p.paymentMethod || "-", status: p.paymentStatus, date: p.paidAt ? new Date(p.paidAt).toLocaleString() : new Date(p.createdAt).toLocaleString() }))} cols={["dealer", "products", "amount", "method", "status", "date"]} />
          <SimpleTable title="Recent sales" rows={(tables.recentSales || []).map((s) => ({ product: productNameWithSku(s.Product, s.ProductVariant || s), variant: s.variantName || "-", color: s.colorName || "-", quantity: s.quantitySold }))} cols={["product", "variant", "color", "quantity"]} />
          <SimpleTable title="Recent redemptions" rows={(tables.recentRedemptions || []).map((r) => ({ dealer: r.Dealer?.dealerName || "Dealer", reward: r.reward?.title || "-", coins: r.coinsUsed, status: r.status, requested: r.requestedAt ? new Date(r.requestedAt).toLocaleString() : new Date(r.createdAt).toLocaleString(), expectedProvideDate: r.expectedProvideDate || "-" }))} cols={["dealer", "reward", "coins", "status", "requested", "expectedProvideDate"]} />
        </div>
      </div>
    );
  }

  function ChartBlock({ title, data = [], x, y, second }) {
    const money = title.toLowerCase().includes("amount");
    return <Section title={title}>{data.length ? <div className="h-80 min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 10, right: 18, left: 22, bottom: 42 }} barCategoryGap="28%"><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey={x} interval={0} angle={-25} textAnchor="end" height={62} tick={{ fontSize: 11, fill: "#475569" }} /><YAxis width={78} tick={{ fontSize: 11, fill: "#475569" }} tickFormatter={(value) => money ? `₹${Number(value || 0).toLocaleString("en-IN")}` : value} /><Tooltip formatter={(value, name) => [money ? formatMoney(value) : value, name]} /><Bar dataKey={y} fill="#2563EB" maxBarSize={42} />{second && <Bar dataKey={second} fill="#F59E0B" maxBarSize={42} />}</BarChart></ResponsiveContainer></div> : <Empty />}</Section>;
  }

  function PieBlock({ title, data = [], name }) {
    return <Section title={title}>{data.length ? <div className="h-72"><ResponsiveContainer><PieChart><Pie data={data} dataKey="count" nameKey={name} outerRadius={90} label>{data.map((entry, index) => <Cell key={entry[name]} fill={["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#64748B"][index % 5]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div> : <Empty />}</Section>;
  }

  function CreditManagement({ data, form, setForm, preview, setPreview, setImage, createReward, updateRedemption }) {
    const summary = data.credit_summary || {};
    const rewards = data.credit_rewards || [];
    const redemptions = data.credit_redemptions || [];
    const cards = [
      ["Total rewards", summary.totalRewards], ["Active rewards", summary.activeRewards], ["Total redemptions", summary.totalRedemptions], ["Pending redemptions", summary.pendingRedemptions],
      ["Completed", summary.completedRedemptions], ["Coins redeemed", summary.totalCoinsRedeemed], ["Remaining stock", summary.remainingRewardStock], ["Coins issued", summary.totalCreditCoinsIssued]
    ];
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <Card key={label} label={label} value={value ?? 0} />)}</div>
        <Section title="Create reward">
          <FormGrid onSubmit={createReward}>
            {Object.keys(form).map((k) => <TextField key={k} label={k.replace(/([A-Z])/g, " $1")} type={["requiredCoins", "quantity"].includes(k) ? "number" : "text"} min={["requiredCoins", "quantity"].includes(k) ? "0" : undefined} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={["title", "requiredCoins", "quantity"].includes(k)} />)}
            <FileUploadPreview label="Reward image" preview={preview} accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; setImage(file || null); setPreview(file ? URL.createObjectURL(file) : ""); }} />
            <div className="md:col-span-2"><Button type="submit"><Gift size={16} /> Save Reward</Button></div>
          </FormGrid>
        </Section>
        <Section title="Reward list">{rewards.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rewards.map((reward) => <div key={reward.id} className="rounded-md border border-slate-200 p-4">{reward.image ? <img src={fileUrl(reward.image)} alt={reward.title} className="mb-3 h-32 w-full rounded-md object-cover" /> : <div className="mb-3 h-32 rounded-md bg-slate-100" />}<div className="flex justify-between gap-3"><div><p className="font-semibold">{reward.title}</p><p className="text-sm text-slate-500">{reward.category || "General"}</p></div><StatusBadge value={reward.status} /></div><p className="mt-2 text-sm text-slate-600">{reward.description}</p><p className="mt-3 font-semibold">{reward.requiredCoins} coins | {reward.quantity} left</p></div>)}</div> : <Empty />}</Section>
        <Section title="Redemption requests">{redemptions.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{["Dealer", "Reward", "Coins", "Status", "Requested", "Provide Date", "Actions"].map((h) => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{redemptions.map((r) => <tr key={r.id} className="border-t border-slate-100"><td className="p-3">{r.Dealer?.dealerName || r.dealerId}</td><td>{r.reward?.title}</td><td>{r.coinsUsed}</td><td><StatusBadge value={r.status} /></td><td>{new Date(r.requestedAt || r.createdAt).toLocaleString()}</td><td><input className="rounded-md border border-slate-200 px-2 py-1" type="date" defaultValue={r.expectedProvideDate || ""} onBlur={(e) => e.target.value && updateRedemption(r.id, { status: r.status, expectedProvideDate: e.target.value })} /></td><td className="space-x-2"><Button variant="ghost" onClick={() => updateRedemption(r.id, { status: "APPROVED" })}>Approve</Button><Button onClick={() => updateRedemption(r.id, { status: "PROVIDED" })}>Provided</Button><Button variant="danger" onClick={() => updateRedemption(r.id, { status: "CANCELLED", adminNote: prompt("Cancel note") || "" })}>Cancel</Button></td></tr>)}</tbody></table></div> : <Empty />}</Section>
      </div>
    );
  }

  function SimpleTable({ title, rows = [], cols, renderCell }) {
    const columnLabel = (column) => {
      let text = column.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ");
      try {
        return formatTitleCase(text);
      } catch {
        return text.replace(/\b\w/g, (letter) => letter.toUpperCase());
      }
    };
    return <Section title={typeof title === 'string' ? formatTitleCase(title) : title}>{rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{cols.map((c) => <th className="p-3" key={c}>{columnLabel(c)}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr className={`border-t border-slate-100 ${i % 2 ? "bg-stone-50/70" : "bg-white"} hover:bg-slate-50`} key={row.id || i}>{cols.map((c) => <td className="p-3" key={c}>{renderCell ? renderCell(row, c) : String(row[c] ?? "")}</td>)}</tr>)}</tbody></table></div> : <Empty />}</Section>;
  }

  function AdminDealerSales({ data = {} }) {
    const rows = data.rows || [];
    const stats = data.stats || {};
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card label="Total Sold Units" value={stats.totalSoldUnits || 0} />
          <Card label="Products Sold" value={(stats.topProducts || []).length} />
          <Card label="Active Dealers" value={(stats.dealerPerformance || []).length} />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <MiniList title="Top selling products" rows={(stats.topProducts || []).map((row) => ({ ...row, productName: rowNameWithSku(row) }))} left="productName" right="quantitySold" />
          <MiniList title="Dealer sales performance" rows={stats.dealerPerformance || []} left="dealerName" right="quantitySold" />
        </div>
        <Section title="Dealer sales records">
          {rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{["Date", "Dealer", "Product + SKU", "Quantity", "Stock Before", "Stock After", "Remarks", "Created"].map((h) => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((sale) => <tr className="border-t border-slate-100" key={sale.id}><td className="p-3">{sale.saleDate}</td><td>{sale.Dealer?.dealerName || `Dealer #${sale.dealerId}`}</td><td><div className="flex items-center gap-2">{sale.Product?.image && <img src={fileUrl(sale.Product.image)} alt="" className="h-9 w-9 rounded-md object-cover" />}<span>{productNameWithSku(sale.Product, sale.ProductVariant || sale)}<span className="block text-xs text-slate-500">{sale.variantName ? `${sale.variantName} / ${sale.colorName || "-"}` : "Standard"}</span></span></div></td><td>{sale.quantitySold}</td><td>{sale.stockBefore}</td><td>{sale.stockAfter}</td><td>{sale.remarks || "-"}</td><td>{new Date(sale.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <Empty text="No dealer sales recorded yet" />}
        </Section>
      </div>
    );
  }

  function InternalUpdates({ data = {}, filter, setFilter, markRead, markAll, openChat }) {
    const rows = data.rows || [];
    const filterMap = { unread: (n) => !n.isRead, read: (n) => n.isRead, low_stock: (n) => n.type === "LOW_STOCK" };
    const visible = rows.filter(filterMap[filter] || (() => true));
    
    const handleNotificationClick = (n) => {
      if (n.title === "New Team Message" || n.title === "New Personal Message") {
        if (!n.isRead) markRead(n.id);
        if (openChat) openChat(n.metadata?.senderId || "common");
      }
    };
    
    return (
      <Section title="Internal Updates" actions={<Button variant="ghost" onClick={markAll}>Mark all as read</Button>}>
        <div className="mb-4 flex flex-wrap gap-2">{["all", "unread", "read", "low_stock"].map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-sm font-semibold ${filter === f ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>{f.replaceAll("_", " ")}</button>)}</div>
        {visible.length ? <div className="space-y-3">{visible.map((n) => <div key={n.id} onClick={() => handleNotificationClick(n)} className={`rounded-md border p-4 cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md ${n.type === "LOW_STOCK" ? "border-yellow-200 bg-yellow-50" : n.type === "PAYMENT" ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><NotificationBadge value={n.isRead ? "Read" : "Unread"} />{["LOW_STOCK", "PAYMENT", "SALES_UPDATE"].includes(n.type) && <NotificationBadge value={n.type} />}</div><p className="mt-2 font-semibold text-slate-900">{n.title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{n.message}</p><NotificationMeta notification={n} /><p className="mt-2 text-xs text-slate-500">{new Date(n.createdAt).toLocaleString()}</p></div>{!n.isRead && <Button variant="ghost" onClick={(e) => { e.stopPropagation(); markRead(n.id); }}>Mark read</Button>}</div></div>)}</div> : <Empty text="No internal updates found" />}
      </Section>
    );
  }

  function NotificationMeta({ notification }) {
    const meta = notification.metadata || {};
    const rows = [
      ["Product", meta.productName],
      ["Organization", meta.organizationName || meta.companyName],
      ["Dealer", meta.dealerName],
      ["Order", meta.orderNumber],
      ["Current Stock", meta.stockAfter],
      ["Low Stock Limit", meta.lowStockLimit]
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");
    if (!rows.length) return null;
    return <div className="mt-3 flex flex-wrap gap-2">{rows.map(([label, value]) => <span key={label} className="rounded-full border border-white/70 bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-700">{label}: {value}</span>)}</div>;
  }

  function NotificationBadge({ value }) {
    const tone = String(value || "").toUpperCase();
    const classes = tone === "CRITICAL" ? "border-red-200 bg-red-100 text-red-700" : tone === "HIGH" || tone === "LOW_STOCK" ? "border-yellow-200 bg-yellow-100 text-yellow-800" : tone === "UNREAD" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600";
    return <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${classes}`}>{String(value).replaceAll("_", " ")}</span>;
  }

  function InventoryBoard({ products = [], dealerStock = [] }) {
    const [selectedProduct, setSelectedProduct] = useState(null);
    const lowStock = products.filter((p) => Number(p.quantity) <= Number(p.lowStockLimit || 0));
    const topStock = [...products].sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0)).slice(0, 6);
    const totalStock = products.reduce((sum, product) => sum + Number(product.quantity || 0), 0);
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card label="Company Products" value={products.length} />
          <Card label="Company Stock" value={totalStock} />
          <Card label="Low Stock Products" value={lowStock.length} />
          <Card label="Dealer Stock Rows" value={dealerStock.length} />
        </div>
        <Section title="Company stock inventory" actions={<span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">Click any product for full details</span>}>
          {products.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{products.map((product) => {
            const qty = Number(product.quantity || 0);
            const limit = Number(product.lowStockLimit || 0);
            const stockStatus = qty === 0 ? "Out of Stock" : qty <= limit ? "Low Stock" : "In Stock";
            return (
              <button key={product.id} type="button" onClick={() => setSelectedProduct(product)} className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-card transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-card-hover">
                <div className="flex gap-4">
                  {product.image ? <img src={fileUrl(product.image)} alt={product.productName} className="h-20 w-24 rounded-xl object-cover" /> : <div className="grid h-20 w-24 place-items-center rounded-xl bg-slate-100 text-xs font-semibold text-slate-400">No image</div>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-950 group-hover:text-indigo-700">{productNameWithSku(product)}</p>
                    <p className="mt-1 truncate font-mono text-xs text-indigo-700">SKU: {product.sku || "-"}</p>
                    <p className="mt-1 text-xs text-slate-500">{product.category || "Uncategorized"}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge value={stockStatus} /><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{qty} in company stock</span></div>
                  </div>
                </div>
                {(product.variants || []).length > 0 && <p className="mt-3 line-clamp-2 text-xs text-slate-500">{product.variants.map((variant) => `${variant.variantName}/${variant.colorName}: ${fullVariantSku(product, variant)}`).join(", ")}</p>}
              </button>
            );
          })}</div> : <Empty text="No company stock products found" />}
        </Section>
        <div className="grid gap-6 xl:grid-cols-2">
          <Section title="Low stock attention">
            {lowStock.length ? <div className="space-y-3">{lowStock.map((p) => <StockHealth key={p.id} product={p} />)}</div> : <Empty text="No low stock products" />}
          </Section>
          <Section title="Top stock products">
            {topStock.length ? <div className="space-y-3">{topStock.map((p) => <StockHealth key={p.id} product={p} />)}</div> : <Empty />}
          </Section>
        </div>
        <SimpleTable title="Dealer-wise stock allocation" rows={dealerStock.map((s) => {
          const qty = Number(s.quantity || 0);
          const limit = Number(s.lowStockLimit || 0);
          return {
            dealer: s.Dealer?.dealerName || "Dealer",
            location: [s.Dealer?.area, s.Dealer?.city].filter(Boolean).join(", "),
            product: productNameWithSku(s.Product, s.ProductVariant || s),
            variant: s.variantName || "-",
            color: s.colorName || "-",
            quantity: qty,
            lowStockLimit: limit,
            status: qty === 0 ? "Out of Stock" : qty <= limit ? "Low Stock" : "In Stock"
          };
        })} cols={["dealer", "location", "product", "variant", "color", "quantity", "lowStockLimit", "status"]} />
        {selectedProduct && <ProductDetailsModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
      </div>
    );
  }

  function StockHealth({ product }) {
    const quantity = Number(product.quantity || 0);
    const limit = Number(product.lowStockLimit || 1);
    const percentage = Math.min(100, Math.round((quantity / Math.max(limit * 3, 1)) * 100));
    const low = quantity <= limit;
    return (
      <div className="rounded-md border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">{productNameWithSku(product)}</p>
            <p className="text-xs text-slate-500">Main SKU {product.sku || "-"} | Limit {limit}</p>
          </div>
          <StatusBadge value={low ? "low" : "active"} />
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${low ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${percentage}%` }} />
        </div>
        <p className="mt-2 text-sm font-semibold text-slate-700">{quantity} units available</p>
      </div>
    );
  }

  function PaginationControls({ page, setPage, totalPages, totalItems, pageSize }) {
    const start = totalItems ? (page - 1) * pageSize + 1 : 0;
    const end = Math.min(page * pageSize, totalItems);
    return <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-slate-500">Showing {start}-{end} of {totalItems}</p><div className="flex items-center gap-2"><Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">{page} / {totalPages}</span><Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button></div></div>;
  }

  function DeliveryManagement({ rows = [], updateOrder, filter = "all", setFilter, page = 1, setPage }) {
    const next = { approved: "packing", packing: "shipping", shipping: "out_for_delivery", out_for_delivery: "delivered" };
    const dealerTitle = (order) => `${order.Dealer?.dealerName || "Dealer"}${order.Dealer?.area || order.Dealer?.city ? ` - ${[order.Dealer?.area, order.Dealer?.city].filter(Boolean).join(", ")}` : ""}`;
    const products = (order) => order.items?.map(orderItemLabel).join(", ");
    const pageSize = 8;
    const filtered = rows.filter((order) => filter === "all" || order.status === filter);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    return (
      <Section title="Delivery management" actions={<div className="flex flex-wrap gap-2">{["all", "approved", "packing", "shipping", "out_for_delivery", "delivered"].map((status) => <button key={status} onClick={() => { setFilter(status); setPage(1); }} className={`rounded-full px-3 py-1 text-sm font-semibold ${filter === status ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>{status.replaceAll("_", " ")}</button>)}</div>}>
        {visible.length ? <><div className="grid gap-4 xl:grid-cols-2">{visible.map((order) => (
          <div key={order.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{dealerTitle(order)}</p>
                <p className="text-sm text-slate-500">{products(order)}</p>
                <p className="mt-1 text-xs text-slate-400">Reference: {order.orderNumber}</p>
              </div>
              <StatusBadge value={order.status} />
            </div>
            <DeliveryTimeline order={order} />
            <div className="mt-4 flex flex-wrap gap-2">
              {order.status === "delivered" ? <span className="rounded-md bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">Delivered</span> : <Button onClick={() => updateOrder(order.id, next[order.status])}>Mark as {next[order.status]?.replaceAll("_", " ")}</Button>}
            </div>
          </div>
        ))}</div><PaginationControls page={safePage} setPage={setPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} /></> : <Empty text="No deliveries match this filter" />}
      </Section>
    );
  }

  function AdminCeoReadOnlyOverview({ endpoint, type }) {
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(true);
    const load = (force = false) => {
      setLoading(true);
      return cachedGet(api, endpoint, {}, { force }).then(({ data }) => setPayload(data)).finally(() => setLoading(false));
    };
    useEffect(() => {
      let active = true;
      setLoading(true);
      cachedGet(api, endpoint).then(({ data }) => {
        if (active) setPayload(data);
      }).finally(() => {
        if (active) setLoading(false);
      });
      return () => { active = false; };
    }, [endpoint]);
    if (loading) return <Loading />;
    const controlDealer = async (dealer) => {
      const action = dealer.status === "active" ? "suspend" : "reactivate";
      if (!window.confirm(`${action === "suspend" ? "Suspend" : "Reactivate"} ${dealer.dealerName}?`)) return;
      await api.patch(`/admin-ceo/dealers/${dealer.id}/${action}`);
      await load(true);
    };
    const controlProduct = async (product) => {
      const action = product.status === "active" ? "disband" : "reactivate";
      if (!window.confirm(`${action === "disband" ? "Deactivate" : "Reactivate"} ${product.productName}?`)) return;
      await api.patch(`/admin-ceo/products/${product.id}/${action}`);
      await load(true);
    };
    const stats = payload?.stats || payload?.totals || {};
    const statRows = Object.entries(stats).filter(([, value]) => typeof value !== "object").slice(0, 8);
    const moneyKeys = ["revenue", "paidAmount", "unpaidAmount", "totalRevenue", "pendingPayment", "creditOutstanding", "outstandingBalance"];
    const statValue = (key, value) => moneyKeys.some((item) => key.toLowerCase().includes(item.toLowerCase())) ? formatMoney(value) : value;
    return (
      <div className="space-y-6">
        {!['dashboard', 'dealers', 'products', 'orders', 'delivery', 'finance', 'credit'].includes(type) && statRows.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statRows.map(([key, value]) => <Card key={key} label={key.replace(/([A-Z])/g, " $1")} value={statValue(key, value)} />)}
          </div>
        )}
        {type === "dashboard" && <AdminCeoAnalyticsDashboard payload={payload} />}
        {type === "dealers" && <AdminCeoDealersOverview payload={payload} onControlDealer={controlDealer} />}
        {type === "products" && <AdminCeoProductsOverview payload={payload} onControlProduct={controlProduct} />}
        {type === "orders" && <AdminCeoOrdersOverview payload={payload} />}
        {type === "delivery" && <AdminCeoDeliveryOverview payload={payload} />}
        {type === "finance" && <AdminCeoFinanceOverview payload={payload} />}
        {type === "credit" && <AdminCeoCreditOverview payload={payload} />}
      </div>
    );
  }

  function orderRow(order) {
    return {
      dealer: order.Dealer?.dealerName || "-",
      location: [order.Dealer?.area, order.Dealer?.city].filter(Boolean).join(", "),
      products: order.items?.map(orderItemLabel).join(", "),
      amount: formatMoney(order.totalAmount),
      status: order.status,
      orderDate: order.createdAt,
      deliveryDate: order.deliveryDate || "-"
    };
  }

  function AdminManagers() {
    const [rows, setRows] = useState([]);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "", role: "DEALER_MANAGER" });
    const [selectedManager, setSelectedManager] = useState(null);
    const [editingManager, setEditingManager] = useState(null);
    const load = (force = false) => cachedGet(api, "/admin-ceo/managers", {}, { force }).then(({ data }) => setRows(data));
    useEffect(() => { load(); }, []);
    const createManager = async (e) => {
      e.preventDefault();
      if (form.password !== form.confirmPassword) {
        return window.alert("Passwords do not match");
      }
      await api.post("/admin-ceo/managers", form);
      setForm({ name: "", email: "", phone: "", password: "", confirmPassword: "", role: "DEALER_MANAGER" });
      load(true);
    };
    const setStatus = async (id, status) => {
      await api.patch(`/admin-ceo/managers/${id}/status`, { status });
      load(true);
    };
    const editManager = async (manager) => {
      setEditingManager({ ...manager });
    };
    const saveEdit = async (e) => {
      e.preventDefault();
      try {
        await api.put(`/admin-ceo/managers/${editingManager.id}`, { name: editingManager.name, phone: editingManager.phone, role: editingManager.role });
        setEditingManager(null);
        load(true);
      } catch (err) {
        window.alert(err.response?.data?.message || "Failed to update manager");
      }
    };
    const removeManager = async (manager) => {
      if (!window.confirm(`Permanently delete ${manager.name} from the database? This action cannot be undone.`)) return;
      await api.delete(`/admin-ceo/managers/${manager.id}`);
      load(true);
    };
    return (
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Section title="Create Admin Manager">
          <FormGrid onSubmit={createManager}>
            <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <TextField label="Phone" type="tel" pattern="\d{10}" title="Phone must be exactly 10 digits" maxLength={10} minLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })} required />
            <TextField label="Password" type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required suffix={<button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-slate-600 focus:outline-none">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>} />
            <TextField label="Confirm Password" type={showConfirmPassword ? "text" : "password"} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} required suffix={<button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-slate-400 hover:text-slate-600 focus:outline-none">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>} />
            <label className="text-sm font-semibold text-slate-600">Role<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="DEALER_MANAGER">Dealer Manager</option><option value="PRODUCT_DELIVERY_MANAGER">Product Delivery Manager</option><option value="FINANCE_MANAGER">Finance Manager</option></select></label>
            <div className="md:col-span-2"><Button type="submit"><Plus size={16} /> Create Manager</Button></div>
          </FormGrid>
        </Section>
        <Section title="Organization Managers">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{["Name", "Role", "Status", "Actions"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="p-3"><button type="button" className="font-semibold text-indigo-700 hover:underline" onClick={() => setSelectedManager(row)}>{row.name}</button></td><td><StatusBadge value={row.role} /></td><td><button type="button" aria-label={`Set ${row.name} ${row.status === "active" ? "inactive" : "active"}`} onClick={() => setStatus(row.id, row.status === "active" ? "inactive" : "active")}><StatusBadge value={row.status} /></button></td><td><div className="flex flex-nowrap gap-2"><button type="button" title="Edit manager" aria-label={`Edit ${row.name}`} className="rounded-md border border-indigo-200 p-2 text-indigo-700 hover:bg-indigo-50" onClick={() => editManager(row)}><Pencil size={16} /></button><button type="button" title="Delete manager" aria-label={`Delete ${row.name}`} className="rounded-md border border-rose-200 p-2 text-rose-700 hover:bg-rose-50" onClick={() => removeManager(row)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table>
          </div>
        </Section>
        {selectedManager && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={() => setSelectedManager(null)}><div role="dialog" aria-modal="true" aria-labelledby="manager-details-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><h2 id="manager-details-title" className="text-xl font-bold text-slate-950">{selectedManager.name}</h2><p className="mt-1 text-sm text-slate-500">Complete Manager Details</p></div><button type="button" aria-label="Close manager details" className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => setSelectedManager(null)}><X size={18} /></button></div><dl className="mt-6 grid gap-4 sm:grid-cols-2">{[["Email", selectedManager.email], ["Phone", selectedManager.phone || "-"], ["Role", String(selectedManager.role || "-").replaceAll("_", " ")], ["Status", selectedManager.status], ["Created", formatDate(selectedManager.createdAt)]].map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold capitalize text-slate-900">{value}</dd></div>)}</dl></div></div>}
        {editingManager && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={() => setEditingManager(null)}><div role="dialog" aria-modal="true" aria-labelledby="manager-edit-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><h2 id="manager-edit-title" className="text-xl font-bold text-slate-950">Edit {editingManager.name}</h2><p className="mt-1 text-sm text-slate-500">Update Manager Details</p></div><button type="button" aria-label="Close edit manager" className="rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => setEditingManager(null)}><X size={18} /></button></div><form onSubmit={saveEdit} className="mt-6 space-y-4"><TextField label="Name" value={editingManager.name} onChange={(e) => setEditingManager({ ...editingManager, name: e.target.value })} required /><TextField label="Phone" type="tel" pattern="\d{10}" title="Phone must be exactly 10 digits" maxLength={10} minLength={10} value={editingManager.phone || ""} onChange={(e) => setEditingManager({ ...editingManager, phone: e.target.value.replace(/\D/g, '') })} required /><label className="text-sm font-semibold text-slate-600">Role<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={editingManager.role} onChange={(e) => setEditingManager({ ...editingManager, role: e.target.value })}><option value="DEALER_MANAGER">Dealer Manager</option><option value="PRODUCT_DELIVERY_MANAGER">Product Delivery Manager</option><option value="FINANCE_MANAGER">Finance Manager</option></select></label><div className="mt-6 flex justify-end gap-3"><Button type="button" variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-200" onClick={() => setEditingManager(null)}>Cancel</Button><Button type="submit">Save Changes</Button></div></form></div></div>}
      </div>
    );
  }

  function AdminTeamChat({ chatTarget }) {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const commonChat = { id: "common", name: "Common Team Chat", role: "all_members" };
    const [selected, setSelected] = useState(commonChat);
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");
    const [attachment, setAttachment] = useState(null);
    const [editingMsg, setEditingMsg] = useState(null);
    
    const loadMessages = () => { if (selected) api.get(`/admin-ceo/chat/${selected.id}`).then(({ data }) => setMessages(data)); };
    
    useEffect(() => { 
      api.get("/admin-ceo/chat/conversations").then(({ data }) => {
        const userList = [commonChat, ...data];
        setUsers(userList);
        if (chatTarget) {
          const target = userList.find(u => String(u.id) === String(chatTarget));
          if (target) setSelected(target);
        }
      }); 
    }, []);
    
    useEffect(() => {
      if (chatTarget && users.length) {
        const target = users.find(u => String(u.id) === String(chatTarget));
        if (target) setSelected(target);
      }
    }, [chatTarget]);

    useEffect(() => { loadMessages(); }, [selected]);

    const send = async (e) => {
      e.preventDefault();
      if (!selected || (!text.trim() && !attachment)) return;
      
      if (editingMsg) {
        await api.put(`/admin-ceo/chat/${editingMsg.id}`, { message: text.trim() });
        setEditingMsg(null);
      } else {
        const formData = new FormData();
        formData.append("receiverId", selected.id);
        if (text.trim()) formData.append("message", text.trim());
        if (attachment) formData.append("attachment", attachment);
        await api.post("/admin-ceo/chat/send", formData, { headers: { "Content-Type": "multipart/form-data" } });
      }
      setText("");
      setAttachment(null);
      loadMessages();
    };

    const removeMsg = async (id) => {
      if (!window.confirm("Delete this message?")) return;
      await api.delete(`/admin-ceo/chat/${id}`);
      loadMessages();
    };
    
    const isImage = (url) => url && /\.(jpg|jpeg|png|gif|webp)$/i.test(url);

    return (
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Section title="Team members">
          <div className="space-y-2">
            {users.map((u) => <button key={u.id} onClick={() => { setSelected(u); setEditingMsg(null); setText(""); setAttachment(null); }} className={`w-full rounded-xl border px-3 py-3 text-left text-sm transition ${selected?.id === u.id ? "border-indigo-200 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white hover:border-indigo-100 hover:bg-slate-50"}`}><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-sm font-bold text-white">{(u.name || "?").slice(0, 1).toUpperCase()}</span><span className="min-w-0"><span className="block truncate font-semibold text-slate-900">{u.name}</span><span className="block truncate text-xs text-slate-500">{u.role.replaceAll("_", " ")}</span></span></span></button>)}
          </div>
        </Section>
        <Section title={selected ? (selected.id === "common" ? "Common Team Chat" : `Internal team chat - ${selected.name}`) : "Internal team chat"}>
          {selected ? (
            <>
              <div className="mb-4 h-[28rem] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
                {messages.length ? messages.map((m) => {
                  const mine = Number(m.senderId) === Number(user?.id);
                  return (
                    <div key={m.id} className={`flex group ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`relative max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${mine ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-800"}`}>
                        {mine && (
                          <div className="absolute -left-16 top-2 hidden group-hover:flex gap-1 bg-white p-1 rounded-md shadow-sm border border-slate-100">
                            <button onClick={() => { setEditingMsg(m); setText(m.message); setAttachment(null); }} className="text-slate-400 hover:text-indigo-600 p-1"><Pencil size={14} /></button>
                            <button onClick={() => removeMsg(m.id)} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 size={14} /></button>
                          </div>
                        )}
                        <p className={`mb-1 text-xs font-bold ${mine ? "text-indigo-100" : "text-slate-500"}`}>{mine ? "You" : m.sender?.name || "Team member"}</p>
                        <p className="leading-6 whitespace-pre-wrap">{m.message}</p>
                        {m.attachmentUrl && (
                          <div className="mt-2">
                            {isImage(m.attachmentUrl) ? (
                              <a href={fileUrl(m.attachmentUrl)} target="_blank" rel="noreferrer"><img src={fileUrl(m.attachmentUrl)} alt={m.attachmentName} className="max-w-full rounded-lg shadow-sm border border-slate-200/50 max-h-48 object-contain" /></a>
                            ) : (
                              <a href={fileUrl(m.attachmentUrl)} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium underline ${mine ? "bg-indigo-700 text-indigo-50" : "bg-slate-50 text-slate-700"}`}><Paperclip size={14} /> {m.attachmentName || "Attachment"}</a>
                            )}
                          </div>
                        )}
                        <div className={`mt-2 flex justify-between items-center text-[11px] ${mine ? "text-indigo-100" : "text-slate-400"}`}>
                          <span>{new Date(m.createdAt).toLocaleString()}</span>
                          {m.isEdited && <span className="italic ml-2">(edited)</span>}
                        </div>
                      </div>
                    </div>
                  );
                }) : <Empty text="No messages yet. Start the conversation." />}
              </div>
              <form onSubmit={send} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                {attachment && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg text-xs font-medium text-slate-700">
                    <Paperclip size={14} /> {attachment.name}
                    <button type="button" onClick={() => setAttachment(null)} className="ml-auto text-slate-400 hover:text-rose-500"><X size={14} /></button>
                  </div>
                )}
                {editingMsg && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-lg text-xs font-medium text-amber-700 border border-amber-100">
                    <span>Editing message</span>
                    <button type="button" onClick={() => { setEditingMsg(null); setText(""); }} className="ml-auto text-amber-500 hover:text-amber-700"><X size={14} /></button>
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition">
                    <Paperclip size={18} />
                    <input type="file" className="hidden" onChange={(e) => setAttachment(e.target.files[0])} disabled={!!editingMsg} />
                  </label>
                  <input className="flex-1 rounded-xl border-0 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-100 bg-slate-50" value={text} onChange={(e) => setText(e.target.value)} placeholder={editingMsg ? "Edit message..." : `Message ${selected.id === "common" ? "everyone" : selected.name}`} required={!attachment} />
                  <Button type="submit">{editingMsg ? "Save" : "Send"}</Button>
                </div>
              </form>
            </>
          ) : <Empty text="Select a team member to open chat" />}
        </Section>
      </div>
    );
  }

  function OrderTable({ rows, updateOrder, approveOrder, schedules, setSchedules, filter = "all", setFilter, page = 1, setPage }) {
    const setSchedule = (id, key, value) => setSchedules({ ...schedules, [id]: { ...(schedules[id] || {}), [key]: value } });
    const dealerTitle = (order) => `${order.Dealer?.dealerName || "Dealer"}${order.Dealer?.area || order.Dealer?.city ? ` - ${[order.Dealer?.area, order.Dealer?.city].filter(Boolean).join(", ")}` : ""}`;
    const pageSize = 10;
    const filtered = rows.filter((order) => filter === "all" || order.status === filter);
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    return <Section title="Order & delivery management" actions={<div className="flex flex-wrap gap-2">{["all", "pending", "approved", "packing", "shipping", "out_for_delivery", "delivered", "rejected"].map((status) => <button key={status} onClick={() => { setFilter(status); setPage(1); }} className={`rounded-full px-3 py-1 text-sm font-semibold ${filter === status ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>{status.replaceAll("_", " ")}</button>)}</div>}>{visible.length ? <><div className="space-y-4">{visible.map((o) => {
      const schedule = schedules[o.id] || {};
      const ready = schedule.packingDate && schedule.shippingDate && schedule.outForDeliveryDate && schedule.deliveredDate;
      return <div key={o.id} className="rounded-md border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{dealerTitle(o)} · {formatMoney(o.totalAmount)}</p><p className="text-sm text-slate-500">Order Date: {new Date(o.createdAt).toLocaleDateString()} · {o.status}</p><p className="mt-1 text-xs text-slate-400">Reference: {o.orderNumber}</p></div><div className="flex flex-wrap gap-2">{o.status === "pending" ? <><Button disabled={!ready} onClick={() => approveOrder(o.id)}>Approve Order</Button><Button variant="ghost" onClick={() => updateOrder(o.id, "rejected")}>Reject</Button></> : <StatusBadge value={o.status} />}</div></div><div className="mt-3 text-sm font-semibold text-slate-700">{o.items?.map(orderItemLabel).join(", ")}</div>{o.status === "pending" && <div className="mt-4 grid gap-3 md:grid-cols-4">{["packingDate", "shippingDate", "outForDeliveryDate", "deliveredDate"].map((key) => <TextField key={key} label={key.replace(/([A-Z])/g, " $1")} type="date" value={schedule[key] || ""} onChange={(e) => setSchedule(o.id, key, e.target.value)} />)}</div>}{o.status === "approved" && <div className="mt-4 rounded-md bg-green-50 p-3 text-sm font-semibold text-green-700">Approved. Invoice generated automatically. Continue delivery updates in Delivery.</div>}<div className="mt-4 grid gap-2 md:grid-cols-4">{["packingDate", "shippingDate", "outForDeliveryDate", "deliveredDate"].map((key) => o[key] && <div key={key} className="rounded-md bg-slate-50 p-2 text-xs"><span className="font-semibold">{key.replace(/([A-Z])/g, " $1")}:</span> {o[key]}</div>)}</div></div>;
    })}</div><PaginationControls page={safePage} setPage={setPage} totalPages={totalPages} totalItems={filtered.length} pageSize={pageSize} /></> : <Empty text="No orders match this filter" />}</Section>;
  }

  function FinanceTable({ rows = [], dealers = [], filter, setFilter, sendReminder }) {
    const [methodFilter, setMethodFilter] = useState("all");
    const [dealerFilter, setDealerFilter] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState(null);
    const dealerName = (id) => dealers.find((d) => d.id === id)?.dealerName || `Dealer #${id}`;
    const pageSize = 10;
    const visible = rows.filter((payment) => {
      const statusMatch = filter === "all" || (filter === "unpaid" ? payment.paymentStatus === "pending" : filter === "paid" ? payment.paymentStatus === "paid" : payment.paymentStatus === filter);
      const methodMatch = methodFilter === "all" || payment.paymentMethod === methodFilter;
      const dealerMatch = !dealerFilter || String(payment.dealerId) === String(dealerFilter);
      const haystack = `${payment.invoiceNumber || ""} ${payment.Order?.orderNumber || payment.orderNumber || ""} ${payment.Dealer?.dealerName || dealerName(payment.dealerId)} ${payment.Order?.items?.map(orderItemLabel).join(" ") || payment.productSummary || ""}`.toLowerCase();
      return statusMatch && methodMatch && dealerMatch && haystack.includes(search.toLowerCase());
    });
    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageRows = visible.slice((safePage - 1) * pageSize, safePage * pageSize);
    const resetPage = (fn) => (value) => { fn(value); setPage(1); };
    const actions = (
      <div className="flex flex-wrap gap-2">
        <input className="rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Search invoice, dealer, SKU" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={dealerFilter} onChange={(e) => resetPage(setDealerFilter)(e.target.value)}>
          <option value="">All dealers</option>
          {dealers.map((dealer) => <option key={dealer.id} value={dealer.id}>{dealer.dealerName}</option>)}
        </select>
        <select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={methodFilter} onChange={(e) => resetPage(setMethodFilter)(e.target.value)}>
          <option value="all">All methods</option>
          <option value="cash">Cash</option>
          <option value="online">Online</option>
        </select>
      </div>
    );
    return (
      <>
        <Section title="Dealer-wise payment list" actions={actions}>
          <div className="mb-4 flex flex-wrap gap-2">{["all", "unpaid", "paid"].map((tab) => <button key={tab} onClick={() => { setFilter(tab); setPage(1); }} className={`rounded-full px-3 py-1 text-sm font-semibold ${filter === tab ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>{tab}</button>)}</div>
          {pageRows.length ? <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500"><tr>{["Dealer", "Invoice", "Amount", "Status", "Method", "Due / Paid", "Action"].map((h) => <th className="px-4 py-3" key={h}>{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{pageRows.map((payment) => (
                  <tr key={payment.id} className="align-top transition hover:bg-slate-50">
                    <td className="px-4 py-3"><p className="font-semibold text-slate-900">{payment.Dealer?.dealerName || dealerName(payment.dealerId)}</p><p className="text-xs text-slate-500">{[payment.Dealer?.area, payment.Dealer?.city].filter(Boolean).join(", ") || "-"}</p></td>
                    <td className="px-4 py-3"><button type="button" onClick={() => setSelected(payment)} className="font-mono text-xs font-bold text-indigo-700 hover:underline">{payment.invoiceNumber || `INV-${payment.id}`}</button><p className="mt-1 text-xs text-slate-500">Order {payment.Order?.orderNumber || payment.orderNumber || payment.orderId}</p></td>
                    <td className="px-4 py-3 font-bold text-slate-950">{formatMoney(payment.amount)}</td>
                    <td className="px-4 py-3"><PaymentBadge value={payment.paymentStatus} /></td>
                    <td className="px-4 py-3"><PaymentBadge value={payment.paymentMethod || "not selected"} /></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{payment.paymentStatus === "paid" ? (payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : "Paid") : `${payment.daysUnpaid || 0} days unpaid`}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-2"><Button className="min-h-9 px-3 py-1.5 text-xs" variant="soft" onClick={() => setSelected(payment)}>View invoice</Button>{payment.paymentStatus === "pending" && <Button className="min-h-9 px-3 py-1.5 text-xs" variant="ghost" onClick={() => sendReminder(payment.id)}>Reminder</Button>}</div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <PaginationControls page={safePage} setPage={setPage} totalPages={totalPages} totalItems={visible.length} pageSize={pageSize} />
          </> : <Empty text="No payment invoices match these filters" />}
        </Section>
        {selected && <InvoiceDetailsModal payment={selected} dealerName={dealerName} sendReminder={sendReminder} onClose={() => setSelected(null)} />}
      </>
    );
  }

  function InvoiceDetailsModal({ payment, dealerName, sendReminder, onClose }) {
    const items = payment.Order?.items || [];
    const detailRows = [
      ["Invoice", payment.invoiceNumber || `INV-${payment.id}`],
      ["Dealer", payment.Dealer?.dealerName || dealerName(payment.dealerId)],
      ["Order", payment.Order?.orderNumber || payment.orderNumber || payment.orderId],
      ["Amount", formatMoney(payment.amount)],
      ["Payment Status", payment.paymentStatus],
      ["Payment Method", payment.paymentMethod || "-"],
      ["Approved", payment.orderApprovedAt ? new Date(payment.orderApprovedAt).toLocaleString() : "-"],
      ["Days Unpaid", payment.daysUnpaid || 0],
      ["Paid At", payment.paidAt ? new Date(payment.paidAt).toLocaleString() : "-"],
      ["Transaction", payment.transactionId || "-"]
    ];
    return (
      <ProductModalShell title={`Invoice ${payment.invoiceNumber || `INV-${payment.id}`}`} onClose={onClose} footer={<>{payment.invoiceFile && <a className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-indigo-700" href={fileUrl(payment.invoiceFile)} target="_blank">Open invoice file</a>}{payment.paymentStatus === "pending" && <Button variant="ghost" onClick={() => sendReminder(payment.id)}>Send Reminder</Button>}<Button onClick={onClose}>Close</Button></>}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {detailRows.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words font-semibold text-slate-950">{value}</p></div>)}
        </div>
        <div className="mt-5 rounded-xl border border-slate-200">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3 font-bold text-slate-900">Products in this invoice</div>
          {items.length ? <div className="divide-y divide-slate-100">{items.map((item) => {
            const variant = item.ProductVariant || item;
            return (
              <div key={item.id || `${item.productId}-${item.productVariantId}`} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto]">
                <div><p className="font-bold text-slate-950">{productNameWithSku(item.Product, variant)}</p><p className="text-xs text-slate-500">{item.variantName ? `${item.variantName} / ${item.colorName || "-"}` : "Standard"} {item.Product?.category ? `| ${item.Product.category}` : ""}</p></div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 font-semibold text-slate-700">Quantity: {item.quantity}</div>
                <div className="rounded-lg bg-indigo-50 px-3 py-2 font-semibold text-indigo-700">{formatMoney(item.lineTotal || item.total || Number(item.price || item.unitPrice || 0) * Number(item.quantity || 0))}</div>
              </div>
            );
          })}</div> : <div className="p-4 text-sm text-slate-600">{payment.productSummary || "No product details available for this invoice."}</div>}
        </div>
      </ProductModalShell>
    );
  }

  function AdminChat({ data = {}, form, setForm, sendMessage }) {
    const dealers = data.dealers || [];
    const messages = data.messages || [];
    const selected = form.dealerId || "";
    const visible = messages.filter((m) => selected ? String(m.dealerId) === String(selected) : m.conversationId?.endsWith("-all"));
    return <div className="grid gap-4 lg:grid-cols-[280px_1fr]"><Section title="Dealers"><button onClick={() => setForm({ ...form, dealerId: "" })} className={`mb-2 w-full rounded-md px-3 py-2 text-left text-sm ${selected === "" ? "bg-cyan-50 text-brand" : "hover:bg-slate-50"}`}>All Dealers</button>{dealers.map((d) => { const latest = messages.filter((m) => m.dealerId === d.id).at(-1); return <button key={d.id} onClick={() => setForm({ ...form, dealerId: String(d.id) })} className={`mb-2 w-full rounded-md px-3 py-2 text-left text-sm ${String(selected) === String(d.id) ? "bg-cyan-50 text-brand" : "hover:bg-slate-50"}`}><span className="block font-semibold">{d.dealerName}</span><span className="block truncate text-xs text-slate-500">{latest?.message || "No messages yet"}</span></button>; })}</Section><Section title="Chat window"><div className="mb-4 h-80 space-y-3 overflow-y-auto rounded-md bg-slate-50 p-4">{visible.length ? visible.map((m) => <div key={m.id} className={`flex ${m.sender?.role === "ADMIN" ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-md px-3 py-2 text-sm ${m.sender?.role === "ADMIN" ? "bg-brand text-white" : "bg-white border border-slate-200"}`}><p>{m.message}</p><p className="mt-1 text-[11px] opacity-75">{new Date(m.createdAt).toLocaleString()}</p></div></div>) : <Empty text="No messages in this conversation" />}</div><form onSubmit={(e) => { e.preventDefault(); sendMessage({ ...form, dealerId: form.dealerId || null, title: "Message" }); }} className="flex gap-2"><input className="flex-1 rounded-md border border-slate-300 px-3 py-2" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Type a message" required /><Button>Send</Button></form></Section></div>;
  }

  function Composer({ title, form, setForm, submit, rows, cols }) {
    return <><Section title={title}><FormGrid onSubmit={(e) => { e.preventDefault(); submit(); }}>{Object.keys(form).map((k) => <TextField key={k} label={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />)}<div className="md:col-span-2"><Button type="submit">Save</Button></div></FormGrid></Section><SimpleTable title={`${title} list`} rows={rows} cols={cols} /></>;
  }



  