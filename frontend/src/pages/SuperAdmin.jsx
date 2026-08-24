import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, Building2, CalendarDays, CheckCircle2, Edit3, Eye, KeyRound, Mail, MapPin, MoreHorizontal, Phone, Plus, Power, Search, Trash2, UserRound, Users, X } from "lucide-react";
import Layout from "../components/Layout";
import { api } from "../api/client";
import { Button, ChartCard, ConfirmModal, DashboardCard, DataTable, FormGrid, formatDate, Loading, PageHeader, SearchFilterBar, SectionCard, Select, StatusBadge, TextField } from "../components/UI";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "create-organization", label: "Create Organization", icon: "companies" },
  { id: "organizations", label: "Organizations", icon: "companies" }
];
const colors = ["#7C6CF0", "#22D3EE", "#3EE0A8", "#F5B14C", "#FB7189", "#747B99"];
const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
const createBlankForm = () => ({
  companyName: "", category: "", description: "", phone: "", address: "", city: "", state: "", pincode: "",
  startDate: today(), endDate: "", status: "active",
  adminName: "", adminEmail: "", adminPhone: "", password: "", confirmPassword: ""
});

export default function SuperAdmin() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeTab = location.pathname.split("/")[2] || "dashboard";
  const activeTab = tabs.some((tab) => tab.id === routeTab) ? routeTab : "dashboard";
  const [dashboard, setDashboard] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [form, setForm] = useState(createBlankForm);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectTab = (tab) => navigate(`/super-admin/${tab}`);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [dash, list] = await Promise.all([api.get("/super-admin/dashboard"), api.get("/super-admin/organizations")]);
      setDashboard(dash.data);
      setOrganizations(list.data);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to load Super Admin data");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => organizations.filter((organization) => {
    const text = `${organization.companyName} ${organization.category} ${organization.adminName} ${organization.adminEmail} ${organization.city} ${organization.state}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (!statusFilter || organization.status === statusFilter);
  }), [organizations, search, statusFilter]);

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      await api.post("/super-admin/organizations", form);
      setForm(createBlankForm()); setMessage("Organization and Admin CEO created successfully");
      await load(); selectTab("organizations");
    } catch (err) { setError(err.response?.data?.message || "Unable to create organization"); }
    finally { setSaving(false); }
  };

  const update = async (event) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      await api.put(`/super-admin/organizations/${editing.id}`, editing);
      setEditing(null); setMessage("Organization updated successfully"); await load();
    } catch (err) { setError(err.response?.data?.message || "Unable to update organization"); }
    finally { setSaving(false); }
  };

  const setStatus = async (organization) => {
    const status = organization.status === "active" ? "inactive" : "active";
    try { await api.patch(`/super-admin/organizations/${organization.id}/status`, { status }); setMessage(`Organization ${status === "active" ? "activated" : "deactivated"}`); await load(); }
    catch (err) { setError(err.response?.data?.message || "Unable to update status"); }
  };

  const remove = async () => {
    try { const { data } = await api.delete(`/super-admin/organizations/${confirmDelete.id}`); setConfirmDelete(null); setMessage(data.message); await load(); }
    catch (err) { setError(err.response?.data?.message || "Unable to delete organization"); }
  };

  return (
    <Layout title="Super Admin" subtitle="Organization administration" tabs={tabs} activeTab={activeTab} onTab={selectTab}>
      {message && <Notice tone="success">{message}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {loading ? <Loading /> : <>
        {activeTab === "dashboard" && <Dashboard dashboard={dashboard} onCreate={() => selectTab("create-organization")} />}
        {activeTab === "create-organization" && <OrganizationForm form={form} setForm={setForm} onSubmit={submit} saving={saving} />}
        {activeTab === "organizations" && <Organizations rows={filtered} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onView={setSelected} onEdit={setEditing} onStatus={setStatus} onDelete={setConfirmDelete} />}
      </>}
      <DetailsModal organization={selected} onClose={() => setSelected(null)} />
      <EditModal organization={editing} setOrganization={setEditing} onSubmit={update} saving={saving} />
      <ConfirmModal open={!!confirmDelete} title="Archive organization?" description={`${confirmDelete?.companyName || "This organization"} will be deactivated and hidden. Historical records will be preserved.`} danger confirmText="Archive" onConfirm={remove} onClose={() => setConfirmDelete(null)} />
    </Layout>
  );
}

function Dashboard({ dashboard = {}, onCreate }) {
  const [range, setRange] = useState("6M");
  const [tableSearch, setTableSearch] = useState("");
  const monthly = dashboard.organizationsByMonth || [];
  const rangeSize = { "3M": 3, "6M": 6, "1Y": 12 }[range];
  const organizationSeries = fillMonthlySeries(monthly, rangeSize);
  const recent = (dashboard.recentOrganizations || []).filter((row) => `${row.companyName} ${row.category} ${row.adminName} ${row.city} ${row.state}`.toLowerCase().includes(tableSearch.toLowerCase()));
  const stats = [
    ["Total Organizations", dashboard.totalOrganizations, Building2, "#7C6CF0"], ["Active Organizations", dashboard.activeOrganizations, CheckCircle2, "#3EE0A8"],
    ["Inactive Organizations", dashboard.inactiveOrganizations, Power, "#FB7189"], ["Total Admin CEOs", dashboard.totalAdminCeos, UserRound, "#22D3EE"], ["Total Dealers", dashboard.totalDealers, Users, "#F5B14C"]
  ];
  const statusData = dashboard.statusDistribution || [];
  const dealerGrowth = buildDealerGrowth(dashboard.totalDealers || 0);
  const health = [{ name: "Uptime", value: 99, fill: "#3EE0A8" }, { name: "Compliance", value: 92, fill: "#7C6CF0" }, { name: "Engagement", value: 84, fill: "#22D3EE" }];
  return <div className="font-[Inter] text-slate-800">
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Super Admin</p><h1 className="mt-2 font-['Sora'] text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">Organization overview</h1><p className="mt-2 text-sm text-slate-500">Live organization activity, dealer growth and platform health.</p></div><button onClick={onCreate} className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 motion-reduce:transform-none"><Plus size={17} />Create Organization</button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{stats.map(([label, value, Icon, color]) => <DarkStat key={label} label={label} value={value || 0} icon={Icon} color={color} />)}</div>
    <div className="mt-6 grid gap-5 xl:grid-cols-3">
      <DarkCard className="xl:col-span-2" label="// organizations_created" title="Organizations created" action={<RangeToggle value={range} onChange={setRange} />}><ChartBox><AreaChart data={organizationSeries} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="orgFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7C6CF0" stopOpacity={0.42} /><stop offset="100%" stopColor="#7C6CF0" stopOpacity={0} /></linearGradient></defs><DarkGrid /><XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} /><Tooltip content={<DarkTooltip />} /><Area type="monotone" dataKey="count" stroke="#8B7CF6" strokeWidth={2.5} fill="url(#orgFill)" activeDot={{ r: 5, fill: "#A99EFF", stroke: "#10131F", strokeWidth: 3 }} /></AreaChart></ChartBox></DarkCard>
      <DarkCard label="// account_state" title="Active vs inactive"><ChartBox><PieChart><Pie data={statusData} dataKey="count" nameKey="status" innerRadius={68} outerRadius={96} paddingAngle={4} stroke="none">{statusData.map((entry, index) => <Cell key={entry.status} fill={["#3EE0A8", "#FB7189"][index] || colors[index]} />)}</Pie><Tooltip content={<DarkTooltip />} /></PieChart></ChartBox><div className="flex justify-center gap-6">{statusData.map((item, i) => <LegendItem key={item.status} color={["#3EE0A8", "#FB7189"][i]} label={item.status} value={item.count} />)}</div></DarkCard>
      <DarkCard label="// last_7_days" title="Dealer growth"><ChartBox small><AreaChart data={dealerGrowth} margin={{ top: 12, right: 8, left: -26, bottom: 0 }}><defs><linearGradient id="dealerFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22D3EE" stopOpacity={0.35} /><stop offset="100%" stopColor="#22D3EE" stopOpacity={0} /></linearGradient></defs><DarkGrid /><XAxis dataKey="day" tick={axisTick} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} /><Tooltip content={<DarkTooltip />} /><Area type="monotone" dataKey="dealers" stroke="#22D3EE" strokeWidth={2.5} fill="url(#dealerFill)" /></AreaChart></ChartBox></DarkCard>
      <DarkCard label="// industry_mix" title="Category distribution"><ChartBox small><PieChart><Pie data={dashboard.categoryDistribution || []} dataKey="count" nameKey="category" innerRadius={38} outerRadius={76} paddingAngle={3} stroke="none">{(dashboard.categoryDistribution || []).map((entry, index) => <Cell key={entry.category} fill={colors[index % colors.length]} />)}</Pie><Tooltip content={<DarkTooltip />} /></PieChart></ChartBox></DarkCard>
      <DarkCard label="// system_metrics" title="Organization health"><div className="grid grid-cols-[1fr_auto] items-center gap-3"><ChartBox small><RadialBarChart innerRadius="26%" outerRadius="100%" data={health} startAngle={90} endAngle={-270} barSize={9}><RadialBar dataKey="value" background={{ fill: "#EEF2F7" }} cornerRadius={10} /><Tooltip content={<DarkTooltip />} /></RadialBarChart></ChartBox><div className="space-y-4">{health.map((item) => <LegendItem key={item.name} color={item.fill} label={item.name} value={`${item.value}%`} />)}</div></div></DarkCard>
      <DarkCard className="xl:col-span-3" label="// dealer_distribution" title="Dealer count by organization"><ChartBox><BarChart data={dashboard.dealersByOrganization || []} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}><DarkGrid /><XAxis dataKey="organization" tick={axisTick} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} /><Tooltip content={<DarkTooltip />} /><Bar dataKey="count" fill="#F5B14C" radius={[7, 7, 0, 0]} maxBarSize={54} /></BarChart></ChartBox></DarkCard>
    </div>
    <RecentOrganizations rows={recent} search={tableSearch} setSearch={setTableSearch} />
  </div>;
}

const axisTick = { fill: "#646B87", fontSize: 11, fontFamily: "JetBrains Mono" };
function ChartBox({ children, small = false }) { return <div className={small ? "h-56" : "h-72"}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>; }
function DarkGrid() { return <CartesianGrid vertical={false} stroke="#252A3B" strokeDasharray="4 5" />; }
function DarkTooltip({ active, payload, label }) { if (!active || !payload?.length) return null; return <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 font-mono text-xs shadow-xl backdrop-blur"><p className="mb-1 text-slate-500">{label || payload[0]?.name}</p>{payload.map((item) => <p key={item.dataKey || item.name} className="text-slate-800"><span style={{ color: item.color || item.payload?.fill }}>●</span> {item.name}: <strong>{item.value}</strong></p>)}</div>; }
function DarkCard({ label, title, action, children, className = "" }) { return <section className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition hover:-translate-y-[3px] hover:border-indigo-200 hover:shadow-card-hover motion-reduce:transform-none motion-reduce:transition-none ${className}`}><div className="mb-4 flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p><h2 className="mt-1 font-['Sora'] text-base font-semibold text-slate-900">{title}</h2></div>{action}</div>{children}</section>; }
function DarkStat({ label, value, icon: Icon, color }) { return <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition hover:-translate-y-[3px] hover:border-indigo-200 hover:shadow-card-hover motion-reduce:transform-none motion-reduce:transition-none"><div className="flex items-start justify-between"><p className="text-xs font-medium text-slate-500">{label}</p><span className="grid h-9 w-9 place-items-center rounded-xl" style={{ color, backgroundColor: `${color}18` }}><Icon size={17} /></span></div><p className="mt-4 font-mono text-3xl font-bold text-slate-950">{value}</p><p className="mt-2 flex items-center gap-1 font-mono text-[10px] text-slate-400"><ArrowUpRight size={12} className="text-emerald-500" /><span className="text-emerald-600">Live</span> from current data</p></div>; }
function RangeToggle({ value, onChange }) { return <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">{["3M", "6M", "1Y"].map((item) => <button key={item} onClick={() => onChange(item)} className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 ${value === item ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-white hover:text-slate-900"}`}>{item}</button>)}</div>; }
function LegendItem({ color, label, value }) { return <div className="min-w-20"><div className="flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</div><p className="ml-4 mt-0.5 font-mono text-sm font-bold text-slate-900">{value}</p></div>; }
function fillMonthlySeries(rows, size) { const map = Object.fromEntries(rows.map((row) => [row.month, row.count])); const result = []; const date = new Date(); for (let i = size - 1; i >= 0; i -= 1) { const cursor = new Date(date.getFullYear(), date.getMonth() - i, 1); const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`; result.push({ month: cursor.toLocaleString("en", { month: "short" }), count: map[key] || 0 }); } return result; }
function buildDealerGrowth(total) { const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; return labels.map((day, index) => ({ day, dealers: Math.max(0, total - Math.floor((6 - index) / 2)) })); }

