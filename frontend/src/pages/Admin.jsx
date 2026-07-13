import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Gift, IndianRupee, PackageCheck, Star, Truck, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Layout from "../components/Layout";
import { api, fileUrl } from "../api/client";
import { Button, Card, DeliveryTimeline, Empty, FileUploadPreview, FormGrid, formatDate, formatMoney, Loading, PageHeader, PaymentBadge, Plus, Section, StatusBadge, TextField } from "../components/UI";
import { useAuth } from "../state/AuthContext";
import { consumeProfileTargetTab, roleTabs } from "../utils/profileNavigation";

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
  { id: "licenseUpgrade", label: "License Status / Upgrade", icon: "credits" },
  { id: "dealerSales", label: "Dealer Sales", icon: "reports" },
  { id: "messages", label: "Messages", icon: "messages" },
  { id: "internalUpdates", label: "Internal Updates", icon: "internalUpdates" },
  { id: "policies", label: "Policies", icon: "policies" },
  { id: "reports", label: "Reports", icon: "reports" }
];

export default function Admin() {
  const { user } = useAuth();
  const currentTabs = roleTabs[user?.role] || tabs;
  const [activeTab, setActiveTab] = useState(() => consumeProfileTargetTab("dashboard", currentTabs));
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dealerForm, setDealerForm] = useState({ dealerName: "", ownerName: "", email: "", password: "dealer123", phone: "", area: "", city: "", state: "", pincode: "", address: "" });
  const [productForm, setProductForm] = useState({ productName: "", sku: "", category: "", description: "", price: 0, quantity: 0, lowStockLimit: 10, creditCoins: 0, status: "active" });
  const [variantRows, setVariantRows] = useState([{ variantName: "Standard", colorName: "Default", stockQuantity: 0, priceOverride: "", skuSuffix: "", status: "active" }]);
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

  const load = async () => {
    setLoading(true);
    setLoadError("");
    const shared = ["dashboard", "dashboard/analytics", "company", "policies", "messages", "messages/conversations"];
    const endpointByRole = {
      DEALER_MANAGER: [...shared, "dealers", "reports", "dealer-sales", "dealer-performance", "license-status"],
      PRODUCT_DELIVERY_MANAGER: [...shared, "products", "orders", "stock/dealers"],
      FINANCE_MANAGER: [...shared, "payments", "finance/approved-orders", "finance/payments", "credit/summary", "credit/dealer-wallets"]
    };
    const endpoints = endpointByRole[user?.role] || [...shared, "dealers", "products", "orders", "payments", "reports", "stock/dealers", "dealer-sales", "finance/approved-orders", "finance/payments", "dealer-performance", "credit/summary", "credit/rewards", "credit/redemptions", "credit/dealer-wallets", "license-status"];
    const result = await Promise.allSettled([
      ...endpoints.map((e) => api.get(`/admin/${e}`)),
      api.get("/internal-updates")
    ]);
    const payload = {};
    endpoints.forEach((e, i) => {
      payload[e.replace("/", "_")] = result[i].status === "fulfilled" ? result[i].value.data : [];
    });
    payload.internalUpdates = result.at(-1).status === "fulfilled" ? result.at(-1).value.data : { updates: [], unreadCount: 0 };
    setData(payload);
    const failedCount = result.filter((entry) => entry.status === "rejected").length;
    if (failedCount) {
      const forbiddenCount = result.filter((entry) => entry.status === "rejected" && entry.reason?.response?.status === 403).length;
      setLoadError(forbiddenCount
        ? "You do not have access to one or more dashboard sections. Authorized information is still shown below."
        : `${failedCount} dashboard ${failedCount === 1 ? "section" : "sections"} could not be loaded. Available information is still shown below.`);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

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
      load();
    } catch (error) {
      const message = error.response?.data?.message || "Unable to save. Please check the form.";
      setDealerError(message);
      if (error.response?.data?.code === "LICENSE_LIMIT_REACHED") setActiveTab("licenseUpgrade");
      alert(message);
    }
  };

  const requestLicense = async (licensePlanId) => {
    try {
      await api.post("/admin/license-requests", { licensePlanId, quantity: 1 });
      alert("Your license request has been sent to the sales team.");
      load();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to request license");
    }
  };

  const updateOrder = async (id, status) => {
    const rejectionReason = status === "rejected" ? prompt("Reason for rejection") : "";
    await api.patch(`/admin/orders/${id}/status`, { status, rejectionReason, message: status.replaceAll("_", " ") });
    load();
  };

  const approveOrder = async (orderId) => {
    const schedule = schedules[orderId] || {};
    if (!schedule.packingDate || !schedule.shippingDate || !schedule.outForDeliveryDate || !schedule.deliveredDate) {
      alert("Select all delivery timeline dates before approval.");
      return;
    }
    await api.post(`/admin/orders/${orderId}/approve-with-schedule`, schedule);
    load();
  };

  const createProduct = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    Object.entries(productForm).forEach(([key, value]) => formData.append(key, value));
    formData.append("variants", JSON.stringify(variantRows));
    if (productImage) formData.append("image", productImage);
    await api.post("/admin/products", formData, { headers: { "Content-Type": "multipart/form-data" } });
    setProductForm({ ...productForm, productName: "", sku: "", quantity: 0 });
    setVariantRows([{ variantName: "Standard", colorName: "Default", stockQuantity: 0, priceOverride: "", skuSuffix: "", status: "active" }]);
    setProductImage(null);
    setProductPreview("");
    load();
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
    load();
  };

  const updateRedemption = async (id, patch) => {
    await api.patch(`/admin/credit/redemptions/${id}/status`, patch);
    load();
  };

  const sendPaymentRequest = async (orderId) => {
    const formData = new FormData();
    if (invoiceFiles[orderId]) formData.append("invoice", invoiceFiles[orderId]);
    await api.post(`/admin/finance/send-payment-request/${orderId}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
    setInvoiceFiles({ ...invoiceFiles, [orderId]: null });
    load();
  };

  const sendPaymentReminder = async (paymentId) => {
    await api.post(`/admin/finance/reminder/${paymentId}`);
    alert("Payment reminder sent");
    load();
  };

  const quickEditProduct = async (product) => {
    const productName = prompt("Product name", product.productName);
    if (productName == null) return;
    const price = prompt("Price", product.price);
    if (price == null) return;
    const creditCoins = prompt("Credit Coins per Unit", product.creditCoins || 0);
    if (creditCoins == null) return;
    await api.put(`/admin/products/${product.id}`, { productName, price, creditCoins, sku: product.sku, category: product.category, description: product.description, status: product.status });
    load();
  };

  const deleteProduct = async (product) => {
    if (!confirm(`Delete or deactivate ${product.productName}?`)) return;
    await api.delete(`/admin/products/${product.id}`);
    load();
  };

  const sendMessage = async (messageFormOverride) => {
    await api.post("/admin/messages/send", messageFormOverride);
    setMessageForm({ title: "", message: "", dealerId: "" });
    load();
  };

  const markUpdateRead = async (id) => {
    await api.patch(`/internal-updates/${id}/read`);
    load();
  };

  const markAllUpdatesRead = async () => {
    await api.patch("/internal-updates/read-all");
    load();
  };

  if (loading) return <Layout title="Company Admin" subtitle="Company operations workspace" tabs={currentTabs} activeTab={activeTab} onTab={setActiveTab}><Loading /></Layout>;

  const dashboardCards = [
    ["Total Dealers", data.dashboard.totalDealers], ["Products", data.dashboard.totalProducts], ["Company Stock", data.dashboard.totalCompanyStock],
    ["Low Stock", data.dashboard.lowStockProducts], ["Pending Orders", data.dashboard.pendingOrders], ["Delivered Orders", data.dashboard.deliveredOrders],
    ["Pending Payments", data.dashboard.pendingPayments], ["Revenue", formatMoney(data.dashboard.totalRevenue)]
  ];

  return (
    <Layout title="Company Admin" subtitle={`${data.company?.companyName || "Company"} control center`} tabs={currentTabs} activeTab={activeTab} onTab={setActiveTab}>
      <PageHeader
        eyebrow={String(user?.role || "Organization").replaceAll("_", " ")}
        title={currentTabs.find((tab) => tab.id === activeTab)?.label || "Dashboard"}
        description="Monitor organization operations, dealer performance, stock, orders, delivery and finance from one workspace."
      />
      {loadError && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 shadow-sm"><span>{loadError}</span><Button variant="ghost" onClick={load}>Retry</Button></div>}
      {activeTab === "dashboard" && (user?.role === "ADMIN_CEO" ? <AdminCeoReadOnlyOverview endpoint="/admin-ceo/dashboard" type="dashboard" /> : <AdminAnalytics analytics={data.dashboard_analytics} fallbackCards={dashboardCards} />)}
      {activeTab === "adminManagers" && <AdminManagers />}
      {activeTab === "adminChat" && <AdminTeamChat />}
      {activeTab === "adminPinned" && ["ADMIN", "ADMIN_CEO"].includes(user?.role) && <AdminPinnedMessages />}
      {activeTab === "dealersOverview" && <AdminCeoReadOnlyOverview endpoint="/admin-ceo/dealers-overview" type="dealers" />}
      {activeTab === "licenseOverview" && <AdminCeoReadOnlyOverview endpoint="/admin-ceo/license-overview" type="license" />}
      {activeTab === "productOverview" && <AdminCeoReadOnlyOverview endpoint="/admin-ceo/product-overview" type="products" />}
      {activeTab === "orderOverview" && <AdminCeoReadOnlyOverview endpoint="/admin-ceo/order-overview" type="orders" />}
      {activeTab === "deliveryOverview" && <AdminCeoReadOnlyOverview endpoint="/admin-ceo/delivery-overview" type="delivery" />}
      {activeTab === "financeOverview" && <AdminCeoReadOnlyOverview endpoint="/admin-ceo/finance-overview" type="finance" />}
      {activeTab === "creditOverview" && <AdminCeoReadOnlyOverview endpoint="/admin-ceo/credit-overview" type="credit" />}
      {activeTab === "managerPerformance" && <AdminCeoReadOnlyOverview endpoint="/admin-ceo/manager-performance" type="managers" />}
      {activeTab === "transferApprovals" && <AdminCeoTransferApprovals />}
      {activeTab === "transferHistory" && <AdminCeoTransferHistory />}
      {activeTab === "interDealerRequests" && <InterDealerRequests />}
      {activeTab === "dealerPerformance" && <DealerPerformancePanel data={data["dealer-performance"]} filters={performanceFilter} setFilters={setPerformanceFilter} reload={loadDealerPerformance} products={data.products || []} />}
      {activeTab === "dealers" && (
        <>
          <Section title="Create dealer">
            {dealerError && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{dealerError}</div>}
            <FormGrid onSubmit={(e) => { e.preventDefault(); create("/admin/dealers", dealerForm, () => setDealerForm({ ...dealerForm, dealerName: "", ownerName: "", email: "", pincode: "" })); }}>
              {Object.keys(dealerForm).map((k) => <TextField key={k} label={k.replace(/([A-Z])/g, " $1")} value={dealerForm[k]} onChange={(e) => setDealerForm({ ...dealerForm, [k]: e.target.value })} required={["dealerName", "ownerName", "email", "password"].includes(k)} />)}
              <div className="md:col-span-2"><Button type="submit"><Plus size={16} /> Create Dealer</Button></div>
            </FormGrid>
          </Section>
          <SimpleTable title="Area-wise dealer list" rows={data.dealers} cols={["dealerName", "ownerName", "email", "area", "city", "pincode", "status"]} />
        </>
      )}
      {activeTab === "licenseUpgrade" && (
        <LicenseUpgrade status={data["license-status"]} requestLicense={requestLicense} />
      )}
      {activeTab === "products" && (
        <>
          <Section title="Upload product and stock">
            <FormGrid onSubmit={createProduct}>
              {Object.keys(productForm).map((k) => <TextField key={k} label={k.replace(/([A-Z])/g, " $1")} value={productForm[k]} onChange={(e) => setProductForm({ ...productForm, [k]: e.target.value })} type={["price", "quantity", "lowStockLimit", "creditCoins"].includes(k) ? "number" : "text"} min={["quantity", "lowStockLimit", "creditCoins"].includes(k) ? "0" : undefined} />)}
              <FileUploadPreview label="Product photo" preview={productPreview} accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; setProductImage(file || null); setProductPreview(file ? URL.createObjectURL(file) : ""); }} />
              <div className="md:col-span-2">
                <VariantEditor rows={variantRows} setRows={setVariantRows} />
              </div>
              <div className="md:col-span-2"><Button type="submit"><Plus size={16} /> Add Product</Button></div>
            </FormGrid>
          </Section>
          <ProductTable rows={(data.products || []).map((p) => ({ ...p, quantity: p.CompanyInventory?.quantity || 0, lowStockLimit: p.CompanyInventory?.lowStockLimit || 0 }))} onEdit={quickEditProduct} onDelete={deleteProduct} />
          <SimpleTable title="Dealer-wise stock" rows={(data.stock_dealers || []).map((s) => ({ dealer: s.Dealer?.dealerName || "Dealer", location: [s.Dealer?.area, s.Dealer?.city].filter(Boolean).join(", "), product: s.Product?.productName, variant: s.variantName || "-", color: s.colorName || "-", quantity: s.quantity, lowStockLimit: s.lowStockLimit }))} cols={["dealer", "location", "product", "variant", "color", "quantity", "lowStockLimit"]} />
        </>
      )}
      {activeTab === "inventory" && <InventoryBoard products={(data.products || []).map((p) => ({ ...p, quantity: p.CompanyInventory?.quantity || 0, lowStockLimit: p.CompanyInventory?.lowStockLimit || 0 }))} dealerStock={data.stock_dealers || []} />}
      {activeTab === "orders" && <OrderTable rows={data.orders || []} updateOrder={updateOrder} approveOrder={approveOrder} schedules={schedules} setSchedules={setSchedules} />}
      {activeTab === "delivery" && <DeliveryManagement rows={(data.orders || []).filter((o) => ["approved", "packing", "shipping", "out_for_delivery", "delivered"].includes(o.status))} updateOrder={updateOrder} />}
      {activeTab === "finance" && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FinanceMetric label="Pending Payments" value={data.finance_payments?.stats?.pendingPayments || 0} tone="pending" />
            <FinanceMetric label="Paid Payments" value={data.finance_payments?.stats?.paidPayments || 0} tone="paid" />
            <FinanceMetric label="Cash Payments" value={data.finance_payments?.stats?.cashPayments || 0} tone="cash" />
            <FinanceMetric label="Online Payments" value={data.finance_payments?.stats?.onlinePayments || 0} tone="online" />
            <Card label="Total Pending" value={formatMoney(data.finance_payments?.stats?.totalPendingAmount || 0)} />
            <Card label="Total Paid" value={formatMoney(data.finance_payments?.stats?.totalPaidAmount || 0)} />
          </div>
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
      {activeTab === "internalUpdates" && <InternalUpdates data={data.internalUpdates} filter={internalFilter} setFilter={setInternalFilter} markRead={markUpdateRead} markAll={markAllUpdatesRead} />}
      {activeTab === "reports" && <SimpleTable title="Dealer reports and updates" rows={data.reports} cols={["title", "type", "description", "dealerId", "createdAt"]} />}
    </Layout>
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
        <MiniList title="Top 5 highest stock products" rows={analytics.inventoryStats.topHighestStockProducts} left="productName" right="quantity" />
        <MiniList title="Top 5 low stock products" rows={analytics.inventoryStats.topLowStockProducts} left="productName" right="quantity" />
        <MiniList title="Dealer-wise outstanding payment" rows={analytics.financeStats.dealerWiseOutstandingPayment} left="dealerName" right="amount" prefix="Rs " />
        <MiniList title="Area-wise dealer count" rows={analytics.dealerStats.areaWiseDealerCount} left="area" right="count" />
        <MiniList title="Top selling products" rows={analytics.salesStats?.topSellingProducts || []} left="productName" right="quantitySold" />
        <MiniList title="Dealer sales performance" rows={analytics.salesStats?.dealerSalesPerformance || []} left="dealerName" right="quantitySold" />
      </div>
      <Section title="Dealer stock summary"><div className="h-72"><ResponsiveContainer><BarChart data={analytics.inventoryStats.dealerWiseStockSummary}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dealerName" /><YAxis /><Tooltip /><Bar dataKey="quantity" fill="#0E7490" /></BarChart></ResponsiveContainer></div></Section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Recent title="Recent orders" rows={analytics.recentOrders} primary={(row) => row.orderNumber} secondary={(row) => `${row.status} | ${formatMoney(row.totalAmount)}`} />
        <Recent title="Recent payments" rows={analytics.recentPayments} primary={(row) => row.Dealer?.dealerName || row.invoiceNumber || "Payment"} secondary={(row) => `${row.productSummary || row.Order?.items?.map((i) => `${i.Product?.productName} x ${i.quantity}`).join(", ") || row.paymentStatus} | ${formatMoney(row.amount)}`} />
        <Recent title="Recent messages" rows={analytics.recentMessages} primary={(row) => row.title} secondary={(row) => row.message} />
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

function ProductTable({ rows, onEdit, onDelete }) {
  return <Section title="Company stock">{rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{["Photo", "Product", "SKU", "Category", "Description", "Price", "Coins", "Quantity", "Variants", "Status", "Actions"].map((h) => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((p, index) => <tr className={`border-t border-slate-100 transition hover:bg-slate-50 ${index % 2 ? "bg-stone-50/70" : "bg-white"}`} key={p.id}><td className="p-3">{p.image ? <img src={fileUrl(p.image)} alt={p.productName} className="h-12 w-12 rounded-md object-cover" /> : <div className="h-12 w-12 rounded-md bg-slate-100" />}</td><td className="p-3 font-semibold text-slate-900">{p.productName}</td><td>{p.sku}</td><td>{p.category}</td><td className="max-w-xs truncate">{p.description || "-"}</td><td>{formatMoney(p.price)}</td><td>{p.creditCoins || 0}</td><td><span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{p.quantity}</span></td><td className="max-w-xs">{(p.variants || []).map((v) => `${v.variantName}/${v.colorName}: ${v.stockQuantity}`).join(", ") || "-"}</td><td><StatusBadge value={p.status} /></td><td><div className="flex flex-nowrap gap-1"><button className="rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50" onClick={() => onEdit(p)}>Edit</button><button className="rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50" onClick={() => onDelete(p)}>Delete</button></div></td></tr>)}</tbody></table></div> : <Empty />}</Section>;
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
          <div key={index} className="grid gap-3 rounded-md bg-white p-3 md:grid-cols-6">
            <TextField label="Variant name" value={row.variantName} onChange={(e) => update(index, "variantName", e.target.value)} required />
            <TextField label="Color name" value={row.colorName} onChange={(e) => update(index, "colorName", e.target.value)} required />
            <TextField label="Stock quantity" type="number" min="0" value={row.stockQuantity} onChange={(e) => update(index, "stockQuantity", e.target.value)} required />
            <TextField label="Price override" type="number" min="0" value={row.priceOverride} onChange={(e) => update(index, "priceOverride", e.target.value)} />
            <TextField label="SKU suffix" value={row.skuSuffix} onChange={(e) => update(index, "skuSuffix", e.target.value)} />
            <div className="flex items-end"><Button type="button" variant="ghost" disabled={rows.length === 1} onClick={() => remove(index)}>Remove</Button></div>
          </div>
        ))}
      </div>
    </div>
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
          <label className="block"><span className="text-sm font-semibold text-slate-600">Product</span><select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" value={filters.productId} onChange={(e) => set("productId", e.target.value)}><option value="">All products</option>{products.map((p) => <option key={p.id} value={p.id}>{p.productName}</option>)}</select></label>
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
        <SimpleTable title="Recent payments" rows={(tables.recentPayments || []).map((p) => ({ dealer: p.Dealer?.dealerName || "Dealer", products: p.productSummary || p.Order?.items?.map((i) => `${i.Product?.productName} x ${i.quantity}`).join(", ") || "-", amount: formatMoney(p.amount), method: p.paymentMethod || "-", status: p.paymentStatus, date: p.paidAt ? new Date(p.paidAt).toLocaleString() : new Date(p.createdAt).toLocaleString() }))} cols={["dealer", "products", "amount", "method", "status", "date"]} />
        <SimpleTable title="Recent sales" rows={(tables.recentSales || []).map((s) => ({ product: s.Product?.productName, variant: s.variantName || "-", color: s.colorName || "-", quantity: s.quantitySold }))} cols={["product", "variant", "color", "quantity"]} />
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
  return <Section title={title}>{rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{cols.map((c) => <th className="p-3" key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr className={`border-t border-slate-100 ${i % 2 ? "bg-stone-50/70" : "bg-white"} hover:bg-slate-50`} key={row.id || i}>{cols.map((c) => <td className="p-3" key={c}>{renderCell ? renderCell(row, c) : String(row[c] ?? "")}</td>)}</tr>)}</tbody></table></div> : <Empty />}</Section>;
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
        <MiniList title="Top selling products" rows={stats.topProducts || []} left="productName" right="quantitySold" />
        <MiniList title="Dealer sales performance" rows={stats.dealerPerformance || []} left="dealerName" right="quantitySold" />
      </div>
      <Section title="Dealer sales records">
        {rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{["Date", "Dealer", "Product", "Quantity", "Stock Before", "Stock After", "Remarks", "Created"].map((h) => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((sale) => <tr className="border-t border-slate-100" key={sale.id}><td className="p-3">{sale.saleDate}</td><td>{sale.Dealer?.dealerName || `Dealer #${sale.dealerId}`}</td><td><div className="flex items-center gap-2">{sale.Product?.image && <img src={fileUrl(sale.Product.image)} alt="" className="h-9 w-9 rounded-md object-cover" />}<span>{sale.Product?.productName}</span></div></td><td>{sale.quantitySold}</td><td>{sale.stockBefore}</td><td>{sale.stockAfter}</td><td>{sale.remarks || "-"}</td><td>{new Date(sale.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <Empty text="No dealer sales recorded yet" />}
      </Section>
    </div>
  );
}

