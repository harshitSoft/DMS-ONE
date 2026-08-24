import { useEffect, useMemo, useState } from "react";
import { Award, Building2, Mail, MapPin, Phone, Search, ShieldCheck, ShoppingCart, TrendingUp, UserRound, Users, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatMoney } from "./UI";

const statusTone = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  blocked: "border-rose-200 bg-rose-50 text-rose-700",
  inactive: "border-slate-200 bg-slate-100 text-slate-600"
};

export default function AdminCeoDealersOverview({ payload, onControlDealer }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedDealer, setSelectedDealer] = useState(null);
  const dealers = payload?.dealers || [];
  const stats = payload?.stats || {};
  const topDealers = stats.topPerformingDealers || [];
  const filteredDealers = useMemo(() => dealers.filter((dealer) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [dealer.dealerName, dealer.ownerName, dealer.email, dealer.phone, dealer.city, dealer.area, dealer.pincode].some((value) => String(value || "").toLowerCase().includes(term));
    return matchesSearch && (status === "all" || dealer.status === status);
  }), [dealers, search, status]);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredDealers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleDealers = filteredDealers.slice((safePage - 1) * pageSize, safePage * pageSize);
  useEffect(() => setPage(1), [search, status]);
  const locationData = Object.entries(payload?.cityCounts || {}).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  const statusData = [
    { name: "Active", value: Number(stats.activeDealers || 0), color: "#10B981" },
    { name: "Blocked", value: Number(stats.blockedDealers || 0), color: "#EF4444" },
    { name: "Inactive", value: Math.max(0, Number(stats.totalDealers || 0) - Number(stats.activeDealers || 0) - Number(stats.blockedDealers || 0)), color: "#94A3B8" }
  ].filter((row) => row.value);

  return <div className="space-y-6">
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon={Users} label="Total Dealers" value={stats.totalDealers || 0} color="#4F46E5" />
      <MetricCard icon={ShieldCheck} label="Active Dealers" value={stats.activeDealers || 0} color="#10B981" />
      <MetricCard icon={Building2} label="Cities Covered" value={Object.keys(payload?.cityCounts || {}).length} color="#F59E0B" />
      <MetricCard icon={TrendingUp} label="Total Dealer Sales" value={dealers.reduce((sum, row) => sum + Number(row.totalSales || 0), 0).toLocaleString("en-IN")} color="#8B5CF6" />
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <DashboardCard title="Top Performing Dealers" subtitle="Ranked by recorded sales performance" icon={Award}>
        {topDealers.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{topDealers.map((dealer, index) => <RankCard key={dealer.id} dealer={dealer} rank={index + 1} onView={() => setSelectedDealer(dealer)} />)}</div> : <Empty text="Performance rankings will appear after dealer activity is recorded." />}
      </DashboardCard>
      <DashboardCard title="Dealer Status" subtitle="Current network availability">
        {statusData.length ? <div className="relative h-64"><ResponsiveContainer><PieChart><Pie data={statusData} dataKey="value" innerRadius={58} outerRadius={86} paddingAngle={4} animationDuration={900}>{statusData.map((row) => <Cell key={row.name} fill={row.color} />)}</Pie><Tooltip content={<SimpleTooltip />} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 grid place-items-center"><div className="text-center"><p className="text-3xl font-black text-slate-950">{stats.totalDealers || 0}</p><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Dealers</p></div></div></div> : <Empty text="No dealer status data available." />}
        <div className="mt-2 flex flex-wrap justify-center gap-4">{statusData.map((row) => <span key={row.name} className="inline-flex items-center gap-2 text-xs font-bold text-slate-600"><i className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />{row.name} {row.value}</span>)}</div>
      </DashboardCard>
    </div>

    {locationData.length > 0 && <DashboardCard title="Dealer Network by City" subtitle="Top locations by dealer count" icon={MapPin}>
      <div className="h-64"><ResponsiveContainer><BarChart data={locationData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}><defs><linearGradient id="dealerCityBars" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4F46E5" /><stop offset="100%" stopColor="#8B5CF6" /></linearGradient></defs><CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="name" tick={{ fill: "#64748B", fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fill: "#64748B", fontSize: 11 }} /><Tooltip content={<SimpleTooltip />} /><Bar dataKey="value" name="Dealers" fill="url(#dealerCityBars)" radius={[8, 8, 0, 0]} animationDuration={900} /></BarChart></ResponsiveContainer></div>
    </DashboardCard>}

    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/50 md:p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><h2 className="text-lg font-black text-slate-950">Dealer Details</h2><p className="mt-1 text-sm text-slate-500">Browse and manage every dealer without horizontal scrolling.</p></div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative block min-w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search dealer, owner, city…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100" /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="blocked">Blocked</option></select>
        </div>
      </div>
      <div className="my-5 h-px bg-slate-100" />
      {visibleDealers.length ? <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">{visibleDealers.map((dealer, index) => <DealerCard key={dealer.id} dealer={dealer} index={index} onView={() => setSelectedDealer(dealer)} onControl={() => onControlDealer(dealer)} />)}</div> : <Empty text="No dealers match the selected filters." />}
      <Pagination page={safePage} totalPages={totalPages} totalItems={filteredDealers.length} pageSize={pageSize} onPage={setPage} noun="dealers" />
    </section>

    {selectedDealer && <DealerDetailModal dealer={selectedDealer} onClose={() => setSelectedDealer(null)} onControl={async () => { await onControlDealer(selectedDealer); setSelectedDealer(null); }} />}
  </div>;
}

function MetricCard({ icon: Icon, label, value, color }) { return <div className="group rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/50 transition duration-300 hover:-translate-y-1 hover:shadow-xl"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-slate-950">{value}</p></div><span className="grid h-12 w-12 place-items-center rounded-2xl transition group-hover:scale-110" style={{ color, backgroundColor: `${color}14` }}><Icon size={23} /></span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-2/3 rounded-full" style={{ backgroundColor: color }} /></div></div>; }
function DashboardCard({ title, subtitle, icon: Icon, children }) { return <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-200/50 md:p-6"><header className="mb-5 flex items-start gap-3">{Icon && <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Icon size={20} /></span>}<div><h2 className="font-black text-slate-950">{title}</h2><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div></header>{children}</section>; }
function RankCard({ dealer, rank, onView }) { const palette = ["from-amber-400 to-orange-500", "from-slate-300 to-slate-500", "from-orange-300 to-orange-600", "from-indigo-500 to-purple-600", "from-indigo-500 to-purple-600"]; return <button onClick={onView} className="group rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-left transition duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:bg-white hover:shadow-lg"><div className="flex items-center justify-between"><span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${palette[rank - 1]} text-sm font-black text-white shadow-sm`}>#{rank}</span><Award size={18} className="text-amber-500" /></div><p className="mt-4 truncate font-black text-slate-900">{dealer.dealerName}</p><p className="mt-1 truncate text-xs text-slate-500">{dealer.city || dealer.area || "Location unavailable"}</p><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div><p className="text-slate-400">Sales</p><p className="font-black text-indigo-600">{Number(dealer.totalSales || 0).toLocaleString("en-IN")}</p></div><div><p className="text-slate-400">Orders</p><p className="font-black text-slate-800">{dealer.totalOrders || 0}</p></div></div></button>; }
function DealerCard({ dealer, onView, onControl }) { return <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-300 hover:-translate-y-1 hover:border-indigo-200 hover:shadow-xl"><div className="h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400" /><div className="p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-black text-white shadow-md">{String(dealer.dealerName || "D").slice(0, 1).toUpperCase()}</span><div className="min-w-0"><h3 className="truncate font-black text-slate-950">{dealer.dealerName}</h3><p className="truncate text-sm text-slate-500">{dealer.ownerName || "Owner not provided"}</p></div></div><span className={`rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${statusTone[dealer.status] || statusTone.inactive}`}>{dealer.status || "inactive"}</span></div>
  <div className="mt-5 grid gap-2.5 text-sm text-slate-600"><DetailLine icon={MapPin}>{[dealer.area, dealer.city, dealer.pincode].filter(Boolean).join(", ") || "Location unavailable"}</DetailLine><DetailLine icon={Mail}>{dealer.email || "Email unavailable"}</DetailLine><DetailLine icon={Phone}>{dealer.phone || "Phone unavailable"}</DetailLine></div>
  <div className="mt-5 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50 p-3 text-center"><MiniMetric label="Orders" value={dealer.totalOrders || 0} /><MiniMetric label="Sales" value={Number(dealer.totalSales || 0).toLocaleString("en-IN")} /><MiniMetric label="Pending" value={formatMoney(dealer.pendingPayment || 0)} /></div>
  <div className="mt-5 flex gap-2"><button onClick={onView} className="flex-1 rounded-xl bg-indigo-50 px-3 py-2.5 text-sm font-black text-indigo-700 transition hover:bg-indigo-100">View details</button><button onClick={onControl} className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-black text-white transition ${dealer.status === "active" ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700"}`}>{dealer.status === "active" ? "Suspend" : "Reactivate"}</button></div></div></article>; }
function DealerDetailModal({ dealer, onClose, onControl }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white"><div className="flex items-start justify-between"><div className="flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/15 text-2xl font-black ring-1 ring-white/20">{String(dealer.dealerName || "D")[0]}</span><div><h2 className="text-xl font-black">{dealer.dealerName}</h2><p className="text-sm text-indigo-100">Dealer profile and performance</p></div></div><button onClick={onClose} className="rounded-xl bg-white/10 px-3 py-2 text-sm font-black hover:bg-white/20">Close</button></div></div><div className="grid gap-5 p-6 md:grid-cols-2"><InfoBlock icon={UserRound} label="Owner" value={dealer.ownerName} /><InfoBlock icon={Mail} label="Email" value={dealer.email} /><InfoBlock icon={Phone} label="Phone" value={dealer.phone} /><InfoBlock icon={MapPin} label="Location" value={[dealer.address, dealer.area, dealer.city, dealer.state, dealer.pincode].filter(Boolean).join(", ")} /><InfoBlock icon={ShoppingCart} label="Orders / Sales" value={`${dealer.totalOrders || 0} orders • ${Number(dealer.totalSales || 0).toLocaleString("en-IN")} sales`} /><InfoBlock icon={WalletCards} label="Financial position" value={`${formatMoney(dealer.pendingPayment || 0)} pending • ${dealer.creditBalance || 0} credits`} /><InfoBlock icon={Building2} label="Member since" value={formatDate(dealer.createdAt)} /><InfoBlock icon={ShieldCheck} label="Account status" value={dealer.status || "inactive"} /></div><div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4"><button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700">Close</button><button onClick={onControl} className={`rounded-xl px-4 py-2.5 text-sm font-black text-white ${dealer.status === "active" ? "bg-amber-500" : "bg-emerald-600"}`}>{dealer.status === "active" ? "Suspend dealer" : "Reactivate dealer"}</button></div></div></div>; }
function InfoBlock({ icon: Icon, label, value }) { return <div className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-sm"><Icon size={19} /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-bold capitalize text-slate-800">{value || "Not provided"}</p></div></div>; }
function DetailLine({ icon: Icon, children }) { return <div className="flex min-w-0 items-center gap-2"><Icon size={16} className="shrink-0 text-indigo-400" /><span className="truncate">{children}</span></div>; }
function MiniMetric({ label, value }) { return <div className="min-w-0 px-1"><p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 truncate text-xs font-black text-slate-800">{value}</p></div>; }
function Empty({ text }) { return <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm font-semibold text-slate-400"><div><Users className="mx-auto mb-3" size={38} strokeWidth={1.4} /><p>{text}</p></div></div>; }
function SimpleTooltip({ active, payload, label }) { return active && payload?.length ? <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-xl"><p className="font-black text-slate-900">{label || payload[0]?.payload?.name}</p><p className="mt-1 text-indigo-600">{payload[0].name}: <strong>{payload[0].value}</strong></p></div> : null; }
function Pagination({ page, totalPages, totalItems, pageSize, onPage, noun }) { if (!totalItems) return null; const start = (page - 1) * pageSize + 1, end = Math.min(page * pageSize, totalItems); return <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-bold text-slate-400">Showing {start}–{end} of {totalItems} {noun}</p><div className="flex items-center gap-2"><button disabled={page === 1} onClick={() => onPage(page - 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40">Previous</button><span className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white">{page} / {totalPages}</span><button disabled={page === totalPages} onClick={() => onPage(page + 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40">Next</button></div></div>; }