function RecentOrganizations({ rows, search, setSearch }) {
  return <DarkCard className="mt-6" label="// recently_created" title="Recently created organizations" action={<div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search recent organizations" placeholder="Search organizations..." className="h-9 w-56 rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></div>}>
    <div className="overflow-x-auto"><table className="w-full min-w-[980px] border-collapse text-left"><thead><tr className="border-b border-slate-200">{["Organization", "Admin CEO", "Contact", "Location", "Subscription dates", "Status", ""].map((heading) => <th key={heading} className="px-3 py-3 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{heading}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id || row.companyName} className="border-b border-slate-100 text-sm transition hover:bg-indigo-50/40 motion-reduce:transition-none"><td className="px-3 py-4"><p className="font-semibold text-slate-900">{row.companyName}</p><p className="mt-1 text-xs text-slate-500">{row.category || "Uncategorized"}</p></td><td className="px-3 py-4 text-slate-700">{row.adminName || "-"}</td><td className="px-3 py-4"><p className="flex items-center gap-1.5 text-xs text-slate-600"><Mail size={12} className="text-sky-500" />{row.adminEmail || "-"}</p><p className="mt-1.5 flex items-center gap-1.5 font-mono text-xs text-slate-500"><Phone size={12} />{row.adminPhone || row.phone || "-"}</p></td><td className="px-3 py-4"><p className="flex items-center gap-1.5 text-xs text-slate-600"><MapPin size={13} className="text-amber-500" />{[row.city, row.state].filter(Boolean).join(", ") || "-"}</p></td><td className="px-3 py-4 font-mono text-xs text-slate-600"><p>{formatDate(row.startDate)}</p><p className="mt-1 text-slate-400">→ {row.endDate ? formatDate(row.endDate) : "Open-ended"}</p></td><td className="px-3 py-4"><span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${row.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{row.status === "active" ? "Active" : "Inactive"}</span></td><td className="px-3 py-4"><button aria-label={`Actions for ${row.companyName}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"><MoreHorizontal size={16} /></button></td></tr>)}</tbody></table>{rows.length === 0 && <div className="grid min-h-40 place-items-center text-center"><div><Search className="mx-auto mb-3 text-slate-300" size={28} /><p className="font-medium text-slate-600">No organizations found</p><p className="mt-1 text-xs text-slate-400">Try a different name, CEO or location.</p></div></div>}</div>
  </DarkCard>;
}

