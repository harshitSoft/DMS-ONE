import { Component, useEffect, useMemo, useState } from "react";
import { Gift, Star } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Layout from "../components/Layout";
import { api, fileUrl } from "../api/client";
import { Button, Card, ChartCard, ConfirmModal, DeliveryTimeline, Empty, FormGrid, formatDate, formatMoney, Loading, PageHeader, Section, StatusBadge as UIStatusBadge, TextField } from "../components/UI";
import { consumeProfileTargetTab, roleTabs } from "../utils/profileNavigation";
import { useAuth } from "../state/AuthContext";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "stock", label: "Available Company Stock", icon: "inventory" },
  { id: "inventory", label: "My Inventory", icon: "products" },
  { id: "sales", label: "Sales", icon: "reports" },
  { id: "orders", label: "My Orders", icon: "orders" },
  { id: "delivery", label: "Delivery", icon: "delivery" },
  { id: "finance", label: "Finance", icon: "finance" },
  { id: "creditStore", label: "Credit Store", icon: "credits" },
  { id: "messages", label: "Messages", icon: "messages" },
  { id: "internalUpdates", label: "Internal Updates", icon: "internalUpdates" },
  { id: "policies", label: "Policies", icon: "policies" },
  { id: "reports", label: "Send Report", icon: "reports" }
];

export default function Dealer() {
  return (
    <DealerErrorBoundary>
      <DealerDashboard />
    </DealerErrorBoundary>
  );
}

class DealerErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
          <div className="w-full max-w-lg rounded-md border border-rose-200 bg-white p-6 shadow-soft">
            <h1 className="text-lg font-semibold text-slate-950">Dealer dashboard could not load</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">A dashboard section failed to render. Please retry, and if it continues, check the dealer API response.</p>
            <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm font-semibold text-rose-700">{this.state.error.message || "Unknown dashboard error"}</p>
            <Button className="mt-4" onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function DealerDashboard() {
  const { user } = useAuth();
  const visibleTabs = roleTabs[user?.role] || tabs;
  const visibleTabIds = visibleTabs.map((tab) => tab.id);
  const [activeTab, setActiveTab] = useState(() => consumeProfileTargetTab("dashboard", visibleTabs));
  const [data, setData] = useState({});
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [orderItems, setOrderItems] = useState({});
  const [stockSelections, setStockSelections] = useState({});
  const [orderWarning, setOrderWarning] = useState("");
  const [stockRequest, setStockRequest] = useState(null);
  const [orderFilter, setOrderFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [report, setReport] = useState({ title: "", type: "inventory", description: "" });
  const [reply, setReply] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [saleForm, setSaleForm] = useState({ saleDate: today, productId: "", quantitySold: "", remarks: "" });
  const [salesFilter, setSalesFilter] = useState({ date: "", productId: "" });
  const [internalFilter, setInternalFilter] = useState("all");
  const [salesError, setSalesError] = useState("");
  const [dealerManagersExist, setDealerManagersExist] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const endpointMap = {
        dashboard: "dashboard",
        stock: "stock",
        orders: "orders",
        delivery: "delivery",
        inventory: "inventory",
        sales: "sales",
        finance: "finance",
        policies: "policies",
        messages_conversation: "messages/conversation",
        credit_store: "credit/store",
        credit_redemptions: "credit/redemptions",
        credit_transactions: "credit/transactions"
      };
      const arrayKeys = new Set(["stock", "orders", "delivery", "inventory", "sales", "finance", "policies", "messages_conversation", "credit_redemptions", "credit_transactions"]);
      const needed = ["dashboard"];
      if (visibleTabIds.includes("stock")) needed.push("stock");
      if (visibleTabIds.includes("orders")) needed.push("orders");
      if (visibleTabIds.includes("delivery")) needed.push("delivery");
      if (visibleTabIds.includes("inventory") || visibleTabIds.includes("sales")) needed.push("inventory");
      if (visibleTabIds.includes("sales")) needed.push("sales");
      if (visibleTabIds.includes("finance")) needed.push("finance");
      if (visibleTabIds.includes("policies")) needed.push("policies");
      if (visibleTabIds.includes("messages")) needed.push("messages_conversation");
      if (visibleTabIds.includes("creditStore")) needed.push("credit_store", "credit_redemptions", "credit_transactions");
      const result = await Promise.allSettled([
        ...needed.map((key) => api.get(`/dealer/${endpointMap[key]}`)),
        api.get("/internal-updates"),
        api.get("/dealer-ceo/manager-exists").catch(() => ({ data: { exists: false } }))
      ]);
      const payload = {};
      const failed = [];
      needed.forEach((key, i) => {
        if (result[i].status === "fulfilled") {
          const value = result[i].value.data;
          payload[key] = arrayKeys.has(key) ? (Array.isArray(value) ? value : []) : (value && typeof value === "object" ? value : {});
        } else {
          payload[key] = arrayKeys.has(key) ? [] : {};
          failed.push(key.replaceAll("_", " "));
        }
      });
      const updatesResult = result[needed.length];
      payload.internalUpdates = updatesResult.status === "fulfilled" && updatesResult.value.data ? updatesResult.value.data : { rows: [], unreadCount: 0 };
      setDealerManagersExist(Boolean(result[needed.length + 1]?.value?.data?.exists));
      setData(payload);
      if (failed.length) setLoadError(`Some dealer sections could not load: ${failed.join(", ")}.`);
    } catch (error) {
      setData({ dashboard: {}, stock: [], orders: [], delivery: [], inventory: [], sales: [], finance: [], policies: [], messages_conversation: [], credit_store: {}, credit_redemptions: [], credit_transactions: [], internalUpdates: { rows: [], unreadCount: 0 } });
      setLoadError(error.response?.data?.message || error.message || "Dealer dashboard data could not load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!visibleTabIds.includes(activeTab)) setActiveTab("dashboard");
  }, [activeTab, visibleTabIds.join("|")]);

  const placeOrder = async () => {
    if (dealerManagersExist && ["DEALER", "DEALER_CEO"].includes(user?.role)) return setOrderWarning("Managed by assigned manager");
    const items = Object.entries(orderItems).filter(([, q]) => Number(q) > 0).map(([productId, quantity]) => ({ productId: Number(productId), productVariantId: stockSelections[productId]?.productVariantId || null, quantity: Number(quantity) }));
    if (!items.length) return alert("Select at least one product quantity");
    const invalid = items.find((item) => {
      const stock = (Array.isArray(data.stock) ? data.stock : []).find((row) => Number(row.productId) === Number(item.productId));
      const variant = stockSelections[item.productId]?.variant;
      return item.quantity < 1 || item.quantity > Number(variant?.stockQuantity ?? stock?.quantity ?? 0);
    });
    if (invalid) {
      const stock = (Array.isArray(data.stock) ? data.stock : []).find((row) => Number(row.productId) === Number(invalid.productId));
      const variant = stockSelections[invalid.productId]?.variant;
      setOrderWarning(`You cannot order more than available stock. Available quantity: ${variant?.stockQuantity ?? stock?.quantity ?? 0}`);
      return;
    }
    try {
      await api.post("/dealer/orders", { items });
      setOrderItems({});
      setStockSelections({});
      setOrderWarning("");
      await load();
      setActiveTab("orders");
    } catch (error) {
      const detail = error.response?.data;
      setOrderWarning(detail?.availableStock !== undefined ? `${detail.message}. Available quantity: ${detail.availableStock}` : detail?.message || "Unable to place order");
    }
  };

  const sendStockRequest = async (e) => {
    e.preventDefault();
    await api.post("/dealer/messages/stock-request", stockRequest);
    setStockRequest(null);
    alert("Stock request sent to admin");
    load();
  };

  const pay = async (paymentId, paymentMethod) => {
    if (paymentMethod === "online") alert("Dummy online payment approved. A fake transaction id will be generated.");
    if (paymentMethod === "cash" && !confirm("Confirm cash payment done?")) return;
    await api.post(`/dealer/finance/pay/${paymentId}`, { paymentMethod });
    load();
  };

  const sendReply = async (e) => {
    e.preventDefault();
    await api.post("/dealer/messages/reply", { message: reply });
    setReply("");
    load();
  };

  const sendReport = async (e) => {
    e.preventDefault();
    await api.post("/dealer/reports", report);
    setReport({ title: "", type: "inventory", description: "" });
    alert("Report sent");
  };

  const updateLowStockLimit = async (id, lowStockLimit) => {
    if (dealerManagersExist && ["DEALER", "DEALER_CEO"].includes(user?.role)) return alert("Managed by assigned manager");
    await api.patch(`/dealer/inventory/${id}/low-stock-limit`, { lowStockLimit: Number(lowStockLimit) });
    load();
  };

  const recordSale = async (e) => {
    e.preventDefault();
    if (dealerManagersExist && ["DEALER", "DEALER_CEO"].includes(user?.role)) return setSalesError("Managed by assigned manager");
    const selected = data.inventory?.find((item) => String(item.id) === String(saleForm.inventoryId || saleForm.productId));
    if (!selected) return alert("Select a product from your inventory");
    if (Number(saleForm.quantitySold) > Number(selected.quantity || 0)) {
      const message = `You cannot sell more than available inventory stock. Available stock: ${selected.quantity}`;
      setSalesError(message);
      return alert(message);
    }
    if (Number(saleForm.quantitySold) > Math.max(10, Number(selected.quantity || 0) * 0.6) && !confirm("This is a high quantity sale. Record it now?")) return;
    try {
      await api.post("/dealer/sales", { ...saleForm, quantitySold: Number(saleForm.quantitySold), productId: Number(selected.productId), productVariantId: selected.productVariantId || null });
      setSaleForm({ saleDate: today, productId: "", inventoryId: "", quantitySold: "", remarks: "" });
      alert("Sale recorded");
      setSalesError("");
      await load();
    } catch (error) {
      const message = error.response?.data?.availableStock !== undefined ? `You cannot sell more than available inventory stock. Available stock: ${error.response.data.availableStock}` : error.response?.data?.message || "Unable to record sale";
      setSalesError(message);
      alert(message);
    }
  };

  const markUpdateRead = async (id) => {
    await api.patch(`/internal-updates/${id}/read`);
    load();
  };

  const markAllUpdatesRead = async () => {
    await api.patch("/internal-updates/read-all");
    load();
  };

  if (loading) return <Layout title="Dealer" subtitle="Dealer self-service workspace" tabs={visibleTabs} activeTab={activeTab} onTab={setActiveTab}><Loading /></Layout>;

  const dashboard = data.dashboard || {};
  const dashboardCards = [
    ["Own Stock", dashboard.ownTotalStock],
    ["Low Stock", dashboard.lowStockCount],
    ["Pending Orders", dashboard.pendingOrders],
    ["Approved Orders", dashboard.approvedOrders],
    ["Delivered Orders", dashboard.deliveredOrders],
    ["Rejected Orders", dashboard.rejectedOrders],
    ["Today Sales Units", dashboard.todaySalesUnits],
    ["This Month Sales", dashboard.monthSalesUnits],
    ["Total Purchase", formatMoney(dashboard.totalPurchaseAmount)],
    ["Pending Payments", dashboard.pendingPayments],
    ["Credit Balance", dashboard.creditBalance],
    ["Earned This Month", dashboard.coinsEarnedThisMonth],
    ["Coins Redeemed", dashboard.coinsRedeemed],
    ["Affordable Rewards", dashboard.affordableRewardsCount]
  ];
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const stock = Array.isArray(data.stock) ? data.stock : [];
  const delivery = Array.isArray(data.delivery) ? data.delivery : [];
  const inventory = Array.isArray(data.inventory) ? data.inventory : [];
  const sales = Array.isArray(data.sales) ? data.sales : [];
  const finance = Array.isArray(data.finance) ? data.finance : [];
  const policies = Array.isArray(data.policies) ? data.policies : [];
  const messages = Array.isArray(data.messages_conversation) ? data.messages_conversation : [];
  const creditRedemptions = Array.isArray(data.credit_redemptions) ? data.credit_redemptions : [];
  const creditTransactions = Array.isArray(data.credit_transactions) ? data.credit_transactions : [];
  const orderStatusChart = Object.entries(orders.reduce((acc, order) => ({ ...acc, [order.status]: (acc[order.status] || 0) + 1 }), {})).map(([status, count]) => ({ status: status.replaceAll("_", " "), count }));
  const stockChart = inventory.map((item) => ({ product: item.Product?.productName || "Product", quantity: item.quantity }));
  const paymentChart = Object.entries(finance.reduce((acc, payment) => ({ ...acc, [payment.paymentStatus]: (acc[payment.paymentStatus] || 0) + 1 }), {})).map(([status, count]) => ({ status, count }));

  const guarded = (id, node) => visibleTabIds.includes(id) ? node : <AccessDenied />;
  const ceoReadOnly = dealerManagersExist && ["DEALER", "DEALER_CEO"].includes(user?.role);

  return (
    <Layout title="Dealer Dashboard" subtitle="Orders, inventory, finance and updates" tabs={visibleTabs} activeTab={activeTab} onTab={setActiveTab}>
      <PageHeader
        eyebrow={String(user?.role || "Dealer").replaceAll("_", " ")}
        title={visibleTabs.find((tab) => tab.id === activeTab)?.label || "Dashboard"}
        description="Track inventory, orders, sales, deliveries, payments and credits from your dealer workspace."
      />
      {loadError && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800 shadow-sm"><span>{loadError}</span><Button variant="ghost" onClick={load}>Retry</Button></div>}
      {activeTab === "dashboard" && <div className="space-y-6"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{dashboardCards.map(([label, value]) => <Card key={label} label={label} value={value} />)}</div><div className="grid gap-6 xl:grid-cols-2"><ChartCard title="Order status chart"><div className="h-72"><ResponsiveContainer><PieChart><Pie data={orderStatusChart} dataKey="count" nameKey="status" outerRadius={90} label>{orderStatusChart.map((entry, index) => <Cell key={entry.status} fill={["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#F43F5E"][index % 5]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></ChartCard><ChartCard title="Stock chart"><div className="h-72"><ResponsiveContainer><BarChart data={stockChart}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="product" /><YAxis /><Tooltip /><Bar dataKey="quantity" fill="#0EA5E9" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></ChartCard><ChartCard title="Payment status chart"><div className="h-72"><ResponsiveContainer><PieChart><Pie data={paymentChart} dataKey="count" nameKey="status" outerRadius={90} label>{paymentChart.map((entry, index) => <Cell key={entry.status} fill={["#F59E0B", "#10B981", "#F43F5E", "#64748B"][index % 4]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div></ChartCard><ChartCard title="Purchase amount"><div className="grid h-72 place-items-center rounded-md bg-slate-50 text-center"><div><p className="text-sm font-semibold text-slate-500">Total purchase value</p><p className="mt-2 text-4xl font-semibold text-slate-950">{formatMoney(dashboard.totalPurchaseAmount)}</p></div></div></ChartCard></div></div>}
      {activeTab === "managers" && guarded("managers", <DealerManagers />)}
      {activeTab === "stock" && (
        guarded("stock", <Section title="Company available stock" actions={ceoReadOnly ? <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">Managed by assigned manager</span> : <Button onClick={placeOrder}>Place Order</Button>}>
          {orderWarning && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700 animate-pulse">{orderWarning}</div>}
          {stock.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{stock.map((stock) => <StockCard key={stock.id} stock={stock} quantity={orderItems[stock.productId] || ""} selection={stockSelections[stock.productId]} setSelection={(value) => setStockSelections({ ...stockSelections, [stock.productId]: value })} setQuantity={(value) => setOrderItems({ ...orderItems, [stock.productId]: value })} requestMore={() => setStockRequest({ productId: stock.productId, requestedQuantity: Number(orderItems[stock.productId] || 0), availableStock: stock.quantity, message: `I want more quantity of ${stock.Product?.productName}. Available stock is ${stock.quantity}, but I need ${Number(orderItems[stock.productId] || 0)}. Please increase product stock.` })} />)}</div> : <Empty />}
        </Section>)
      )}
      {stockRequest && <StockRequestModal request={stockRequest} setRequest={setStockRequest} onSubmit={sendStockRequest} />}
      {activeTab === "orders" && guarded("orders", <Orders rows={orders} filter={orderFilter} setFilter={setOrderFilter} search={orderSearch} setSearch={setOrderSearch} />)}
      {activeTab === "delivery" && guarded("delivery", <DeliveryBoard rows={delivery} />)}
      {activeTab === "inventory" && guarded("inventory", <DealerInventory rows={inventory} updateLowStockLimit={updateLowStockLimit} readOnly={ceoReadOnly} />)}
      {activeTab === "dealerStockExchange" && guarded("dealerStockExchange", <DealerStockExchange reloadDealer={load} />)}
      {activeTab === "sales" && guarded("sales", <DealerSales inventory={inventory} sales={sales} form={saleForm} setForm={setSaleForm} onSubmit={recordSale} filter={salesFilter} setFilter={setSalesFilter} error={salesError} readOnly={ceoReadOnly} />)}
      {activeTab === "finance" && guarded("finance", <DealerFinance rows={finance} pay={ceoReadOnly ? () => alert("Managed by assigned manager") : pay} readOnly={ceoReadOnly} />)}
      {activeTab === "creditStore" && guarded("creditStore", <CreditStore store={data.credit_store || {}} redemptions={creditRedemptions} transactions={creditTransactions} reload={load} />)}
      {activeTab === "policies" && guarded("policies", <Table title="Policies & information" rows={policies} cols={["title", "description", "createdAt"]} />)}
      {activeTab === "messages" && guarded("messages", <DealerChat messages={messages} reply={reply} setReply={setReply} sendReply={sendReply} />)}
      {activeTab === "teamChat" && guarded("teamChat", <DealerTeamChat />)}
      {activeTab === "internalUpdates" && <InternalUpdates data={data.internalUpdates} filter={internalFilter} setFilter={setInternalFilter} markRead={markUpdateRead} markAll={markAllUpdatesRead} />}
      {activeTab === "reports" && <Section title="Send update/report to admin"><FormGrid onSubmit={sendReport}>{Object.keys(report).map((k) => <TextField key={k} label={k} value={report[k]} onChange={(e) => setReport({ ...report, [k]: e.target.value })} />)}<div className="md:col-span-2"><Button>Send Report</Button></div></FormGrid></Section>}
    </Layout>
  );
}

function DealerStockExchange({ reloadDealer }) {
  const [sku, setSku] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestTarget, setRequestTarget] = useState(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [historyTab, setHistoryTab] = useState("sent");
  const [filter, setFilter] = useState("ALL");
  const [reminderTarget, setReminderTarget] = useState(null);
  const loadHistory = async () => {
    const [sentRes, receivedRes] = await Promise.all([
      api.get("/dealer-stock-exchange/requests/sent"),
      api.get("/dealer-stock-exchange/requests/received", { params: { completedOnly: "true" } })
    ]);
    setSent(sentRes.data || []);
    setReceived(receivedRes.data || []);
  };
  useEffect(() => { loadHistory().catch(() => null); }, []);

  const search = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/dealer-stock-exchange/search", { params: { sku } });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(err.response?.data?.message || "Unable to search SKU");
    } finally {
      setLoading(false);
    }
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    try {
      await api.post("/dealer-stock-exchange/requests", {
        senderDealerId: requestTarget.dealerId,
        productId: requestTarget.productId,
        productVariantId: requestTarget.productVariantId,
        requestedQuantity: Number(quantity),
        reason
      });
      setRequestTarget(null);
      setQuantity("");
      setReason("");
      alert("Stock request created");
      await Promise.all([loadHistory(), reloadDealer?.()]);
    } catch (err) {
      alert(err.response?.data?.message || "Unable to create stock request");
    }
  };

  const cancel = async (row) => {
    if (!confirm(`Cancel request for ${row.productNameSnapshot}?`)) return;
    await api.patch(`/dealer-stock-exchange/requests/${row.id}/cancel`);
    loadHistory();
  };

  const sendReminder = async (note) => {
    await api.post(`/dealer-stock-exchange/requests/${reminderTarget.id}/reminder`, { note });
    setReminderTarget(null);
    alert("Reminder sent");
    loadHistory();
  };

  const filteredSent = sent.filter((row) => {
    if (filter === "ALL") return true;
    if (filter === "PENDING") return ["REQUESTED", "MANAGER_APPROVED"].includes(row.status);
    if (filter === "REJECTED") return ["MANAGER_REJECTED", "ADMIN_REJECTED"].includes(row.status);
    return row.status === filter;
  });

  return (
    <div className="space-y-6">
      <Section title="Search product by SKU">
        <form onSubmit={search} className="flex flex-col gap-3 md:flex-row">
          <TextField className="flex-1" label="SKU" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Enter product SKU" required />
          <div className="flex items-end"><Button type="submit" disabled={loading}>{loading ? "Searching..." : "Search"}</Button></div>
        </form>
        {error && <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
      </Section>

      {result?.product && (
        <Section title="Product availability">
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="rounded-md border border-slate-200 p-4">
              {result.product.image && <img src={fileUrl(result.product.image)} alt={result.product.productName} className="mb-3 h-36 w-full rounded-md object-cover" />}
              <p className="text-lg font-semibold text-slate-950">{result.product.productName}</p>
              <p className="text-sm text-slate-500">SKU: {result.product.sku}</p>
              <div className="mt-3"><UIStatusBadge value={result.product.isCompanyOutOfStock ? "Company Out of Stock" : `Company Stock ${result.product.companyStock}`} /></div>
              <p className="mt-3 text-sm text-slate-600">{result.product.description || "No description available."}</p>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Available dealers</h3>
              {result.availableDealers?.length ? <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500"><tr>{["Dealer", "Location", "Variant", "Color", "Available", "Action"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {result.availableDealers.map((dealer) => <tr key={`${dealer.dealerId}-${dealer.productVariantId || "std"}`}>
                      <td className="px-4 py-3"><p className="font-semibold text-slate-900">{dealer.dealerName}</p><p className="text-xs text-slate-500">{dealer.ownerName}</p></td>
                      <td className="px-4 py-3">{[dealer.area, dealer.city, dealer.pincode].filter(Boolean).join(", ") || dealer.address || "-"}</td>
                      <td className="px-4 py-3">{dealer.variantName || "-"}</td>
                      <td className="px-4 py-3">{dealer.colorName || "-"}</td>
                      <td className="px-4 py-3 font-semibold text-slate-950">{dealer.availableQuantity}</td>
                      <td className="px-4 py-3"><Button className="min-h-9 px-3 py-1.5 text-xs" onClick={() => { setRequestTarget(dealer); setQuantity(""); setReason(""); }}>Request</Button></td>
                    </tr>)}
                  </tbody>
                </table>
              </div> : <Empty text="No other dealers have this product available" />}
            </div>
          </div>
        </Section>
      )}

      <Section title="Request history" actions={<div className="flex flex-wrap gap-2"><button className={`rounded-md px-3 py-2 text-sm font-semibold ${historyTab === "sent" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setHistoryTab("sent")}>Requests Sent</button><button className={`rounded-md px-3 py-2 text-sm font-semibold ${historyTab === "received" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"}`} onClick={() => setHistoryTab("received")}>Stock Sent / Shared</button></div>}>
        {historyTab === "sent" && <>
          <div className="mb-4 flex flex-wrap gap-2">
            {["ALL", "PENDING", "MANAGER_APPROVED", "TRANSFER_COMPLETED", "REJECTED", "CANCELLED"].map((value) => <button key={value} onClick={() => setFilter(value)} className={`rounded-md px-3 py-1.5 text-xs font-bold ${filter === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{value.replaceAll("_", " ")}</button>)}
          </div>
          <TransferRows rows={filteredSent} mode="sent" onCancel={cancel} />
        </>}
        {historyTab === "received" && <TransferRows rows={received} mode="received" onReminder={setReminderTarget} />}
      </Section>

      {requestTarget && <StockExchangeRequestModal dealer={requestTarget} quantity={quantity} setQuantity={setQuantity} reason={reason} setReason={setReason} onClose={() => setRequestTarget(null)} onSubmit={submitRequest} />}
      {reminderTarget && <ReturnReminderModal request={reminderTarget} onClose={() => setReminderTarget(null)} onSubmit={sendReminder} />}
    </div>
  );
}

function TransferRows({ rows = [], mode, onCancel, onReminder }) {
  if (!rows.length) return <Empty text="No transfer requests found" />;
  return <div className="overflow-x-auto rounded-md border border-slate-200"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500"><tr>{["Product", "Quantity", mode === "sent" ? "Sender dealer" : "Requester dealer", "Status", "Approvals", "Dates", "Action"].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id}><td className="px-4 py-3"><p className="font-semibold">{row.productNameSnapshot}</p><p className="text-xs text-slate-500">{row.sku} {row.variantNameSnapshot ? `| ${row.variantNameSnapshot} / ${row.colorNameSnapshot || "-"}` : ""}</p>{(row.managerRejectReason || row.adminRejectReason) && <p className="mt-1 text-xs font-semibold text-rose-600">{row.managerRejectReason || row.adminRejectReason}</p>}</td><td className="px-4 py-3 text-lg font-semibold text-slate-950">{row.requestedQuantity}</td><td className="px-4 py-3">{mode === "sent" ? row.senderDealer?.dealerName : row.requesterDealer?.dealerName}<p className="text-xs text-slate-500">{[mode === "sent" ? row.senderDealer?.area : row.requesterDealer?.area, mode === "sent" ? row.senderDealer?.city : row.requesterDealer?.city].filter(Boolean).join(", ")}</p></td><td className="px-4 py-3"><UIStatusBadge value={row.status} /></td><td className="px-4 py-3 text-xs text-slate-600">Manager: {row.managerApprovedAt ? formatDate(row.managerApprovedAt) : row.status === "MANAGER_REJECTED" ? "Rejected" : "Pending"}<br />Admin: {row.adminApprovedAt ? formatDate(row.adminApprovedAt) : row.status === "ADMIN_REJECTED" ? "Rejected" : "Pending"}</td><td className="px-4 py-3 text-xs text-slate-600">Created: {formatDate(row.createdAt)}<br />Completed: {formatDate(row.completedAt)}</td><td className="px-4 py-3">{mode === "sent" && row.status === "REQUESTED" ? <Button variant="ghost" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => onCancel(row)}>Cancel</Button> : null}{mode === "received" && row.status === "TRANSFER_COMPLETED" ? <Button variant="soft" className="min-h-9 px-3 py-1.5 text-xs" onClick={() => onReminder(row)}>Send Reminder</Button> : null}</td></tr>)}</tbody></table></div>;
}

function StockExchangeRequestModal({ dealer, quantity, setQuantity, reason, setReason, onClose, onSubmit }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><form onSubmit={onSubmit} className="w-full max-w-lg rounded-md bg-white p-5 shadow-2xl"><h2 className="text-lg font-semibold text-slate-950">Request stock from {dealer.dealerName}</h2><p className="mt-1 text-sm text-slate-500">{dealer.variantName || "Standard"} {dealer.colorName ? `/ ${dealer.colorName}` : ""} | {dealer.availableQuantity} available</p><TextField className="mt-4" label="Requested quantity" type="number" min="1" max={dealer.availableQuantity} value={quantity} onChange={(e) => setQuantity(e.target.value)} required /><label className="mt-4 block text-sm font-semibold text-slate-600">Reason<textarea className="mt-1 w-full rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" rows="3" value={reason} onChange={(e) => setReason(e.target.value)} /></label><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit">Create Request</Button></div></form></div>;
}

function ReturnReminderModal({ request, onClose, onSubmit }) {
  const defaultNote = `Reminder: We shared ${request.requestedQuantity} units of ${request.productNameSnapshot} with you. Please return the product when available in your stock or complete the payment/settlement as discussed.`;
  const [note, setNote] = useState(defaultNote);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><form onSubmit={(e) => { e.preventDefault(); onSubmit(note); }} className="w-full max-w-lg rounded-md bg-white p-5 shadow-2xl"><h2 className="text-lg font-semibold text-slate-950">Send Return/Payment Reminder</h2><textarea className="mt-4 w-full rounded-md border border-slate-200 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" rows="5" value={note} onChange={(e) => setNote(e.target.value)} required /><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit">Send Reminder</Button></div></form></div>;
}

function AccessDenied() {
  return <Section title="Access Denied"><div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">You do not have permission to access this dealer section.</div></Section>;
}

function DealerManagers() {
  const initialForm = { name: "", email: "", phone: "", password: "", role: "DEALER_STOCK_DELIVERY_MANAGER", status: "active" };
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [openCreate, setOpenCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = async () => {
    const { data } = await api.get("/dealer-ceo/managers");
    setRows(data);
  };
  useEffect(() => { load(); }, []);

  const validate = () => {
    if (!form.name.trim()) return "Name is required";
    if (!form.email.trim()) return "Email is required";
    if (!form.password) return "Password is required";
    if (form.password.length < 6) return "Password must be at least 6 characters";
    if (!form.role) return "Role is required";
    return "";
  };

  const save = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setMessage("");
      return;
    }
    try {
      setSubmitting(true);
      const payload = { ...form, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), status: "active" };
      await api.post("/dealer-ceo/managers", payload);
      setForm(initialForm);
      setMessage("Manager created successfully");
      setError("");
      setOpenCreate(false);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Unable to create manager");
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  };
  const edit = async (manager) => {
    const name = window.prompt("Manager name", manager.name);
    if (!name) return;
    await api.put(`/dealer-ceo/managers/${manager.id}`, { name });
    load();
  };
  const toggle = async (manager) => {
    const status = manager.status === "active" ? "inactive" : "active";
    setConfirmAction({
      title: `${status === "active" ? "Unblock" : "Block"} manager`,
      description: `${status === "active" ? "Allow" : "Disable"} login for ${manager.name}?`,
      confirmText: status === "active" ? "Unblock" : "Block",
      danger: status !== "active",
      run: async () => {
        await api.patch(`/dealer-ceo/managers/${manager.id}/status`, { status });
        await load();
      }
    });
  };
  const remove = async (manager) => {
    setConfirmAction({
      title: "Delete manager",
      description: `Delete ${manager.name}? Login will be disabled and history kept.`,
      confirmText: "Delete",
      danger: true,
      run: async () => {
        await api.delete(`/dealer-ceo/managers/${manager.id}`);
        await load();
      }
    });
  };
  const confirm = async () => {
    if (!confirmAction) return;
    await confirmAction.run();
    setConfirmAction(null);
  };
  const displayRole = (role) => ({
    DEALER_STOCK_DELIVERY_MANAGER: "Stock & Delivery Manager",
    DEALER_STOCK_INVENTORY_MANAGER: "Stock & Delivery Manager",
    DEALER_SALES_FINANCE_MANAGER: "Sales & Finance Manager"
  }[role] || String(role || "").replaceAll("_", " "));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Dealer Managers</h2>
          <p className="text-sm text-slate-500">Create and control access for dealer team roles.</p>
        </div>
        <Button onClick={() => { setOpenCreate(true); setError(""); setMessage(""); }}>Create Manager</Button>
      </div>
      {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</div>}
      {error && !openCreate && <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
      <Table title="Dealer Managers" rows={rows.map((row) => ({
        ...row,
        role: displayRole(row.role),
        createdAt: row.createdAt ? new Date(row.createdAt).toLocaleString() : "-",
        actions: row
      }))} cols={["name", "email", "phone", "role", "status", "createdAt", "actions"]} renderCell={(row, col) => col === "actions" ? <div className="flex flex-nowrap gap-2"><button className="whitespace-nowrap rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white" onClick={() => edit(row.actions)}>Edit</button><button className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold text-white ${row.actions.status === "active" ? "bg-amber-500" : "bg-emerald-600"}`} onClick={() => toggle(row.actions)}>{row.actions.status === "active" ? "Block" : "Unblock"}</button><button className="whitespace-nowrap rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white" onClick={() => remove(row.actions)}>Delete</button></div> : row[col]} />
      {openCreate && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
        <div className="w-full max-w-2xl rounded-md bg-white p-5 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Create Manager</h2>
              <p className="mt-1 text-sm text-slate-500">New managers are active by default.</p>
            </div>
            <button className="rounded-md px-2 py-1 text-sm font-semibold text-slate-500 hover:bg-slate-100" onClick={() => setOpenCreate(false)}>Close</button>
          </div>
          {error && <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
          <FormGrid onSubmit={save}>
            <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <TextField label="Password" type="password" minLength="6" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <label className="text-sm font-semibold text-slate-600">Role<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required><option value="DEALER_STOCK_DELIVERY_MANAGER">Stock & Delivery Manager</option><option value="DEALER_SALES_FINANCE_MANAGER">Sales & Finance Manager</option></select></label>
            <label className="text-sm font-semibold text-slate-600">Status<input className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-500" value="Active" disabled /></label>
            <div className="md:col-span-2 flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpenCreate(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create Manager"}</Button></div>
          </FormGrid>
        </div>
      </div>}
      <ConfirmModal open={Boolean(confirmAction)} title={confirmAction?.title} description={confirmAction?.description} confirmText={confirmAction?.confirmText} danger={confirmAction?.danger} onClose={() => setConfirmAction(null)} onConfirm={confirm} />
    </div>
  );
}

function DealerTeamChat() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  useEffect(() => { api.get("/dealer-internal-chat/conversations").then(({ data }) => setUsers(data)); }, []);
  useEffect(() => {
    if (selected) api.get(`/dealer-internal-chat/${selected.id}`).then(({ data }) => setMessages(data));
  }, [selected]);
  const send = async (e) => {
    e.preventDefault();
    if (!selected || !text.trim()) return;
    await api.post("/dealer-internal-chat/send", { receiverId: selected.id, message: text.trim() });
    setText("");
    const { data } = await api.get(`/dealer-internal-chat/${selected.id}`);
    setMessages(data);
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <Section title="Dealer Team">
        <div className="space-y-2">{users.length ? users.map((teamUser) => <button key={teamUser.id} onClick={() => setSelected(teamUser)} className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selected?.id === teamUser.id ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700"}`}><div className="flex items-center justify-between gap-2"><span className="font-semibold">{teamUser.name}</span>{teamUser.unreadCount > 0 && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">{teamUser.unreadCount}</span>}</div><p className="text-xs">{teamUser.role?.replaceAll("_", " ")}</p></button>) : <Empty text="No dealer team members yet" />}</div>
      </Section>
      <Section title={selected ? `Chat with ${selected.name}` : "Internal Team Chat"}>
        {selected ? <><div className="mb-4 max-h-96 space-y-3 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-4">{messages.length ? messages.map((message) => { const mine = message.senderId === user?.id; return <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-md px-3 py-2 text-sm ${mine ? "bg-brand text-white" : "border border-slate-200 bg-white text-slate-800"}`}><p>{message.message}</p><p className="mt-1 text-[11px] opacity-75">{new Date(message.createdAt).toLocaleString()}</p></div></div>; }) : <Empty text="No messages yet" />}</div><form onSubmit={send} className="flex gap-2"><input className="min-h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type message" required /><Button>Send</Button></form></> : <div className="grid min-h-48 place-items-center text-sm text-slate-500">Select a team member to start chatting</div>}
      </Section>
    </div>
  );
}

function StockCard({ stock, quantity, selection, setSelection, setQuantity, requestMore }) {
  const variants = stock.Product?.variants || [];
  const variantNames = [...new Set(variants.map((v) => v.variantName))];
  const selectedVariantName = selection?.variantName || variantNames[0] || "";
  const colors = variants.filter((v) => v.variantName === selectedVariantName);
  const selectedVariant = selection?.variant || colors[0] || null;
  useEffect(() => {
    if (!selection && selectedVariant) setSelection({ variantName: selectedVariant.variantName, productVariantId: selectedVariant.id, variant: selectedVariant });
  }, [selection, selectedVariant, setSelection]);
  const requested = Number(quantity || 0);
  const availableQuantity = Number(selectedVariant?.stockQuantity ?? stock.quantity);
  const price = Number(selectedVariant?.priceOverride || stock.Product?.price || 0);
  const invalid = requested > availableQuantity;
  const low = availableQuantity <= Number(stock.lowStockLimit || 10);
  const empty = availableQuantity === 0;
  const status = empty ? "Out of Stock" : low ? "Low Stock" : "Available";
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg">
      {(selectedVariant?.image || stock.Product?.image) ? <img src={fileUrl(selectedVariant?.image || stock.Product.image)} alt={stock.Product?.productName} className="mb-3 h-36 w-full rounded-md object-cover" /> : <div className="mb-3 h-36 rounded-md bg-slate-100" />}
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-semibold">{stock.Product?.productName}</p><p className="text-sm text-slate-500">{stock.Product?.sku} | {stock.Product?.category || "Uncategorized"} | {formatMoney(price)}</p></div>
        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${empty ? "border-red-200 bg-red-50 text-red-700" : low ? "border-yellow-200 bg-yellow-50 text-yellow-700" : "border-green-200 bg-green-50 text-green-700"}`}>{status}</span>
      </div>
      <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"><Star size={15} className="mr-1 inline" /> {stock.Product?.creditCoins || 0} credit coins per unit</div>
      {variants.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="block"><span className="text-sm font-medium text-slate-600">Variant</span><select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={selectedVariantName} onChange={(e) => { const next = variants.find((v) => v.variantName === e.target.value); setSelection({ variantName: e.target.value, productVariantId: next?.id, variant: next }); }}><option value="">Select variant</option>{variantNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label className="block"><span className="text-sm font-medium text-slate-600">Color</span><select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" value={selectedVariant?.id || ""} onChange={(e) => { const next = variants.find((v) => String(v.id) === e.target.value); setSelection({ variantName: next?.variantName, productVariantId: next?.id, variant: next }); }}><option value="">Select color</option>{colors.map((v) => <option key={v.id} value={v.id}>{v.colorName}</option>)}</select></label>
      </div>}
      <p className="mt-3 text-sm font-semibold text-slate-700">Available stock: {availableQuantity}</p>
      {stock.Product?.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{stock.Product.description}</p>}
      {stock.description && <p className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-500">{stock.description}</p>}
      <label className="mt-3 block"><span className="text-sm font-medium text-slate-600">Order quantity</span><input className={`mt-1 w-full rounded-md border px-3 py-2 outline-none ${invalid ? "border-red-400 bg-red-50 animate-pulse" : "border-slate-300 focus:border-brand focus:ring-2 focus:ring-cyan-100"}`} type="number" min="1" max={availableQuantity} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
      {invalid && <div className="mt-2 rounded-md bg-red-50 p-2 text-xs font-semibold text-red-700">You cannot order more than available stock. Available quantity: {availableQuantity}</div>}
      {invalid && <div className="mt-3"><Button variant="ghost" onClick={requestMore}>Request More Stock</Button></div>}
    </div>
  );
}

function StockRequestModal({ request, setRequest, onSubmit }) {
  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-slate-900/40 p-4">
      <form onSubmit={onSubmit} className="w-full max-w-lg rounded-md bg-white p-5 shadow-xl">
        <h2 className="font-semibold">Request More Stock</h2>
        <TextField label="Requested quantity" type="number" value={request.requestedQuantity} onChange={(e) => setRequest({ ...request, requestedQuantity: e.target.value })} />
        <label className="mt-4 block"><span className="text-sm font-medium text-slate-600">Message</span><textarea className="mt-1 h-32 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-cyan-100" value={request.message} onChange={(e) => setRequest({ ...request, message: e.target.value })} /></label>
        <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setRequest(null)}>Cancel</Button><Button>Send Request</Button></div>
      </form>
    </div>
  );
}

function DealerInventory({ rows = [], updateLowStockLimit, readOnly = false }) {
  const [limits, setLimits] = useState({});
  return (
    <Section title="My Inventory and low stock limits">
      {rows.length ? <div className="grid gap-4 xl:grid-cols-2">{rows.map((item) => {
        const qty = Number(item.quantity || 0);
        const limit = Number(limits[item.id] ?? item.lowStockLimit ?? 0);
        const status = qty === 0 ? "Out of Stock" : qty <= limit ? "Low Stock" : "Available";
        return (
          <div key={item.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-start gap-3">
              {item.Product?.image ? <img src={fileUrl(item.Product.image)} alt={item.Product?.productName} className="h-16 w-16 rounded-md object-cover" /> : <div className="h-16 w-16 rounded-md bg-slate-100" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><p className="font-semibold text-slate-900">{item.Product?.productName}</p><p className="text-sm text-slate-500">{item.variantName ? `${item.variantName} | ${item.colorName} | ` : ""}Current quantity: {qty}</p></div>
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${status === "Out of Stock" ? "border-red-200 bg-red-50 text-red-700" : status === "Low Stock" ? "border-yellow-200 bg-yellow-50 text-yellow-700" : "border-green-200 bg-green-50 text-green-700"}`}>{status}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <TextField label="Low stock limit" type="number" min="0" value={limit} onChange={(e) => setLimits({ ...limits, [item.id]: e.target.value })} disabled={readOnly} />
                  {readOnly ? <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">Managed by assigned manager</span> : <Button onClick={() => updateLowStockLimit(item.id, limit)}>Save Limit</Button>}
                </div>
              </div>
            </div>
          </div>
        );
      })}</div> : <Empty text="No inventory received yet" />}
    </Section>
  );
}

function DealerSales({ inventory = [], sales = [], form, setForm, onSubmit, filter, setFilter, error, readOnly = false }) {
  const selected = inventory.find((item) => String(item.id) === String(form.inventoryId || form.productId));
  const filtered = sales.filter((sale) => (!filter.date || sale.saleDate === filter.date) && (!filter.productId || String(sale.productId) === String(filter.productId)));
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const todayTotal = sales.filter((s) => s.saleDate === today).reduce((sum, s) => sum + Number(s.quantitySold || 0), 0);
  const monthTotal = sales.filter((s) => String(s.saleDate).startsWith(month)).reduce((sum, s) => sum + Number(s.quantitySold || 0), 0);
  const topProducts = Object.values(sales.reduce((acc, sale) => {
    const key = sale.productId;
    acc[key] = acc[key] || { name: sale.Product?.productName || `Product #${key}`, qty: 0 };
    acc[key].qty += Number(sale.quantitySold || 0);
    return acc;
  }, {})).sort((a, b) => b.qty - a.qty).slice(0, 3);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card label="Today Units Sold" value={todayTotal} />
        <Card label="This Month Units" value={monthTotal} />
        <Card label="Low Stock After Sales" value={inventory.filter((item) => Number(item.quantity) <= Number(item.lowStockLimit || 0)).length} />
        <Card label="Products Sold" value={topProducts.length} />
      </div>
      <Section title="Record sale">
        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        <FormGrid onSubmit={onSubmit}>
          <TextField label="Sale date" type="date" value={form.saleDate} onChange={(e) => setForm({ ...form, saleDate: e.target.value })} required />
          <label className="block"><span className="text-sm font-semibold text-slate-600">Product</span><select className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2.5 text-sm" value={form.inventoryId || ""} onChange={(e) => { const item = inventory.find((row) => String(row.id) === e.target.value); setForm({ ...form, inventoryId: e.target.value, productId: item?.productId || "" }); }} required><option value="">Select product</option>{inventory.map((item) => <option key={item.id} value={item.id}>{item.Product?.productName} {item.variantName ? `- ${item.variantName} - ${item.colorName}` : ""} ({item.quantity} available)</option>)}</select></label>
          <TextField label="Quantity sold" type="number" min="1" max={selected?.quantity || 0} value={form.quantitySold} onChange={(e) => setForm({ ...form, quantitySold: e.target.value })} required />
          <TextField label="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          {selected && <div className="md:col-span-2 rounded-md bg-slate-50 p-3 text-sm font-semibold text-slate-700">Current available quantity: {selected.quantity}</div>}
          {selected && Number(form.quantitySold || 0) > Number(selected.quantity || 0) && <div className="md:col-span-2 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">You cannot sell more than available inventory stock.</div>}
          <div className="md:col-span-2">{readOnly ? <span className="inline-flex rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">Managed by assigned manager</span> : <Button type="submit">Record Sale</Button>}</div>
        </FormGrid>
      </Section>
      <Section title="Sales history" actions={<div className="flex flex-wrap gap-2"><input className="rounded-md border border-slate-200 px-3 py-2 text-sm" type="date" value={filter.date} onChange={(e) => setFilter({ ...filter, date: e.target.value })} /><select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={filter.productId} onChange={(e) => setFilter({ ...filter, productId: e.target.value })}><option value="">All products</option>{inventory.map((item) => <option key={item.id} value={item.productId}>{item.Product?.productName}</option>)}</select></div>}>
        {topProducts.length > 0 && <div className="mb-4 flex flex-wrap gap-2">{topProducts.map((p) => <span key={p.name} className="rounded-full bg-cyan-50 px-3 py-1 text-sm font-semibold text-brand">{p.name}: {p.qty}</span>)}</div>}
        {filtered.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{["Date", "Product", "Variant", "Color", "Sold", "Before", "After", "Remarks", "Created"].map((h) => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map((sale) => <tr key={sale.id} className="border-t border-slate-100"><td className="p-3">{sale.saleDate}</td><td className="p-3"><div className="flex items-center gap-2">{sale.Product?.image && <img src={fileUrl(sale.Product.image)} alt="" className="h-9 w-9 rounded-md object-cover" />}<span>{sale.Product?.productName}</span></div></td><td>{sale.variantName || "-"}</td><td>{sale.colorName || "-"}</td><td>{sale.quantitySold}</td><td>{sale.stockBefore}</td><td>{sale.stockAfter}</td><td>{sale.remarks || "-"}</td><td>{new Date(sale.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <Empty text="No sales recorded yet" />}
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

function CreditStore({ store = {}, redemptions = [], transactions = [], reload }) {
  const [filters, setFilters] = useState({ search: "", category: "", affordable: false });
  const [confirmReward, setConfirmReward] = useState(null);
  const wallet = store.wallet || {};
  const rewards = (store.rewards || []).filter((reward) => {
    const matchesSearch = !filters.search || reward.title?.toLowerCase().includes(filters.search.toLowerCase());
    const matchesCategory = !filters.category || reward.category === filters.category;
    const affordable = !filters.affordable || Number(reward.requiredCoins) <= Number(wallet.balance || 0);
    return matchesSearch && matchesCategory && affordable;
  });
  const redeem = async () => {
    if (!confirmReward) return;
    await api.post(`/dealer/credit/redeem/${confirmReward.id}`);
    setConfirmReward(null);
    alert("Reward redeemed successfully");
    reload();
  };
  return (
    <div className="space-y-6">
      <div className="rounded-md bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-500 p-6 text-white shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm font-semibold text-white/80">Credit Wallet</p><p className="mt-2 text-4xl font-semibold">{wallet.balance || 0} coins</p><p className="mt-2 text-sm text-white/80">Earned {wallet.totalEarned || 0} | Redeemed {wallet.totalRedeemed || 0}</p></div>
          <div className="grid h-14 w-14 place-items-center rounded-md bg-white/15"><Star size={28} /></div>
        </div>
      </div>
      <Section title="Credit rewards" actions={<div className="flex flex-wrap gap-2"><input className="rounded-md border border-slate-200 px-3 py-2 text-sm" placeholder="Search rewards" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /><select className="rounded-md border border-slate-200 px-3 py-2 text-sm" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{(store.categories || []).map((category) => <option key={category} value={category}>{category}</option>)}</select><label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" checked={filters.affordable} onChange={(e) => setFilters({ ...filters, affordable: e.target.checked })} /> Affordable</label></div>}>
        {rewards.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rewards.map((reward) => {
          const affordable = Number(wallet.balance || 0) >= Number(reward.requiredCoins || 0);
          const available = Number(reward.quantity || 0) > 0;
          return <div key={reward.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">{reward.image ? <img src={fileUrl(reward.image)} alt={reward.title} className="mb-3 h-36 w-full rounded-md object-cover" /> : <div className="mb-3 grid h-36 place-items-center rounded-md bg-slate-100"><Gift className="text-slate-400" /></div>}<div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{reward.title}</p><p className="text-sm text-slate-500">{reward.category || "General"}</p></div><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${affordable ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{affordable ? "Affordable" : "Need more coins"}</span></div><p className="mt-2 line-clamp-3 text-sm text-slate-600">{reward.description}</p><p className="mt-3 font-semibold">{reward.requiredCoins} coins | {reward.quantity} available</p><Button className="mt-3 w-full" disabled={!affordable || !available} onClick={() => setConfirmReward(reward)}>Redeem</Button></div>;
        })}</div> : <Empty text="No rewards found" />}
      </Section>
      <Table title="Redemption history" rows={redemptions.map((r) => ({ reward: r.reward?.title, coins: r.coinsUsed, status: r.status, requested: r.requestedAt ? new Date(r.requestedAt).toLocaleString() : "", expectedProvideDate: r.expectedProvideDate || "-", providedAt: r.providedAt ? new Date(r.providedAt).toLocaleString() : "-", adminNote: r.adminNote || "-" }))} cols={["reward", "coins", "status", "requested", "expectedProvideDate", "providedAt", "adminNote"]} />
      <Table title="Credit transactions" rows={transactions.map((t) => ({ type: t.type, coins: t.coins, before: t.balanceBefore, after: t.balanceAfter, description: t.description, date: new Date(t.createdAt).toLocaleString() }))} cols={["type", "coins", "before", "after", "description", "date"]} />
      {confirmReward && <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/40 p-4"><div className="w-full max-w-md rounded-md bg-white p-5 shadow-xl"><h2 className="font-semibold">Redeem reward</h2><p className="mt-2 text-sm text-slate-600">Redeem {confirmReward.title} for {confirmReward.requiredCoins} coins?</p><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmReward(null)}>Cancel</Button><Button onClick={redeem}>Confirm Redeem</Button></div></div></div>}
    </div>
  );
}

function Table({ title, rows = [], cols, renderCell }) {
  return <Section title={title}>{rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{cols.map((c) => <th className="p-3" key={c}>{c}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id || i} className="border-t border-slate-100">{cols.map((c) => <td className="p-3" key={c}>{renderCell ? renderCell(row, c) : String(row[c] ?? "")}</td>)}</tr>)}</tbody></table></div> : <Empty />}</Section>;
}

function Orders({ rows, filter, setFilter, search, setSearch }) {
  const filtered = useMemo(() => rows.filter((order) => {
    const inDelivery = ["packing", "shipping", "out_for_delivery"].includes(order.status);
    const matchesFilter = filter === "all" || order.status === filter || (filter === "delivery" && inDelivery);
    const haystack = `${order.orderNumber} ${order.items?.map((i) => i.Product?.productName).join(" ")}`.toLowerCase();
    return matchesFilter && haystack.includes(search.toLowerCase());
  }), [rows, filter, search]);
  return <Section title="My orders" actions={<input className="rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Search order/product" value={search} onChange={(e) => setSearch(e.target.value)} />}><div className="mb-4 flex flex-wrap gap-2">{["all", "pending", "approved", "delivery", "delivered", "rejected"].map((status) => <button key={status} onClick={() => setFilter(status)} className={`rounded-full px-3 py-1 text-sm font-semibold ${filter === status ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>{status.replaceAll("_", " ")}</button>)}</div>{filtered.length ? <div className="space-y-4">{filtered.map((order) => <OrderCard key={order.id} order={order} />)}</div> : <Empty />}</Section>;
}

function OrderCard({ order }) {
  const summary = order.items?.map((i) => `${i.Product?.productName}${i.variantName ? ` - ${i.variantName}/${i.colorName}` : ""} x ${i.quantity}`).join(", ");
  return <div className="rounded-md border border-slate-200 bg-white p-4 shadow-soft transition hover:shadow-lg"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{summary || "Order"}</p><p className="text-sm text-slate-500">Order Date: {new Date(order.createdAt).toLocaleString()}</p><p className="mt-1 text-xs text-slate-400">Reference: {order.orderNumber}</p></div><div className="flex flex-wrap gap-2"><StatusBadge value={order.status} /><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">{formatMoney(order.totalAmount)}</span></div></div><DeliveryTimeline order={order} /><div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm"><span>Expected delivery: {order.deliveredDate || "-"}</span><Button variant="ghost">View Details</Button></div></div>;
}

function DeliveryBoard({ rows }) {
  return <Section title="Delivery tracking">{rows.length ? <div className="grid gap-4 xl:grid-cols-2">{rows.map((order) => { const summary = order.items?.map((i) => `${i.Product?.productName}${i.variantName ? ` - ${i.variantName}/${i.colorName}` : ""} x ${i.quantity}`).join(", "); return <div key={order.id} className="rounded-md border border-slate-200 bg-white p-4 shadow-soft transition hover:shadow-lg"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{summary || "Delivery"}</p><p className="text-sm text-slate-500">Reference: {order.orderNumber}</p></div><StatusBadge value={order.status} /></div><DeliveryTimeline order={order} /><p className="mt-3 text-sm text-slate-500">Days left until delivered: {order.daysLeftUntilDelivered ?? "-"}</p></div>; })}</div> : <Empty />}</Section>;
}

function DeliveryLine({ order }) {
  const steps = ["packing", "shipping", "out_for_delivery", "delivered"];
  const activeIndex = Math.max(steps.indexOf(order.status), order.status === "approved" ? 0 : -1);
  return <div className="mt-4"><div className="mb-2 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-brand" style={{ width: `${order.progressPercentage ?? order.deliveryProgress ?? 0}%` }} /></div><div className="grid grid-cols-4 gap-2">{steps.map((step, index) => <div key={step} className="text-center text-xs"><span className={`mx-auto mb-1 block h-4 w-4 rounded-full border ${index < activeIndex || order.status === "delivered" ? "border-green-600 bg-green-600" : index === activeIndex ? "border-brand bg-brand" : "border-slate-300 bg-white"}`} /><span className={index <= activeIndex ? "font-semibold text-slate-700" : "text-slate-400"}>{step.replaceAll("_", " ")}</span></div>)}</div></div>;
}

function StatusBadge({ value }) {
  const tone = { pending: "bg-yellow-50 text-yellow-700 border-yellow-200", approved: "bg-blue-50 text-blue-700 border-blue-200", packing: "bg-purple-50 text-purple-700 border-purple-200", shipping: "bg-indigo-50 text-indigo-700 border-indigo-200", out_for_delivery: "bg-orange-50 text-orange-700 border-orange-200", delivered: "bg-green-50 text-green-700 border-green-200", rejected: "bg-red-50 text-red-700 border-red-200" }[value] || "bg-slate-50 text-slate-600 border-slate-200";
  return <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${tone}`}>{value?.replaceAll("_", " ")}</span>;
}

function DealerFinance({ rows = [], pay, readOnly = false }) {
  const [tab, setTab] = useState("unpaid");
  const visible = rows.filter((p) => tab === "all" || (tab === "unpaid" ? p.paymentStatus === "pending" : p.paymentStatus === "paid"));
  return <Section title="Payment requests and history" actions={<div className="flex gap-2">{["unpaid", "paid", "all"].map((item) => <button key={item} onClick={() => setTab(item)} className={`rounded-full px-3 py-1 text-sm font-semibold ${tab === item ? "bg-brand text-white" : "bg-slate-100 text-slate-600"}`}>{item}</button>)}</div>}>{visible.length ? <div className="space-y-4">{visible.map((p) => <div key={p.id} className="rounded-md border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{p.invoiceNumber || `Invoice #${p.id}`} · {formatMoney(p.amount)}</p><p className="text-sm text-slate-500">Order {p.orderNumber || p.Order?.orderNumber || p.orderId} · approved {p.orderApprovedAt ? new Date(p.orderApprovedAt).toLocaleDateString() : "-"}</p><p className="mt-1 text-sm text-slate-500"><FinanceBadge value={p.paymentStatus} /> {p.paymentStatus === "pending" && <span className="ml-2 font-semibold text-amber-700">{p.daysUnpaid || 0} days unpaid</span>}</p><p className="mt-1 text-xs text-slate-500">{p.productSummary || p.Order?.items?.map((i) => `${i.Product?.productName}${i.variantName ? ` - ${i.variantName}/${i.colorName}` : ""} x ${i.quantity}`).join(", ")}</p></div><div className="flex flex-wrap items-center gap-2">{p.invoiceFile && <a className="rounded-md border border-slate-200 px-3 py-2 text-sm text-indigo-700" href={fileUrl(p.invoiceFile)} target="_blank">View Invoice</a>}{p.paymentStatus === "pending" ? <><Button onClick={() => pay(p.id, "online")}>Pay Online</Button><Button variant="ghost" onClick={() => pay(p.id, "cash")}>Cash Paid</Button></> : <span className="rounded-md bg-green-50 px-3 py-2 text-sm font-semibold text-green-700">Paid <FinanceBadge value={p.paymentMethod} /></span>}</div></div>{p.transactionId && <p className="mt-2 text-xs text-slate-500">Transaction: {p.transactionId}</p>}{p.paidAt && <p className="mt-1 text-xs text-slate-500">Paid at: {new Date(p.paidAt).toLocaleString()}</p>}{p.creditAwarded && <p className="mt-1 text-xs font-semibold text-emerald-700">Credit coins awarded</p>}</div>)}</div> : <Empty text="No payment requests yet" />}</Section>;
}

function FinanceBadge({ value }) {
  const tone = String(value || "").toLowerCase();
  const classes = tone === "paid" ? "border-green-200 bg-green-50 text-green-700" : tone === "pending" ? "border-yellow-200 bg-yellow-50 text-yellow-700" : ["failed", "rejected"].includes(tone) ? "border-red-200 bg-red-50 text-red-700" : tone === "online" ? "border-cyan-200 bg-cyan-50 text-brand" : tone === "cash" ? "border-slate-200 bg-slate-100 text-slate-700" : "border-slate-200 bg-slate-50 text-slate-600";
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${classes}`}>{value || "-"}</span>;
}

function DealerChat({ messages = [], reply, setReply, sendReply }) {
  return <Section title="Messages"><div className="mb-4 h-96 space-y-3 overflow-y-auto rounded-md bg-slate-50 p-4">{messages.length ? messages.map((m) => { const mine = m.title === "Dealer reply" || m.title === "Payment update" || m.messageType === "stock_request"; return <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-md px-3 py-2 text-sm ${mine ? "bg-brand text-white" : "border border-slate-200 bg-white"}`}><p>{m.message}</p>{m.messageType === "stock_request" && <p className="mt-1 text-[11px] opacity-80">Requested: {m.requestedQuantity}, available: {m.availableStock}</p>}<p className="mt-1 text-[11px] opacity-75">{new Date(m.createdAt).toLocaleString()}</p></div></div>; }) : <Empty text="No messages yet" />}</div><form onSubmit={sendReply} className="flex gap-2"><input className="flex-1 rounded-md border border-slate-300 px-3 py-2" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to admin" required /><Button>Reply</Button></form></Section>;
}
