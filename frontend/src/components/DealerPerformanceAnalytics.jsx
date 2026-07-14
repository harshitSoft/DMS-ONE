import { useState } from "react";
import { Crown, Medal, RefreshCw } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, Card, Empty, Section, Select, StatusBadge, TextField, formatDate, formatMoney } from "./UI";

const orderStatuses = ["pending", "approved", "packing", "shipping", "out_for_delivery", "delivered", "rejected"];

export default function DealerPerformanceAnalytics({ data = {}, filters, setFilters, reload }) {
  const summary = data.summary || {};
  const charts = data.charts || {};
  const tables = data.tables || {};
  const filterData = data.filters || {};
  const [rankMetric, setRankMetric] = useState("purchase");
  const [productDates, setProductDates] = useState({ startDate: filters.startDate || "", endDate: filters.endDate || "" });
  const setAndReload = (patch) => { const next = { ...filters, ...patch }; setFilters(next); reload(next); };
  const setPeriod = (period) => {
    const today = new Date();
    let start = new Date(today);
    if (period === "today") start = today;
    if (period === "7days") start.setDate(today.getDate() - 6);
    if (period === "month") start = new Date(today.getFullYear(), today.getMonth(), 1);
    if (period === "3months") start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    setAndReload({ startDate: start.toISOString().slice(0, 10), endDate: today.toISOString().slice(0, 10) });
  };
  const cards = [
    ["Total Purchase Amount", formatMoney(summary.totalPurchaseAmount)], ["Total Orders", summary.totalOrders], ["Delivered Orders", summary.deliveredOrders],
    ["Pending Orders", summary.pendingOrders], ["Total Units Purchased", summary.totalUnitsPurchased], ["Average Order Value", formatMoney(summary.averageOrderValue)],
    ["Paid Amount", formatMoney(summary.totalPaidAmount)], ["Pending Amount", formatMoney(summary.pendingPaymentAmount)],
    ["Current Inventory Quantity", summary.currentInventoryQuantity], ["Low Stock Products", summary.lowStockProducts]
  ];
  const radarData = orderStatuses.map((status) => ({ status, count: charts.orderStatus?.find((row) => row.status === status)?.count || 0 }));
  const ranked = rankMetric === "orders" ? data.topDealers?.byOrders || [] : rankMetric === "units" ? data.topDealers?.byUnits || [] : data.topDealers?.byPurchase || [];

  return <div className="space-y-6">
    <Section title="Dealer Performance Filters">
      <div className="mb-4 flex flex-wrap gap-2">{[["today", "Today"], ["7days", "Last 7 Days"], ["month", "This Month"], ["3months", "Last 3 Months"]].map(([value, label]) => <Button key={value} variant="ghost" onClick={() => setPeriod(value)}>{label}</Button>)}<Button variant="ghost" onClick={() => setAndReload({ startDate: "", endDate: "" })}><RefreshCw size={15} /> Reset Period</Button></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Select label="Area" value={filters.area} onChange={(event) => setAndReload({ area: event.target.value, city: "", dealerId: "" })}><option value="">All areas</option>{(filterData.areas || []).map((area) => <option key={area}>{area}</option>)}</Select>
        <Select label="City" value={filters.city || ""} onChange={(event) => setAndReload({ city: event.target.value, dealerId: "" })}><option value="">All cities</option>{(filterData.cities || []).map((city) => <option key={city}>{city}</option>)}</Select>
        <Select label="Dealer" value={filters.dealerId} onChange={(event) => setAndReload({ dealerId: event.target.value })}><option value="">All dealers</option>{(filterData.dealers || []).map((dealer) => <option key={dealer.id} value={dealer.id}>{dealer.dealerName}</option>)}</Select>
        <TextField label="Start Date" type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} />
        <TextField label="End Date" type="date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} />
        <div className="self-end"><Button onClick={() => reload(filters)}>Apply Dates</Button></div>
      </div>
    </Section>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{cards.map(([label, value]) => <Card key={label} label={label} value={value ?? 0} />)}</div>

    <div className="grid gap-6 xl:grid-cols-2">
      <PerformanceChart title="Purchase Analytics">{(charts.monthlyPurchases || []).length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={charts.monthlyPurchases} margin={{ left: 26, right: 12, bottom: 20 }}><defs><linearGradient id="purchaseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4F46E5" stopOpacity={0.32} /><stop offset="95%" stopColor="#4F46E5" stopOpacity={0.03} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis width={82} tickFormatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} /><Tooltip formatter={(value) => formatMoney(value)} /><Area type="monotone" dataKey="value" name="Purchase Amount" stroke="#4F46E5" strokeWidth={2.5} fill="url(#purchaseFill)" animationDuration={500} /></AreaChart></ResponsiveContainer> : <Empty text="No purchases in this period" />}</PerformanceChart>
      <PerformanceChart title="Order Status">{radarData.some((row) => row.count) ? <ResponsiveContainer width="100%" height="100%"><RadarChart data={radarData} outerRadius="72%"><PolarGrid /><PolarAngleAxis dataKey="status" tickFormatter={(value) => value.replaceAll("_", " ")} tick={{ fontSize: 10, fill: "#475569" }} /><PolarRadiusAxis allowDecimals={false} /><Tooltip /><Radar dataKey="count" name="Orders" stroke="#2563EB" strokeWidth={2} fill="#2563EB" fillOpacity={0.2} animationDuration={500} /></RadarChart></ResponsiveContainer> : <Empty text="No order status data" />}</PerformanceChart>
      <PerformanceChart title="Payment Status Ratio"><Donut rows={charts.paymentStatus || []} /></PerformanceChart>
      <PerformanceChart title="Monthly Sales Trend">{(charts.monthlySales || []).length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={charts.monthlySales}><defs><linearGradient id="monthlySalesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10B981" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="value" name="Units Sold" stroke="#10B981" strokeWidth={2.5} fill="url(#monthlySalesFill)" /></AreaChart></ResponsiveContainer> : <Empty text="No dealer sales in this period" />}</PerformanceChart>
    </div>

    <Section title="Top 5 Dealers with Highest Purchase" actions={<Select label="" value={rankMetric} onChange={(event) => setRankMetric(event.target.value)}><option value="purchase">Purchase Amount</option><option value="orders">Order Count</option><option value="units">Units Purchased</option></Select>}>
      {ranked.length ? <div className="grid gap-3 lg:grid-cols-5">{ranked.map((dealer, index) => <DealerRank key={dealer.dealerId} dealer={dealer} rank={index + 1} metric={rankMetric} />)}</div> : <Empty text="No dealer purchase data for the selected filters" />}
    </Section>

    <Section title="Product-wise Purchase" actions={<div className="flex flex-wrap items-end gap-2"><TextField label="Start Date" type="date" value={productDates.startDate} onChange={(event) => setProductDates({ ...productDates, startDate: event.target.value })} /><TextField label="End Date" type="date" value={productDates.endDate} onChange={(event) => setProductDates({ ...productDates, endDate: event.target.value })} /><Select label="Product" value={filters.productId} onChange={(event) => setFilters({ ...filters, productId: event.target.value })}><option value="">All products</option>{(filterData.products || []).map((product) => <option key={product.id} value={product.id}>{product.productName}</option>)}</Select><Button onClick={() => setAndReload({ ...productDates, productId: filters.productId })}>Apply</Button><Button variant="ghost" onClick={() => { setProductDates({ startDate: "", endDate: "" }); setAndReload({ startDate: "", endDate: "", productId: "" }); }}>Reset</Button></div>}>
      {(charts.productWisePurchases || []).length ? <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={charts.productWisePurchases} margin={{ left: 12, right: 12, bottom: 45 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="productName" angle={-20} textAnchor="end" height={62} tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="quantity" name="Units Purchased" fill="#0EA5E9" fillOpacity={0.82} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <Empty text="No product purchases in this period" />}
    </Section>
    <Section title="Recent Orders"><RecentPerformanceOrders rows={tables.recentOrders || []} payments={tables.recentPayments || []} /></Section>
  </div>;
}

function PerformanceChart({ title, children }) { return <Section title={title}><div className="h-[330px] min-w-0">{children}</div></Section>; }
function Donut({ rows }) { if (!rows.length) return <Empty text="No payment records in this period" />; return <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={rows} dataKey="count" nameKey="status" innerRadius={62} outerRadius={98} paddingAngle={3}>{rows.map((row, index) => <Cell key={`${row.status}-${index}`} fill={row.status === "paid" ? "#10B981" : row.status === "pending" ? "#F59E0B" : ["#2563EB", "#64748B", "#E11D48"][index % 3]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>; }
function DealerRank({ dealer, rank, metric }) { const Icon = rank === 1 ? Crown : rank <= 3 ? Medal : null; const value = metric === "orders" ? `${dealer.orderCount} orders` : metric === "units" ? `${dealer.unitsPurchased} units` : formatMoney(dealer.purchaseAmount); return <div className={`rounded-xl border p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-md ${rank === 1 ? "border-amber-200 bg-amber-50/50" : rank === 2 ? "border-slate-300 bg-slate-50" : rank === 3 ? "border-orange-200 bg-orange-50/40" : "border-slate-200 bg-white"}`}><div className="flex items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-full bg-white font-bold shadow-sm">{Icon ? <Icon size={17} className={rank === 1 ? "text-amber-600" : rank === 2 ? "text-slate-500" : "text-orange-600"} /> : rank}</span><span className="text-xs font-bold text-slate-400">#{rank}</span></div><p className="mt-3 font-semibold text-slate-950">{dealer.dealerName}</p><p className="text-xs text-slate-500">{[dealer.area, dealer.city].filter(Boolean).join(" / ") || "Location unavailable"}</p><p className="mt-3 text-lg font-bold text-indigo-700">{value}</p><p className="text-xs text-slate-500">{dealer.orderCount} orders • {dealer.unitsPurchased} units</p></div>; }
function RecentPerformanceOrders({ rows, payments }) { if (!rows.length) return <Empty text="No recent orders" />; return <div className="grid gap-3 xl:grid-cols-2">{rows.map((order) => { const items = order.items || []; const first = items[0]; const quantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0); const payment = payments.find((row) => Number(row.orderId) === Number(order.id)); return <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md"><div className="flex flex-wrap justify-between gap-4"><div><p className="font-semibold text-slate-950">{first?.Product?.productName || "Order"}{items.length > 1 && <span className="ml-2 text-sm text-indigo-600">+{items.length - 1} more products</span>}</p><p className="text-sm text-slate-500">{order.Dealer?.dealerName || "Dealer"}</p><p className="mt-2 text-sm text-slate-600">{first?.variantName ? `${first.variantName} / ${first.colorName || "Default"} • ` : ""}Quantity: {quantity}</p><p className="mt-1 text-xs text-slate-400">{formatDate(order.createdAt)} • Ref {order.orderNumber}</p></div><div className="flex max-w-48 flex-wrap justify-end gap-2"><StatusBadge value={order.status} />{payment && <StatusBadge value={`Payment ${payment.paymentStatus}`} />}<p className="w-full text-right font-semibold">{formatMoney(order.totalAmount)}</p></div></div></div>; })}</div>; }