function InternalUpdates({ data = {}, filter, setFilter, markRead, markAll }) {
  const rows = data.rows || [];
  const filterMap = { unread: (n) => !n.isRead, read: (n) => n.isRead, low_stock: (n) => n.type === "LOW_STOCK" };
  const visible = rows.filter(filterMap[filter] || (() => true));
  return (
    <Section title="Internal Updates" actions={<Button variant="ghost" onClick={markAll}>Mark all as read</Button>}>
      <div className="mb-4 flex flex-wrap gap-2">{["all", "unread", "read", "low_stock"].map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-sm font-semibold ${filter === f ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>{f.replaceAll("_", " ")}</button>)}</div>
      {visible.length ? <div className="space-y-3">{visible.map((n) => <div key={n.id} className={`rounded-md border p-4 ${n.type === "LOW_STOCK" ? "border-yellow-200 bg-yellow-50" : n.type === "PAYMENT" ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><NotificationBadge value={n.isRead ? "Read" : "Unread"} />{["LOW_STOCK", "PAYMENT", "SALES_UPDATE"].includes(n.type) && <NotificationBadge value={n.type} />}</div><p className="mt-2 font-semibold text-slate-900">{n.title}</p><p className="mt-1 text-sm leading-6 text-slate-600">{n.message}</p><p className="mt-2 text-xs text-slate-500">{new Date(n.createdAt).toLocaleString()}</p></div>{!n.isRead && <Button variant="ghost" onClick={() => markRead(n.id)}>Mark read</Button>}</div></div>)}</div> : <Empty text="No internal updates found" />}
    </Section>
  );
}

function NotificationBadge({ value }) {
  const tone = String(value || "").toUpperCase();
  const classes = tone === "CRITICAL" ? "border-red-200 bg-red-100 text-red-700" : tone === "HIGH" || tone === "LOW_STOCK" ? "border-yellow-200 bg-yellow-100 text-yellow-800" : tone === "UNREAD" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600";
  return <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${classes}`}>{String(value).replaceAll("_", " ")}</span>;
}

function InventoryBoard({ products = [], dealerStock = [] }) {
  const lowStock = products.filter((p) => Number(p.quantity) <= Number(p.lowStockLimit || 0));
  const topStock = [...products].sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0)).slice(0, 6);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card label="Company Products" value={products.length} />
        <Card label="Low Stock Products" value={lowStock.length} />
        <Card label="Dealer Stock Rows" value={dealerStock.length} />
      </div>
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
          product: s.Product?.productName,
          variant: s.variantName || "-",
          color: s.colorName || "-",
          quantity: qty,
          lowStockLimit: limit,
          status: qty === 0 ? "Out of Stock" : qty <= limit ? "Low Stock" : "In Stock"
        };
      })} cols={["dealer", "location", "product", "variant", "color", "quantity", "lowStockLimit", "status"]} />
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
          <p className="font-semibold text-slate-900">{product.productName}</p>
          <p className="text-xs text-slate-500">SKU {product.sku || "-"} | Limit {limit}</p>
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

