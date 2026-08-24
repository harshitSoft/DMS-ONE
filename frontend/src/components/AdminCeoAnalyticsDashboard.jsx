import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, CreditCard, FileText, Star, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "./UI";

const colors = { Pending: "#F59E0B", Approved: "#3B82F6", Delivered: "#10B981", Cancelled: "#EF4444" };
const cardMeta = {
  dealers: { label: "Dealers", color: "#4F46E5", Icon: Users },
  products: { label: "Products", color: "#F97316", Icon: BarChart3 },
  orders: { label: "Orders", color: "#10B981", Icon: FileText },
  revenue: { label: "Revenue", color: "#8B5CF6", Icon: CreditCard, money: true }
};

export default function AdminCeoAnalyticsDashboard({ payload }) {
  const [period, setPeriod] = useState("year");
  const analytics = payload?.analytics || {};
  const totals = payload?.totals || {};
  const revenueData = useMemo(() => {
    const rows = analytics.revenueTrend || [];
    return period === "today" ? rows.slice(-1) : period === "week" ? rows.slice(-3) : period === "month" ? rows.slice(-6) : rows;
  }, [analytics.revenueTrend, period]);
  const orderStatus = useMemo(() => {
    const grouped = { Pending: 0, Approved: 0, Delivered: 0, Cancelled: 0 };
    Object.entries(payload?.orderStatus || {}).forEach(([status, count]) => {
      const key = status === "pending" ? "Pending" : status === "delivered" ? "Delivered" : ["cancelled", "rejected"].includes(status) ? "Cancelled" : "Approved";
      grouped[key] += Number(count || 0);
    });
    return Object.entries(grouped).map(([name, value]) => ({ name, value, color: colors[name] }));
  }, [payload?.orderStatus]);
  const totalOrders = orderStatus.reduce((sum, row) => sum + row.value, 0);
  const totalRevenue = revenueData.reduce((sum, row) => sum + Number(row.paid || 0), 0);

  return <div className="space-y-6">
    <div className="flex justify-end">
      <label className="flex items-center gap-3 text-sm font-semibold text-slate-600">Date range
        <select value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-xl border border-indigo-100 bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm outline-none focus:ring-4 focus:ring-indigo-100">
          <option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="year">This Year</option>
        </select>
      </label>
    </div>

    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {Object.entries(cardMeta).map(([key, meta], index) => <KpiCard key={key} meta={meta} value={totals[key] || 0} growth={analytics.trends?.[key] || 0} spark={analytics.sparklines?.[key] || []} delay={index * 80} />)}
    </div>

    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartCard title="Revenue Trend" subtitle="Paid vs unpaid revenue" action={`Total: ${formatMoney(totalRevenue)}`}>
        {revenueData.some((row) => row.paid || row.unpaid) ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={revenueData} onClick={(event) => event?.activePayload && console.log("Revenue detail", event.activePayload[0]?.payload)}>
          <defs><linearGradient id="ceoPaid" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4F46E5" stopOpacity={0.55} /><stop offset="95%" stopColor="#4F46E5" stopOpacity={0.02} /></linearGradient><linearGradient id="ceoUnpaid" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F59E0B" stopOpacity={0.5} /><stop offset="95%" stopColor="#F59E0B" stopOpacity={0.02} /></linearGradient></defs>
          <CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" /><XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 12 }} /><YAxis tick={{ fill: "#64748B", fontSize: 11 }} tickFormatter={compactMoney} /><Tooltip content={<MoneyTooltip />} /><Legend /><Area type="monotone" dataKey="paid" stroke="#4F46E5" strokeWidth={3} fill="url(#ceoPaid)" dot={{ r: 3 }} animationDuration={900} /><Area type="monotone" dataKey="unpaid" stroke="#F59E0B" strokeWidth={3} fill="url(#ceoUnpaid)" dot={{ r: 3 }} animationDuration={1100} />
        </AreaChart></ResponsiveContainer> : <EmptyChart Icon={BarChart3} text="No revenue data available" />}
      </ChartCard>

      <ChartCard title="Order Status" subtitle="Current order distribution" action={`${totalOrders} total orders`}>
        {totalOrders ? <div className="relative h-full"><ResponsiveContainer width="100%" height="100%"><PieChart onClick={(event) => event?.activePayload && console.log("Order detail", event.activePayload[0]?.payload)}><Pie data={orderStatus} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="72%" paddingAngle={3} labelLine={false} label={({ name, percent }) => percent ? `${name} ${(percent * 100).toFixed(0)}%` : ""} animationDuration={900}>{orderStatus.map((row) => <Cell key={row.name} fill={row.color} />)}</Pie><Tooltip content={<CountTooltip />} /><Legend verticalAlign="bottom" /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="mb-8 text-center"><p className="text-3xl font-black text-slate-900">{totalOrders}</p><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Orders</p></div></div></div> : <EmptyChart Icon={FileText} text="No orders placed yet" />}
      </ChartCard>
    </div>

    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <ChartCard title="Dealer Performance" subtitle="Top 5 by order volume">
        {(analytics.dealerPerformance || []).length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.dealerPerformance} layout="vertical" margin={{ left: 15, right: 25 }} onClick={(event) => event?.activePayload && console.log("Dealer detail", event.activePayload[0]?.payload)}><defs><linearGradient id="dealerBar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#4F46E5" /><stop offset="100%" stopColor="#9333EA" /></linearGradient></defs><CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" horizontal={false} /><XAxis type="number" tick={{ fill: "#64748B", fontSize: 11 }} /><YAxis type="category" dataKey="name" width={92} tick={{ fill: "#64748B", fontSize: 11 }} /><Tooltip content={<DealerTooltip />} /><Bar dataKey="orders" fill="url(#dealerBar)" radius={[0, 7, 7, 0]} label={{ position: "right", fill: "#475569", fontSize: 11 }} animationDuration={900} /></BarChart></ResponsiveContainer> : <EmptyChart Icon={Users} text="No dealer data available" />}
      </ChartCard>

      <CreditChart data={analytics.creditData || {}} />

      <ChartCard title="Rewards Growth" subtitle="Rewards earned in the last 6 months">
        {(analytics.rewardsTrend || []).some((row) => row.rewards) ? <ResponsiveContainer width="100%" height="100%"><LineChart data={analytics.rewardsTrend}><defs><linearGradient id="rewardLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#4F46E5" /><stop offset="100%" stopColor="#A855F7" /></linearGradient></defs><CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" /><XAxis dataKey="month" tick={{ fill: "#64748B", fontSize: 11 }} /><YAxis tick={{ fill: "#64748B", fontSize: 11 }} /><Tooltip content={<CountTooltip suffix="coins" />} /><Line type="monotone" dataKey="rewards" stroke="url(#rewardLine)" strokeWidth={4} dot={{ r: 5, fill: "#4F46E5", stroke: "white", strokeWidth: 2 }} activeDot={{ r: 7 }} animationDuration={1000} /></LineChart></ResponsiveContainer> : <EmptyChart Icon={Star} text="No rewards data yet" />}
      </ChartCard>
    </div>
  </div>;
}

function KpiCard({ meta, value, growth, spark, delay }) {
  const positive = growth >= 0;
  const TrendIcon = positive ? ArrowUpRight : ArrowDownRight;
  return <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/50 transition duration-300 hover:scale-[1.02] hover:shadow-xl" style={{ borderTop: `4px solid ${meta.color}`, animationDelay: `${delay}ms` }}>
    <div className="flex items-start justify-between"><div><p className="text-sm font-bold text-slate-500">{meta.label}</p><p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{meta.money ? formatMoney(value) : Number(value).toLocaleString("en-IN")}</p></div><span className="grid h-11 w-11 place-items-center rounded-full" style={{ backgroundColor: `${meta.color}14`, color: meta.color }}><meta.Icon size={21} /></span></div>
    <div className="mt-4 flex items-end justify-between gap-3"><div><span className={`inline-flex items-center gap-1 text-sm font-bold ${positive ? "text-emerald-600" : "text-rose-600"}`}><TrendIcon size={16} />{positive ? "+" : ""}{growth}%</span><p className="mt-1 text-xs text-slate-400">vs last month</p></div><div className="h-12 w-28"><ResponsiveContainer><LineChart data={spark}><Line type="monotone" dataKey="value" stroke={meta.color} strokeWidth={2.5} dot={false} animationDuration={700} /></LineChart></ResponsiveContainer></div></div>
  </div>;
}

function CreditChart({ data }) {
  const paid = Number(data.paid || 0), outstanding = Number(data.outstanding || 0), total = paid + outstanding;
  const rows = [{ name: "Paid", value: paid, color: "#10B981" }, { name: "Outstanding", value: outstanding, color: "#EF4444" }];
  return <ChartCard title="Credit Ratio" subtitle={`Total credit ${formatMoney(total)}`}>{total ? <div className="relative h-full"><ResponsiveContainer><PieChart><Pie data={rows} dataKey="value" innerRadius="52%" outerRadius="74%" paddingAngle={3} animationDuration={900}>{rows.map((row) => <Cell key={row.name} fill={row.color} />)}</Pie><Tooltip content={<MoneyTooltip />} /><Legend verticalAlign="bottom" /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="mb-8 text-center"><p className="text-xl font-black text-slate-900">{Math.round((paid / total) * 100)}%</p><p className="text-xs font-semibold text-slate-400">paid</p></div></div></div> : <EmptyChart Icon={CreditCard} text="No credit data available" />}</ChartCard>;
}

function ChartCard({ title, subtitle, action, children }) { return <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/50 transition-shadow hover:shadow-xl"><header className="mb-4 flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-950">{title}</h3><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>{action && <span className="whitespace-nowrap text-xs font-bold text-indigo-600">{action}</span>}</header><div className="h-80 min-w-0">{children}</div></section>; }
function EmptyChart({ Icon, text }) { return <div className="flex h-full flex-col items-center justify-center text-slate-400"><Icon size={46} strokeWidth={1.4} /><p className="mt-3 text-sm font-semibold">{text}</p></div>; }
function TooltipBox({ label, children }) { return <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-xl"><p className="mb-2 font-bold text-slate-900">{label}</p>{children}</div>; }
function MoneyTooltip({ active, payload, label }) { return active && payload?.length ? <TooltipBox label={label || payload[0]?.payload?.name}>{payload.map((row) => <p key={row.dataKey || row.name} style={{ color: row.color || row.payload?.color }}>{row.name}: <strong>{formatMoney(row.value)}</strong></p>)}</TooltipBox> : null; }
function CountTooltip({ active, payload, label, suffix = "orders" }) { return active && payload?.length ? <TooltipBox label={label || payload[0]?.payload?.name}><p className="text-slate-600"><strong>{Number(payload[0].value).toLocaleString("en-IN")}</strong> {suffix}</p></TooltipBox> : null; }
function DealerTooltip({ active, payload }) { const row = payload?.[0]?.payload; return active && row ? <TooltipBox label={row.name}><p>{row.orders} orders</p><p className="text-emerald-600">{formatMoney(row.revenue)} revenue</p></TooltipBox> : null; }
function compactMoney(value) { return `₹${Number(value || 0) >= 100000 ? `${(Number(value) / 100000).toFixed(1)}L` : Number(value || 0) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}K` : value}`; }
