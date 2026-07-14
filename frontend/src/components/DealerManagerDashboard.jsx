import { useEffect, useMemo, useState } from "react";
import { Crown, Medal, RefreshCw } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import { Button, Card, Empty, Loading, Section, Select, StatusBadge, TextField, formatDate, formatMoney } from "./UI";

const palette = ["#10B981", "#F59E0B", "#E11D48", "#2563EB", "#64748B"];
const periodLabels = { current: "Current Stock", today: "Today", week: "This Week", month: "This Month", custom: "Custom Range" };

export default function DealerManagerDashboard({ initialData, fallbackCards = [] }) {
  const [data, setData] = useState(initialData || null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("current");
  const [custom, setCustom] = useState({ startDate: "", endDate: "" });
  const [dealerFilters, setDealerFilters] = useState({ area: "", city: "", dealerStatus: "", dealerCreatedStart: "", dealerCreatedEnd: "" });
  const [rankMetric, setRankMetric] = useState("purchase");
  useEffect(() => { if (initialData) setData(initialData); }, [initialData]);

  const refresh = async (overrides = {}) => {
    setLoading(true);
    try {
      const params = { period, ...dealerFilters, ...(period === "custom" ? custom : {}), ...overrides };
      Object.keys(params).forEach((key) => !params[key] && delete params[key]);
      const response = await api.get("/admin/dashboard/analytics", { params });
      setData(response.data);
    } finally { setLoading(false); }
  };
  const changePeriod = (value) => { setPeriod(value); if (value !== "custom") refresh({ period: value, startDate: undefined, endDate: undefined }); };

  if (!data) return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{fallbackCards.map(([label, value]) => <Card key={label} label={label} value={value} />)}</div>;
  const summary = data.summary || {};
  const inventory = data.inventoryStats || {};
  const finance = data.financeStats || {};
  const dealers = data.dealerStats || {};
  const sales = data.salesStats || {};
  const summaryCards = [
    ["Total Dealers", summary.totalDealers], ["Total Products", summary.totalProducts], ["Total Company Stock", summary.totalCompanyStock],
    ["Low Stock Products", summary.lowStockProducts], ["Pending Orders", summary.pendingOrders], ["Approved Orders", summary.approvedOrders],
    ["Delivered Orders", summary.deliveredOrders], ["Pending Payments", summary.pendingPayments], ["Total Revenue", formatMoney(summary.totalRevenue)],
    ["Total Pending Amount", formatMoney(summary.totalPendingAmount)]
  ];
  const stockRows = period === "current" ? inventory.topHighestStockProducts || [] : inventory.topActivityProducts || [];
  const stockMetric = period === "current" ? "quantity" : "salesQuantity";
  const ranking = rankMetric === "sales" ? dealers.topBySales || [] : rankMetric === "orders" ? dealers.topByOrderCount || [] : dealers.topByPurchase || [];
  const areaRows = dealers.areaWiseDealerCount || [];

  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{summaryCards.map(([label, value]) => <Card key={label} label={label} value={value ?? 0} />)}</div>
    <Section title="Analytics Filters" actions={<Button variant="ghost" onClick={() => refresh()} disabled={loading}><RefreshCw size={16} /> Refresh</Button>}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Select label="Stock / Sales Period" value={period} onChange={(event) => changePeriod(event.target.value)}>{Object.entries(periodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <Select label="Area" value={dealerFilters.area} onChange={(event) => setDealerFilters({ ...dealerFilters, area: event.target.value, city: "" })}><option value="">All areas</option>{(dealers.areas || []).map((area) => <option key={area}>{area}</option>)}</Select>
        <Select label="City" value={dealerFilters.city} onChange={(event) => setDealerFilters({ ...dealerFilters, city: event.target.value })}><option value="">All cities</option>{(dealers.cities || []).map((city) => <option key={city}>{city}</option>)}</Select>
        <Select label="Dealer Status" value={dealerFilters.dealerStatus} onChange={(event) => setDealerFilters({ ...dealerFilters, dealerStatus: event.target.value })}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="blocked">Blocked</option></Select>
        <TextField label="Dealer Created From" type="date" value={dealerFilters.dealerCreatedStart} onChange={(event) => setDealerFilters({ ...dealerFilters, dealerCreatedStart: event.target.value })} />
        <TextField label="Dealer Created To" type="date" value={dealerFilters.dealerCreatedEnd} onChange={(event) => setDealerFilters({ ...dealerFilters, dealerCreatedEnd: event.target.value })} />
      </div>
      {period === "custom" && <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]"><TextField label="Start Date" type="date" value={custom.startDate} onChange={(event) => setCustom({ ...custom, startDate: event.target.value })} /><TextField label="End Date" type="date" value={custom.endDate} onChange={(event) => setCustom({ ...custom, endDate: event.target.value })} /><div className="self-end"><Button onClick={() => refresh()}>Apply Custom Range</Button></div></div>}
      <div className="mt-4"><Button onClick={() => refresh()}>Apply Dealer Filters</Button></div>
    </Section>
    {loading && <Loading />}

    <div className="grid gap-6 xl:grid-cols-2">
      <ChartSection title="Order Analytics">{(data.orderStatusCounts || []).length ? <ResponsiveContainer width="100%" height="100%"><RadarChart data={data.orderStatusCounts} outerRadius="72%"><PolarGrid stroke="#CBD5E1" /><PolarAngleAxis dataKey="status" tickFormatter={(value) => String(value).replaceAll("_", " ")} tick={{ fill: "#475569", fontSize: 11 }} /><PolarRadiusAxis allowDecimals={false} tick={{ fill: "#64748B", fontSize: 10 }} /><Tooltip /><Radar name="Orders" dataKey="count" stroke="#4F46E5" strokeWidth={2} fill="#4F46E5" fillOpacity={0.2} animationDuration={500} /></RadarChart></ResponsiveContainer> : <Empty text="No orders in this period" />}</ChartSection>
      <ChartSection title="Payment Status Ratio">{(finance.paymentStatusRatio || []).length ? <><ResponsiveContainer width="100%" height="82%"><PieChart><Pie data={finance.paymentStatusRatio} dataKey="count" nameKey="status" innerRadius={62} outerRadius={96} paddingAngle={3} animationDuration={500}>{finance.paymentStatusRatio.map((row, index) => <Cell key={row.status} fill={row.status === "paid" ? "#10B981" : row.status === "pending" ? "#F59E0B" : palette[index % palette.length]} />)}</Pie><Tooltip formatter={(value, name) => [`${value} payments`, String(name).replaceAll("_", " ")]} /></PieChart></ResponsiveContainer><RatioLegend rows={finance.paymentStatusRatio} /></> : <Empty text="No payment records in this period" />}</ChartSection>
      <ChartSection title="Top 5 Highest Stock Products" subtitle={inventory.selectedMetric || periodLabels[period]}>{stockRows.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={stockRows} margin={{ left: 8, right: 12, bottom: 38 }}><defs><linearGradient id="stockFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.32} /><stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.03} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="productName" angle={-20} textAnchor="end" height={58} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip formatter={(value, name) => [value, name === "quantity" ? "Available Stock" : "Units Sold"]} /><Area type="monotone" dataKey={stockMetric} stroke="#0EA5E9" strokeWidth={2.5} fill="url(#stockFill)" animationDuration={500} /></AreaChart></ResponsiveContainer> : <Empty text="No product activity for the selected period" />}</ChartSection>
      <ChartSection title="Top 5 Low Stock Products">{(inventory.topLowStockProducts || []).length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={inventory.topLowStockProducts} layout="vertical" margin={{ left: 28, right: 18 }}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="productName" width={110} tick={{ fontSize: 10 }} /><Tooltip formatter={(value, name) => [value, name === "quantity" ? "Current Stock" : "Low Stock Limit"]} /><Legend /><Bar dataKey="quantity" name="Current Stock" fill="#F59E0B" radius={[0, 5, 5, 0]} /><Bar dataKey="lowStockLimit" name="Low Stock Limit" fill="#64748B" fillOpacity={0.45} radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer> : <Empty text="No low-stock products" />}</ChartSection>
      <ChartSection title="Area-wise Dealer Count">{areaRows.length ? <ResponsiveContainer width="100%" height="100%">{areaRows.length < 6 ? <BarChart data={areaRows} margin={{ left: 8, right: 12, bottom: 30 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="area" angle={-15} textAnchor="end" height={48} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#2563EB" fillOpacity={0.82} radius={[6, 6, 0, 0]} /></BarChart> : <BarChart data={areaRows.slice(0, 10)} layout="vertical" margin={{ left: 30, right: 12 }}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="area" width={110} /><Tooltip /><Bar dataKey="count" fill="#2563EB" fillOpacity={0.82} radius={[0, 6, 6, 0]} /></BarChart>}</ResponsiveContainer> : <Empty text="No dealer areas found" />}</ChartSection>
      <ChartSection title="Top Selling Products">{(sales.topSellingProducts || []).length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={sales.topSellingProducts} margin={{ left: 8, right: 12, bottom: 38 }}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10B981" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="productName" angle={-20} textAnchor="end" height={58} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="quantitySold" name="Units Sold" stroke="#10B981" strokeWidth={2.5} fill="url(#salesFill)" animationDuration={500} /></AreaChart></ResponsiveContainer> : <Empty text="No product sales in this period" />}</ChartSection>
    </div>

    <Section title="Top 5 Dealers" actions={<Select label="" value={rankMetric} onChange={(event) => setRankMetric(event.target.value)}><option value="purchase">Top by Purchase</option><option value="sales">Top by Sales</option><option value="orders">Top by Order Count</option></Select>}>
      {ranking.length ? <div className="grid gap-3 lg:grid-cols-5">{ranking.map((dealer, index) => <RankCard key={dealer.dealerId} dealer={dealer} rank={index + 1} metric={rankMetric} />)}</div> : <Empty text="No dealer ranking data for this period" />}
    </Section>
    <ChartSection title="Dealer Stock Summary" standalone>{(inventory.dealerWiseStockSummary || []).length ? <><ResponsiveContainer width="100%" height="88%"><BarChart data={inventory.dealerWiseStockSummary} margin={{ left: 8, right: 12, bottom: 38 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dealerName" angle={-18} textAnchor="end" height={58} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip content={({ active, payload }) => active && payload?.length ? <div className="rounded-lg border bg-white p-3 text-sm shadow-lg"><p className="font-semibold">{payload[0].payload.dealerName}</p><p className="text-slate-500">{[payload[0].payload.area, payload[0].payload.city].filter(Boolean).join(", ")}</p><p>Stock: {payload[0].value}</p></div> : null} /><Bar dataKey="quantity" name="Current Stock" fill="#4F46E5" fillOpacity={0.82} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>{inventory.dealerWiseStockSummary.every((row) => Number(row.quantity) === 0) && <p className="text-center text-sm text-slate-500">Dealers are shown for comparison; current recorded stock is zero.</p>}</> : <Empty text="No dealers found" />}</ChartSection>
    <Section title="Recent Orders"><RecentOrders rows={data.recentOrders || []} /></Section>
  </div>;
}

function ChartSection({ title, subtitle, children, standalone }) { const content = <div className="h-[340px] min-w-0">{subtitle && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{subtitle}</p>}<div className={subtitle ? "h-[310px]" : "h-full"}>{children}</div></div>; return standalone ? <Section title={title}>{content}</Section> : <Section title={title}>{content}</Section>; }
function RatioLegend({ rows }) { const total = rows.reduce((sum, row) => sum + Number(row.count || 0), 0); return <div className="flex flex-wrap justify-center gap-3">{rows.map((row) => <span key={row.status} className="text-xs font-semibold text-slate-600">{String(row.status).replaceAll("_", " ")}: {row.count} ({total ? Math.round((row.count / total) * 100) : 0}%)</span>)}</div>; }
function RankCard({ dealer, rank, metric }) { const Icon = rank === 1 ? Crown : rank <= 3 ? Medal : null; const tone = rank === 1 ? "border-amber-200 bg-amber-50/50" : rank === 2 ? "border-slate-300 bg-slate-50" : rank === 3 ? "border-orange-200 bg-orange-50/40" : "border-slate-200 bg-white"; const value = metric === "sales" ? `${dealer.salesUnits || 0} units` : metric === "orders" ? `${dealer.orderCount || 0} orders` : formatMoney(dealer.purchaseAmount || 0); return <div className={`rounded-xl border p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md ${tone}`}><div className="flex items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-bold text-slate-700 shadow-sm">{Icon ? <Icon size={17} className={rank === 1 ? "text-amber-600" : rank === 2 ? "text-slate-500" : "text-orange-600"} /> : rank}</span><span className="text-xs font-bold text-slate-400">#{rank}</span></div><p className="mt-3 font-semibold text-slate-950">{dealer.dealerName}</p><p className="text-xs text-slate-500">{[dealer.area, dealer.city].filter(Boolean).join(" / ") || "Location unavailable"}</p><p className="mt-3 text-lg font-bold text-indigo-700">{value}</p><p className="text-xs text-slate-500">{dealer.orderCount || 0} orders</p></div>; }
function RecentOrders({ rows }) { if (!rows.length) return <Empty text="No recent orders" />; return <div className="grid gap-3 xl:grid-cols-2">{rows.map((order) => { const items = order.items || []; const first = items[0]; const product = first?.Product?.productName || "Order"; const extra = Math.max(0, items.length - 1); const quantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0); return <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><p className="font-semibold text-slate-950">{product}{extra ? <span className="ml-2 text-sm font-medium text-indigo-600">+{extra} more products</span> : null}</p><p className="mt-1 text-sm text-slate-500">{order.Dealer?.dealerName || "Dealer"}{order.Dealer?.city ? ` • ${order.Dealer.city}` : ""}</p><p className="mt-2 text-sm text-slate-600">{first?.variantName ? `${first.variantName} / ${first.colorName || "Default"} • ` : ""}Quantity: {quantity}</p><p className="mt-1 text-xs text-slate-400">{formatDate(order.createdAt)} • Ref {order.orderNumber}</p></div><div className="flex max-w-56 flex-wrap justify-end gap-2"><StatusBadge value={order.status} />{["packing", "shipping", "out_for_delivery", "delivered"].includes(order.status) && <StatusBadge value={order.status} />}{order.paymentStatus && <StatusBadge value={`Payment ${order.paymentStatus}`} />}<span className="w-full text-right font-semibold text-slate-900">{formatMoney(order.totalAmount)}</span></div></div></div>; })}</div>; }