function DeliveryManagement({ rows = [], updateOrder }) {
  const next = { approved: "packing", packing: "shipping", shipping: "out_for_delivery", out_for_delivery: "delivered" };
  const dealerTitle = (order) => `${order.Dealer?.dealerName || "Dealer"}${order.Dealer?.area || order.Dealer?.city ? ` - ${[order.Dealer?.area, order.Dealer?.city].filter(Boolean).join(", ")}` : ""}`;
  const products = (order) => order.items?.map((i) => `${i.Product?.productName || "Product"}${i.variantName ? ` - ${i.variantName}/${i.colorName}` : ""} x ${i.quantity}`).join(", ");
  return (
    <Section title="Delivery management">
      {rows.length ? <div className="grid gap-4 xl:grid-cols-2">{rows.map((order) => (
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
      ))}</div> : <Empty text="No approved deliveries yet" />}
    </Section>
  );
}

function PinnedTaskBanner() {
  const [pins, setPins] = useState([]);
  useEffect(() => {
    api.get("/admin-ceo/pinned-messages").then(({ data }) => setPins(data.filter((row) => row.isPinned).slice(0, 3))).catch(() => setPins([]));
  }, []);
  if (!pins.length) return null;
  return (
    <div className="mb-5 grid gap-3">
      {pins.map((pin) => (
        <div key={pin.id} className={`rounded-md border p-4 ${pin.priority === "high" ? "border-rose-200 bg-rose-50 text-rose-800" : pin.priority === "low" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{pin.title}</p>
            <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-bold uppercase">{pin.priority}</span>
          </div>
          <p className="mt-1 text-sm">{pin.message}</p>
        </div>
      ))}
    </div>
  );
}

function AdminCeoReadOnlyOverview({ endpoint, type }) {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = () => {
    setLoading(true);
    return api.get(endpoint).then(({ data }) => setPayload(data)).finally(() => setLoading(false));
  };
  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get(endpoint).then(({ data }) => {
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
    await load();
  };
  const controlProduct = async (product) => {
    const action = product.status === "active" ? "disband" : "reactivate";
    if (!window.confirm(`${action === "disband" ? "Deactivate" : "Reactivate"} ${product.productName}?`)) return;
    await api.patch(`/admin-ceo/products/${product.id}/${action}`);
    await load();
  };
  const stats = payload?.stats || payload?.totals || {};
  const statRows = Object.entries(stats).filter(([, value]) => typeof value !== "object").slice(0, 8);
  const moneyKeys = ["revenue", "paidAmount", "unpaidAmount", "totalRevenue", "pendingPayment", "creditOutstanding", "outstandingBalance"];
  const statValue = (key, value) => moneyKeys.some((item) => key.toLowerCase().includes(item.toLowerCase())) ? formatMoney(value) : value;
  return (
    <div className="space-y-6">
      {statRows.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statRows.map(([key, value]) => <Card key={key} label={key.replace(/([A-Z])/g, " $1")} value={statValue(key, value)} />)}
        </div>
      )}
      {type === "dashboard" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <SimpleTable title="Order Status Overview" rows={Object.entries(payload.orderStatus || {}).map(([status, count]) => ({ status, count }))} cols={["status", "count"]} />
          <LicenseUsageCard license={payload.license} />
        </div>
      )}
      {type === "dealers" && (
        <>
          <SimpleTable title="Top Performing Dealers" rows={payload.stats?.topPerformingDealers || []} cols={["dealerName", "ownerName", "city", "area", "totalOrders", "totalSales", "pendingPayment", "creditBalance"]} />
          <SimpleTable title="Dealer Details" rows={(payload.dealers || []).map((d) => ({ ...d, location: [d.area, d.city, d.pincode].filter(Boolean).join(", "), actions: d }))} cols={["dealerName", "ownerName", "email", "phone", "location", "address", "status", "totalOrders", "totalSales", "pendingPayment", "creditBalance", "createdAt", "actions"]} renderCell={(row, col) => col === "actions" ? <div className="flex flex-nowrap gap-2"><button className="whitespace-nowrap rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white" onClick={() => alert(`${row.dealerName}\n${row.email}\n${row.location}`)}>View</button><button className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold text-white ${row.status === "active" ? "bg-amber-500" : "bg-emerald-600"}`} onClick={() => controlDealer(row.actions)}>{row.status === "active" ? "Suspend" : "Reactivate"}</button></div> : String(row[col] ?? "")} />
        </>
      )}
      {type === "license" && (
        <>
          <LicenseUsageCard license={payload} />
          <SimpleTable title="Active Licenses" rows={(payload.licenses || []).map((row) => ({ plan: row.LicensePlan?.name, quantity: row.quantity, dealerLimitAdded: row.dealerLimitAdded, status: row.status, activatedAt: row.activatedAt, expiresAt: row.expiresAt }))} cols={["plan", "quantity", "dealerLimitAdded", "status", "activatedAt", "expiresAt"]} />
          <SimpleTable title="Purchase Requests" rows={payload.pendingRequests || []} cols={["status", "quantity", "totalDealerLimit", "amount", "paymentStatus", "createdAt"]} />
        </>
      )}
      {type === "products" && (
        <>
          <SimpleTable title="Top Selling Products" rows={payload.topSellingProducts || []} cols={["productName", "stock", "soldQuantity", "revenue", "creditCoins", "status"]} />
          <SimpleTable title="Low Selling Products" rows={payload.lowSellingProducts || []} cols={["productName", "stock", "soldQuantity", "revenue", "creditCoins", "status"]} />
          <SimpleTable title="Product Stock & Revenue" rows={(payload.products || []).map((p) => ({ ...p, actions: p }))} cols={["productName", "sku", "category", "stock", "soldQuantity", "revenue", "creditCoins", "status", "actions"]} renderCell={(row, col) => col === "actions" ? <div className="flex flex-nowrap gap-2"><button className="whitespace-nowrap rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white" onClick={() => alert(`${row.productName}\nSKU: ${row.sku}\nStock: ${row.stock}`)}>View</button><button className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold text-white ${row.status === "active" ? "bg-rose-600" : "bg-emerald-600"}`} onClick={() => controlProduct(row.actions)}>{row.status === "active" ? "Disband Product" : "Reactivate"}</button></div> : String(row[col] ?? "")} />
        </>
      )}
      {type === "orders" && (
        <>
          <SimpleTable title="Order Status Chart Data" rows={Object.entries(payload.statusCounts || {}).map(([status, count]) => ({ status, count }))} cols={["status", "count"]} />
          <SimpleTable title="Recent Orders" rows={(payload.recentOrders || []).map(orderRow)} cols={["dealer", "location", "products", "amount", "status", "orderDate", "deliveryDate"]} />
        </>
      )}
      {type === "delivery" && <SimpleTable title="Delivery Monitoring" rows={(payload.deliveries || []).map(orderRow)} cols={["dealer", "location", "products", "amount", "status", "orderDate", "deliveryDate"]} />}
      {type === "finance" && (
        <>
          <SimpleTable title="Payment Aging" rows={Object.entries(payload.aging || {}).map(([range, count]) => ({ range, count }))} cols={["range", "count"]} />
          <SimpleTable title="Dealer-wise Payments" rows={(payload.payments || []).map((p) => ({ dealer: p.Dealer?.dealerName, amount: formatMoney(p.amount), status: p.paymentStatus, method: p.paymentMethod || "-", createdAt: p.createdAt, paidAt: p.paidAt }))} cols={["dealer", "amount", "status", "method", "createdAt", "paidAt"]} />
        </>
      )}
      {type === "credit" && (
        <>
          <SimpleTable title="Dealer Credit Balances" rows={(payload.wallets || []).map((w) => ({ dealer: w.Dealer?.dealerName, balance: w.balance, totalEarned: w.totalEarned, totalRedeemed: w.totalRedeemed }))} cols={["dealer", "balance", "totalEarned", "totalRedeemed"]} />
          <SimpleTable title="Recent Redemptions" rows={(payload.redemptions || []).map((r) => ({ dealer: r.Dealer?.dealerName, reward: r.reward?.title, coinsUsed: r.coinsUsed, status: r.status, requestedAt: r.requestedAt }))} cols={["dealer", "reward", "coinsUsed", "status", "requestedAt"]} />
          <SimpleTable title="Credit Gift Uploads" rows={payload.rewards || []} cols={["title", "requiredCoins", "quantity", "status", "createdAt"]} />
        </>
      )}
      {type === "managers" && <SimpleTable title="Manager Work Monitoring" rows={payload || []} cols={["name", "email", "role", "status", "actionsCount", "pinnedTasks", "recentActivity", "lastLogin"]} />}
    </div>
  );
}

function LicenseUsageCard({ license = {} }) {
  const percent = license.capacity ? Math.min(100, Math.round((Number(license.dealerCount || 0) / Number(license.capacity || 1)) * 100)) : 0;
  return (
    <Section title="License Capacity Usage">
      <div className="grid gap-4 md:grid-cols-3">
        <Card label="Capacity" value={license.capacity || 0} />
        <Card label="Used Slots" value={license.dealerCount || 0} />
        <Card label="Remaining Slots" value={license.remainingSlots || 0} />
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-600">{percent}% used</p>
    </Section>
  );
}

function orderRow(order) {
  return {
    dealer: order.Dealer?.dealerName || "-",
    location: [order.Dealer?.area, order.Dealer?.city].filter(Boolean).join(", "),
    products: order.items?.map((item) => `${item.Product?.productName || "Product"} x ${item.quantity}`).join(", "),
    amount: formatMoney(order.totalAmount),
    status: order.status,
    orderDate: order.createdAt,
    deliveryDate: order.deliveryDate || "-"
  };
}

function AdminManagers() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", role: "DEALER_MANAGER", status: "active" });
  const load = () => api.get("/admin-ceo/managers").then(({ data }) => setRows(data));
  useEffect(() => { load(); }, []);
  const createManager = async (e) => {
    e.preventDefault();
    await api.post("/admin-ceo/managers", form);
    setForm({ name: "", email: "", phone: "", password: "", role: "DEALER_MANAGER", status: "active" });
    load();
  };
  const setStatus = async (id, status) => {
    await api.patch(`/admin-ceo/managers/${id}/status`, { status });
    load();
  };
  const editManager = async (manager) => {
    const name = window.prompt("Manager name", manager.name);
    if (!name) return;
    await api.put(`/admin-ceo/managers/${manager.id}`, { name });
    load();
  };
  const removeManager = async (manager) => {
    if (!window.confirm(`Remove ${manager.name}? Login will be disabled and history kept.`)) return;
    await api.delete(`/admin-ceo/managers/${manager.id}`);
    load();
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Section title="Create Admin Manager">
        <FormGrid onSubmit={createManager}>
          <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextField label="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <label className="text-sm font-semibold text-slate-600">Role<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="DEALER_MANAGER">Dealer Manager</option><option value="PRODUCT_DELIVERY_MANAGER">Product Delivery Manager</option><option value="FINANCE_MANAGER">Finance Manager</option></select></label>
          <label className="text-sm font-semibold text-slate-600">Status<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <div className="md:col-span-2"><Button type="submit"><Plus size={16} /> Create Manager</Button></div>
        </FormGrid>
      </Section>
      <Section title="Organization Managers">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{["Name", "Email", "Phone", "Role", "Status", "Action"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100"><td className="p-3 font-semibold">{row.name}</td><td>{row.email}</td><td>{row.phone || "-"}</td><td><StatusBadge value={row.role} /></td><td><StatusBadge value={row.status} /></td><td><div className="flex flex-nowrap gap-2"><button className="whitespace-nowrap rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white" onClick={() => editManager(row)}>Edit</button><button className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold text-white ${row.status === "active" ? "bg-amber-500" : "bg-emerald-600"}`} onClick={() => setStatus(row.id, row.status === "active" ? "inactive" : "active")}>{row.status === "active" ? "Block" : "Unblock"}</button><button className="whitespace-nowrap rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white" onClick={() => removeManager(row)}>Delete</button></div></td></tr>)}</tbody></table>
        </div>
      </Section>
    </div>
  );
}