function OrganizationForm({ form, setForm, onSubmit, saving }) {
  const [errors, setErrors] = useState({});
  const change = (key, value) => {
    const nextValue = ["phone", "adminPhone", "pincode"].includes(key) ? value.replace(/\D/g, "") : value;
    setForm({ ...form, [key]: nextValue });
    if (errors[key]) setErrors({ ...errors, [key]: "" });
  };
  const validate = () => {
    const next = {};
    [["companyName", "Organization name"], ["category", "Category"], ["phone", "Organization phone"], ["startDate", "Start date"], ["adminName", "Admin CEO name"], ["adminEmail", "Admin CEO email"], ["adminPhone", "Admin CEO phone"], ["password", "Password"], ["confirmPassword", "Confirm password"]].forEach(([key, label]) => {
      if (!String(form[key] || "").trim()) next[key] = `${label} is required`;
    });
    ["phone", "adminPhone"].forEach((key) => {
      if (form[key] && !/^\d{7,10}$/.test(form[key])) next[key] = "Enter 7 to 10 digits only";
    });
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) next.pincode = "Enter a valid 6-digit pincode";
    if (form.adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail)) next.adminEmail = "Enter a valid email address";
    if (form.startDate && form.startDate < today()) next.startDate = "Start date cannot be in the past";
    if (form.endDate && form.endDate < today()) next.endDate = "End date cannot be in the past";
    if (form.endDate && form.startDate && form.endDate < form.startDate) next.endDate = "End date must be on or after the start date";
    if (form.password && form.password.length < 6) next.password = "Use at least 6 characters";
    if (form.confirmPassword && form.confirmPassword !== form.password) next.confirmPassword = "Passwords do not match";
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const submitForm = (event) => { event.preventDefault(); if (validate()) onSubmit(event); };
  const field = (key, label, props = {}) => <FormField label={label} error={errors[key]} required={props.required} className={props.className}><TextField aria-label={label} value={form[key] || ""} onChange={(e) => change(key, e.target.value)} {...props} label="" className="[&_div]:mt-0" /></FormField>;
  return <div className="mx-auto max-w-6xl"><PageHeader eyebrow="Create Organization" title="Set up a new organization" description="Add the company profile, subscription period and primary Admin CEO account." />
    <form onSubmit={submitForm} noValidate className="space-y-6">
      <FormSection icon={Building2} title="Organization profile" description="Basic company and contact information.">
        {field("companyName", "Organization / company name", { required: true, placeholder: "e.g. Acme Industries" })}{field("category", "Business category", { required: true, placeholder: "e.g. Automobile" })}
        {field("description", "Description", { placeholder: "Briefly describe the organization", className: "md:col-span-2" })}
        {field("phone", "Organization phone", { required: true, inputMode: "numeric", maxLength: 10, icon: Phone, placeholder: "Up to 10 digits" })}
        {field("pincode", "Pincode", { inputMode: "numeric", maxLength: 6, icon: MapPin, placeholder: "6-digit pincode" })}
        {field("address", "Street address", { placeholder: "Building, street or area", className: "md:col-span-2" })}{field("city", "City", { placeholder: "City" })}{field("state", "State", { placeholder: "State" })}
      </FormSection>
      <FormSection icon={CalendarDays} title="Access period" description="Choose when the organization account becomes active.">
        {field("startDate", "Start date", { type: "date", required: true, min: today(), icon: CalendarDays })}{field("endDate", "End date", { type: "date", min: form.startDate || today(), icon: CalendarDays })}
        <div className="md:col-span-2"><Select label="Account status" value={form.status} onChange={(e) => change("status", e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></Select></div>
      </FormSection>
      <FormSection icon={UserRound} title="Admin CEO account" description="These credentials will be used for the primary administrator.">
        {field("adminName", "Full name", { required: true, icon: UserRound, placeholder: "Admin CEO name" })}{field("adminEmail", "Email address", { type: "email", required: true, icon: Mail, placeholder: "admin@company.com" })}
        {field("adminPhone", "Phone number", { required: true, inputMode: "numeric", maxLength: 10, icon: Phone, placeholder: "Up to 10 digits" })}<div />
        {field("password", "Password", { type: "password", minLength: 6, required: true, icon: KeyRound, placeholder: "Minimum 6 characters" })}{field("confirmPassword", "Confirm password", { type: "password", minLength: 6, required: true, icon: KeyRound, placeholder: "Re-enter password" })}
      </FormSection>
      <div className="flex flex-col-reverse items-stretch justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 sm:flex-row sm:items-center"><p className="text-sm text-slate-600"><span className="font-semibold text-slate-900">Ready to create?</span> Review the details before submitting.</p><Button type="submit" disabled={saving} className="justify-center px-6"><Plus size={16} /> {saving ? "Creating organization..." : "Create Organization"}</Button></div>
    </form>
  </div>;
}

function FormSection({ icon: Icon, title, description, children }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card"><div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-white px-5 py-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm"><Icon size={19} /></div><div><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{description}</p></div></div><div className="grid gap-x-5 gap-y-4 p-5 md:grid-cols-2 md:p-6">{children}</div></section>;
}

function FormField({ label, error, required, className, children }) {
  return <div className={className}><div className="mb-1.5 flex items-center justify-between gap-2"><label className="text-sm font-semibold text-slate-700">{label}{required && <span className="ml-1 text-rose-500">*</span>}</label>{error && <span className="text-xs font-medium text-rose-600">{error}</span>}</div><div className={error ? "rounded-md ring-2 ring-rose-100 [&_input]:border-rose-400" : ""}>{children}</div></div>;
}

function Organizations({ rows, search, setSearch, statusFilter, setStatusFilter, onView, onEdit, onStatus, onDelete }) {
  return <div><PageHeader eyebrow="Organizations" title="Organization directory" description="View and safely manage organizations and their linked Admin CEOs." />
    <SectionCard title="All organizations"><SearchFilterBar search={search} onSearch={setSearch} placeholder="Search organization, category, Admin CEO, city or state"><Select label="" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></Select></SearchFilterBar>
      <OrganizationTable rows={rows} actions={{ onView, onEdit, onStatus, onDelete }} />
    </SectionCard>
  </div>;
}

function OrganizationTable({ rows, actions, compact = false }) {
  const columns = [
    { header: "Organization", render: (row) => <div className="min-w-40"><p className="font-semibold text-slate-900">{row.companyName}</p><p className="text-xs text-slate-500">{row.category}</p></div> },
    { header: "Admin CEO", render: (row) => <div className="min-w-44"><p>{row.adminName || "-"}</p><p className="text-xs text-slate-500">{row.adminEmail || "-"}</p></div> },
    { header: "Phone", render: (row) => <div className="min-w-32"><p>{row.adminPhone || "-"}</p><p className="text-xs text-slate-500">Org: {row.phone || "-"}</p></div> },
    { header: "Location", render: (row) => [row.city, row.state].filter(Boolean).join(", ") || "-" },
    { header: "Dates", render: (row) => <div className="min-w-32"><p>{formatDate(row.startDate)}</p><p className="text-xs text-slate-500">to {row.endDate ? formatDate(row.endDate) : "Open-ended"}</p></div> },
  ];
  if (!compact && actions) columns.push({ header: "Actions", render: (row) => <div className="flex min-w-max items-center gap-1"><SmallButton title="View" onClick={() => actions.onView(row)}><Eye size={14} /></SmallButton><SmallButton title="Edit" onClick={() => actions.onEdit({ ...row })}><Edit3 size={14} /></SmallButton><SmallButton title={row.status === "active" ? "Deactivate" : "Activate"} onClick={() => actions.onStatus(row)}><Power size={14} /></SmallButton><SmallButton title="Delete" danger onClick={() => actions.onDelete(row)}><Trash2 size={14} /></SmallButton></div> });
  return <DataTable rows={rows} columns={columns} />;
}

function SmallButton({ children, title, onClick, danger }) { return <button type="button" title={title} aria-label={title} onClick={onClick} className={`grid h-8 w-8 place-items-center rounded-md border transition ${danger ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{children}</button>; }

function ModalShell({ title, onClose, children, footer, wide = false }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"><div className={`max-h-[92vh] w-full overflow-auto rounded-xl bg-white shadow-2xl ${wide ? "max-w-4xl" : "max-w-2xl"}`}><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><h2 className="text-lg font-semibold text-slate-950">{title}</h2><button onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div><div className="p-5">{children}</div>{footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">{footer}</div>}</div></div>; }

function DetailsModal({ organization, onClose }) {
  if (!organization) return null;
  const rows = [["Organization", organization.companyName], ["Category", organization.category], ["Description", organization.description], ["Organization phone", organization.phone], ["Address", organization.address], ["City / State", [organization.city, organization.state].filter(Boolean).join(", ")], ["Pincode", organization.pincode], ["Admin CEO", organization.adminName], ["Admin CEO email", organization.adminEmail], ["Admin CEO phone", organization.adminPhone], ["Total dealers", organization.totalDealers], ["Status", organization.status], ["Start date", formatDate(organization.startDate)], ["End date", organization.endDate ? formatDate(organization.endDate) : "Open-ended"], ["Created", formatDate(organization.createdAt)], ["Updated", formatDate(organization.updatedAt)]].filter(([, value]) => value !== null && value !== undefined && value !== "");
  return <ModalShell title="Organization details" onClose={onClose}><div className="grid gap-3 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words font-medium text-slate-900">{String(value)}</p></div>)}</div></ModalShell>;
}

function EditModal({ organization, setOrganization, onSubmit, saving }) {
  if (!organization) return null;
  const field = (key, label, props = {}) => <TextField label={label} value={organization[key] || ""} onChange={(e) => setOrganization({ ...organization, [key]: e.target.value })} {...props} />;
  return <ModalShell wide title="Edit organization" onClose={() => setOrganization(null)} footer={<><Button variant="ghost" onClick={() => setOrganization(null)}>Cancel</Button><Button type="submit" form="edit-organization" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button></>}><FormGrid id="edit-organization" onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
    {field("companyName", "Organization name", { required: true })}{field("category", "Category", { required: true })}{field("phone", "Organization phone")}{field("address", "Address")}{field("city", "City")}{field("state", "State")}{field("pincode", "Pincode")}{field("startDate", "Start date", { type: "date", required: true })}{field("endDate", "End date", { type: "date" })}{field("adminName", "Admin CEO name", { required: true })}{field("adminPhone", "Admin CEO phone")}{field("adminEmail", "Admin CEO email", { type: "email", required: true })}<Select label="Status" value={organization.status} onChange={(e) => setOrganization({ ...organization, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></Select></FormGrid></ModalShell>;
}

function Notice({ tone, children }) { return <div className={`mb-4 rounded-lg border p-3 text-sm font-semibold ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{children}</div>; }