function AdminPinnedMessages() {
  const [rows, setRows] = useState([]);
  const [managers, setManagers] = useState([]);
  const [form, setForm] = useState({ assignedTo: "", roleTarget: "", title: "", message: "", priority: "medium" });
  const load = async () => {
    const [pins, mgrs] = await Promise.allSettled([api.get("/admin-ceo/pinned-messages"), api.get("/admin-ceo/managers")]);
    setRows(pins.status === "fulfilled" ? pins.value.data : []);
    setManagers(mgrs.status === "fulfilled" ? mgrs.value.data : []);
  };
  useEffect(() => { load(); }, []);
  const submit = async (e) => {
    e.preventDefault();
    await api.post("/admin-ceo/pinned-messages", { ...form, assignedTo: form.assignedTo || null, roleTarget: form.roleTarget || null });
    setForm({ assignedTo: "", roleTarget: "", title: "", message: "", priority: "medium" });
    load();
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Section title="Create Pinned Task">
        <form onSubmit={submit} className="grid gap-3">
          <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <label className="text-sm font-semibold text-slate-600">Assign To<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}><option value="">All / Role target</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
          <label className="text-sm font-semibold text-slate-600">Role Target<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={form.roleTarget} onChange={(e) => setForm({ ...form, roleTarget: e.target.value })}><option value="">All roles</option><option value="DEALER_MANAGER">Dealer Manager</option><option value="PRODUCT_DELIVERY_MANAGER">Product Delivery Manager</option><option value="FINANCE_MANAGER">Finance Manager</option></select></label>
          <label className="text-sm font-semibold text-slate-600">Priority<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          <textarea className="min-h-28 rounded-md border border-slate-200 p-3 text-sm" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
          <Button type="submit">Pin Message</Button>
        </form>
      </Section>
      <SimpleTable title="Pinned Messages" rows={rows.map((r) => ({ ...r, assignee: r.assignee?.name || r.roleTarget || "All", priority: r.priority }))} cols={["title", "message", "priority", "assignee", "createdAt"]} />
    </div>
  );
}

function AdminTeamChat() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  useEffect(() => { api.get("/admin-ceo/chat/conversations").then(({ data }) => setUsers(data)); }, []);
  useEffect(() => { if (selected) api.get(`/admin-ceo/chat/${selected.id}`).then(({ data }) => setMessages(data)); }, [selected]);
  const send = async (e) => {
    e.preventDefault();
    if (!selected || !text.trim()) return;
    await api.post("/admin-ceo/chat/send", { receiverId: selected.id, message: text.trim() });
    setText("");
    const { data } = await api.get(`/admin-ceo/chat/${selected.id}`);
    setMessages(data);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Section title="Team Members">{users.map((u) => <button key={u.id} onClick={() => setSelected(u)} className={`mb-2 w-full rounded-md px-3 py-2 text-left text-sm ${selected?.id === u.id ? "bg-cyan-50 text-brand" : "hover:bg-slate-50"}`}><span className="block font-semibold">{u.name}</span><span className="block text-xs text-slate-500">{u.role.replaceAll("_", " ")}</span></button>)}</Section>
      <Section title={selected ? `Internal Team Chat - ${selected.name}` : "Internal Team Chat"}>{selected ? <><div className="mb-4 h-80 space-y-3 overflow-y-auto rounded-md bg-slate-50 p-4">{messages.map((m) => <div key={m.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"><p className="font-semibold text-slate-700">{m.sender?.name}</p><p>{m.message}</p><p className="mt-1 text-[11px] text-slate-400">{new Date(m.createdAt).toLocaleString()}</p></div>)}</div><form onSubmit={send} className="flex gap-2"><input className="flex-1 rounded-md border border-slate-300 px-3 py-2" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message" required /><Button>Send</Button></form></> : <Empty text="Select a team member" />}</Section>
    </div>
  );
}

function LicenseUpgrade({ status, requestLicense }) {
  const plans = status?.plans || [];
  return (
    <div className="space-y-6">
      <Section title="License Status / Upgrade">
        <div className="rounded-md border border-indigo-100 bg-indigo-50 p-5">
          <h2 className="text-lg font-semibold text-slate-950">Great to see your business growing.</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">To add more dealers, purchase an additional license and continue expanding your dealer network.</p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            ["Current dealers", status?.dealerCount || 0],
            ["Current license capacity", status?.capacity || 0],
            ["Remaining dealer slots", status?.remainingSlots || 0]
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
            </div>
          ))}
        </div>
      </Section>
      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition duration-200 hover:-translate-y-1 hover:shadow-card-hover">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-semibold text-slate-950">{plan.name} License</p>
                <p className="mt-2 text-sm text-slate-600">{plan.dealerLimit} additional dealers</p>
                <p className="mt-3 text-2xl font-bold text-indigo-700">{formatMoney(plan.price)}</p>
              </div>
              <StatusBadge value={plan.status} />
            </div>
            <p className="mt-4 min-h-12 text-sm leading-6 text-slate-600">{plan.description}</p>
            <Button className="mt-4" onClick={() => requestLicense(plan.id)}>Request More License</Button>
          </div>
        ))}
      </div>
      <SimpleTable title="Pending license requests" rows={status?.pendingRequests || []} cols={["status", "quantity", "totalDealerLimit", "amount", "createdAt"]} />
    </div>
  );
}

function OrderTable({ rows, updateOrder, approveOrder, schedules, setSchedules }) {
  const setSchedule = (id, key, value) => setSchedules({ ...schedules, [id]: { ...(schedules[id] || {}), [key]: value } });
  const dealerTitle = (order) => `${order.Dealer?.dealerName || "Dealer"}${order.Dealer?.area || order.Dealer?.city ? ` - ${[order.Dealer?.area, order.Dealer?.city].filter(Boolean).join(", ")}` : ""}`;
  return <Section title="Order & delivery management">{rows.length ? <div className="space-y-4">{rows.map((o) => {
    const schedule = schedules[o.id] || {};
    const ready = schedule.packingDate && schedule.shippingDate && schedule.outForDeliveryDate && schedule.deliveredDate;
    return <div key={o.id} className="rounded-md border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{dealerTitle(o)} · {formatMoney(o.totalAmount)}</p><p className="text-sm text-slate-500">Order Date: {new Date(o.createdAt).toLocaleDateString()} · {o.status}</p><p className="mt-1 text-xs text-slate-400">Reference: {o.orderNumber}</p></div><div className="flex flex-wrap gap-2">{o.status === "pending" ? <><Button disabled={!ready} onClick={() => approveOrder(o.id)}>Approve Order</Button><Button variant="ghost" onClick={() => updateOrder(o.id, "rejected")}>Reject</Button></> : <StatusBadge value={o.status} />}</div></div><div className="mt-3 text-sm font-semibold text-slate-700">{o.items?.map((i) => `${i.Product?.productName}${i.variantName ? ` - ${i.variantName}/${i.colorName}` : ""} x ${i.quantity}`).join(", ")}</div>{o.status === "pending" && <div className="mt-4 grid gap-3 md:grid-cols-4">{["packingDate", "shippingDate", "outForDeliveryDate", "deliveredDate"].map((key) => <TextField key={key} label={key.replace(/([A-Z])/g, " $1")} type="date" value={schedule[key] || ""} onChange={(e) => setSchedule(o.id, key, e.target.value)} />)}</div>}{o.status === "approved" && <div className="mt-4 rounded-md bg-green-50 p-3 text-sm font-semibold text-green-700">Approved. Invoice generated automatically. Continue delivery updates in Delivery.</div>}<div className="mt-4 grid gap-2 md:grid-cols-4">{["packingDate", "shippingDate", "outForDeliveryDate", "deliveredDate"].map((key) => o[key] && <div key={key} className="rounded-md bg-slate-50 p-2 text-xs"><span className="font-semibold">{key.replace(/([A-Z])/g, " $1")}:</span> {o[key]}</div>)}</div></div>;
  })}</div> : <Empty />}</Section>;
}

function FinanceTable({ rows = [], dealers = [], filter, setFilter, sendReminder }) {
  const dealerName = (id) => dealers.find((d) => d.id === id)?.dealerName || `Dealer #${id}`;
  const visible = rows.filter((p) => filter === "all" || (filter === "unpaid" ? p.paymentStatus === "pending" : filter === "paid" ? p.paymentStatus === "paid" : p.paymentMethod === filter));
  return <Section title="Dealer-wise payment list" actions={<div className="flex flex-wrap gap-2">{["all", "unpaid", "paid", "cash", "online"].map((tab) => <button key={tab} onClick={() => setFilter(tab)} className={`rounded-full px-3 py-1 text-sm font-semibold ${filter === tab ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>{tab}</button>)}</div>}>{visible.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{["Dealer", "Invoice", "Products", "Amount", "Approved", "Days Unpaid", "Status", "Method", "Paid At", "Transaction", "Action"].map((h) => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{visible.map((p) => <tr className="border-t border-slate-100" key={p.id}><td className="p-3"><p className="font-semibold">{p.Dealer?.dealerName || dealerName(p.dealerId)}</p><p className="text-xs text-slate-500">{[p.Dealer?.area, p.Dealer?.city].filter(Boolean).join(", ")}</p></td><td>{p.invoiceNumber || `INV-${p.id}`}</td><td className="max-w-xs truncate font-semibold text-slate-700">{p.productSummary || p.Order?.items?.map((i) => `${i.Product?.productName} x ${i.quantity}`).join(", ")}</td><td>{formatMoney(p.amount)}</td><td>{p.orderApprovedAt ? new Date(p.orderApprovedAt).toLocaleDateString() : "-"}</td><td>{p.daysUnpaid || 0}</td><td><PaymentBadge value={p.paymentStatus} /></td><td>{p.paymentMethod || "-"}</td><td>{p.paidAt ? new Date(p.paidAt).toLocaleString() : "-"}</td><td>{p.transactionId || "-"}</td><td>{p.paymentStatus === "pending" ? <Button variant="ghost" onClick={() => sendReminder(p.id)}>Send Reminder</Button> : "-"}</td></tr>)}</tbody></table></div> : <Empty />}</Section>;
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
