import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Ban, Building2, CalendarClock, CheckCircle2, Eye, Plus, Trash2, Users } from "lucide-react";
import Layout from "../components/Layout";
import { api } from "../api/client";
import { consumeProfileTargetTab } from "../utils/profileNavigation";
import {
  ActionIcon,
  Button,
  ChartCard,
  ConfirmModal,
  DashboardCard,
  DataTable,
  Empty,
  FormGrid,
  formatDate,
  Loading,
  PageHeader,
  SearchFilterBar,
  Section,
  SectionCard,
  Select,
  StatusBadge,
  TextField
} from "../components/UI";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "companies", label: "Companies", icon: "companies" },
  { id: "create", label: "Create Company", icon: "companies" }
];

const chartColors = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#F43F5E", "#64748B"];

export default function SuperAdmin() {
  const [activeTab, setActiveTab] = useState(() => consumeProfileTargetTab("dashboard", tabs));
  const [dashboard, setDashboard] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [category, setCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ companyName: "", category: "Automobile", description: "", adminName: "", adminEmail: "", password: "admin123", startDate: "2026-01-01", endDate: "2026-12-31", status: "active" });

  const load = async () => {
    setLoading(true);
    const [dash, list] = await Promise.all([
      api.get("/super-admin/dashboard"),
      api.get(`/super-admin/companies${category ? `?category=${category}` : ""}`)
    ]);
    setDashboard(dash.data);
    setCompanies(list.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [category]);

  const categories = useMemo(() => [...new Set(companies.map((c) => c.category).filter(Boolean))], [companies]);
  const filteredCompanies = useMemo(() => companies.filter((company) => {
    const haystack = `${company.companyName} ${company.category} ${company.adminEmail} ${company.adminName}`.toLowerCase();
    const matchesSearch = haystack.includes(search.toLowerCase());
    const matchesStatus = !statusFilter || String(company.status).toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  }), [companies, search, statusFilter]);

  const growthData = useMemo(() => {
    const byMonth = companies.reduce((acc, company) => {
      const key = company.createdAt ? new Date(company.createdAt).toLocaleString("en-IN", { month: "short" }) : "Current";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(byMonth).map(([month, count]) => ({ month, count }));
  }, [companies]);

  const expiringSoon = useMemo(() => companies.filter((company) => {
    if (!company.endDate) return false;
    const days = Math.ceil((new Date(company.endDate) - new Date()) / 86400000);
    return days >= 0 && days <= 30;
  }).slice(0, 6), [companies]);

  const recentCompanies = useMemo(() => [...companies].sort((a, b) => new Date(b.createdAt || b.startDate || 0) - new Date(a.createdAt || a.startDate || 0)).slice(0, 6), [companies]);

  const submit = async (e) => {
    e.preventDefault();
    await api.post("/super-admin/companies", form);
    setForm({ ...form, companyName: "", description: "", adminName: "", adminEmail: "" });
    setActiveTab("companies");
    load();
  };

  const status = async (id, value) => {
    await api.patch(`/super-admin/companies/${id}/status`, { status: value });
    load();
  };

  const remove = async () => {
    if (!confirmDelete) return;
    await api.delete(`/super-admin/companies/${confirmDelete.id}`);
    setConfirmDelete(null);
    load();
  };

  return (
    <Layout title="Super Admin" subtitle="Manage companies, subscriptions and tenant access" tabs={tabs} activeTab={activeTab} onTab={setActiveTab}>
      {loading ? <Loading /> : (
        <>
          {activeTab === "dashboard" && (
            <div>
              <PageHeader eyebrow="Super Admin" title="Platform overview" description="A clean operating view of company subscriptions, tenant health, dealer growth and category distribution." actions={<Button onClick={() => setActiveTab("create")}><Plus size={16} /> Create Company</Button>} />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <DashboardCard label="Total Companies" value={dashboard.totalCompanies} icon={Building2} tone="indigo" />
                <DashboardCard label="Active Companies" value={dashboard.activeCompanies} icon={CheckCircle2} tone="emerald" />
                <DashboardCard label="Expired Companies" value={dashboard.expiredCompanies} icon={CalendarClock} tone="amber" />
                <DashboardCard label="Blocked Companies" value={dashboard.blockedCompanies} icon={Ban} tone="rose" />
                <DashboardCard label="Total Dealers" value={dashboard.totalDealers} icon={Users} tone="sky" />
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <ChartCard title="Company growth">
                  <div className="h-72">
                    <ResponsiveContainer>
                      <AreaChart data={growthData}>
                        <defs><linearGradient id="growth" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4F46E5" stopOpacity={0.35} /><stop offset="95%" stopColor="#4F46E5" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="month" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="#4F46E5" fill="url(#growth)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
                <ChartCard title="Category distribution">
                  <div className="h-72">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={dashboard.categoryWise || []} dataKey="count" nameKey="category" outerRadius={92} label>
                          {(dashboard.categoryWise || []).map((entry, index) => <Cell key={entry.category} fill={chartColors[index % chartColors.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <MiniCompanyList title="Recently added companies" rows={recentCompanies} />
                <MiniCompanyList title="Expiring soon subscriptions" rows={expiringSoon} emptyText="No subscriptions expiring in 30 days" />
              </div>

              <Section title="Category-wise company count">
                {(dashboard.categoryWise || []).length ? (
                  <div className="h-72">
                    <ResponsiveContainer>
                      <BarChart data={dashboard.categoryWise}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="category" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : <Empty text="No category data yet" />}
              </Section>
            </div>
          )}

          {activeTab === "companies" && (
            <div>
              <PageHeader eyebrow="Companies" title="Company list" description="Search companies, filter by category/status, and manage tenant subscription access." />
              <SectionCard title="Company directory">
                <SearchFilterBar search={search} onSearch={setSearch} placeholder="Search company, admin or category">
                  <Select label="" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">All categories</option>
                    {categories.map((c) => <option key={c}>{c}</option>)}
                  </Select>
                  <Select label="" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All status</option>
                    <option value="active">Active</option>
                    <option value="blocked">Blocked</option>
                    <option value="expired">Expired</option>
                  </Select>
                </SearchFilterBar>
                <DataTable
                  rows={filteredCompanies}
                  columns={[
                    { header: "Company", render: (c) => <div><p className="font-semibold text-slate-900">{c.companyName}</p><p className="text-xs text-slate-500">{c.description || "No description"}</p></div> },
                    { header: "Category", key: "category" },
                    { header: "Admin", render: (c) => <div><p>{c.adminName || "-"}</p><p className="text-xs text-slate-500">{c.adminEmail}</p></div> },
                    { header: "Dealers", render: (c) => c.Dealers?.length || 0 },
                    { header: "Start", render: (c) => formatDate(c.startDate) },
                    { header: "End", render: (c) => <SubscriptionProgress company={c} /> },
                    { header: "Status", render: (c) => <StatusBadge value={c.status} /> },
                    { header: "Actions", render: (c) => <div className="flex items-center gap-1"><Button variant="ghost" onClick={() => status(c.id, c.status === "blocked" ? "active" : "blocked")}>{c.status === "blocked" ? "Unblock" : "Block"}</Button><ActionIcon title="View"><Eye size={16} /></ActionIcon><ActionIcon danger onClick={() => setConfirmDelete(c)} title="Delete"><Trash2 size={16} /></ActionIcon></div> }
                  ]}
                />
              </SectionCard>
            </div>
          )}

          {activeTab === "create" && (
            <div>
              <PageHeader eyebrow="Create Company" title="New tenant setup" description="Create a company, assign the first admin, and define subscription dates without changing backend contracts." />
              <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
                <SectionCard title="Company details">
                  <FormGrid onSubmit={submit}>
                    {["companyName", "adminName", "adminEmail", "password", "startDate", "endDate"].map((key) => <TextField key={key} label={key.replace(/([A-Z])/g, " $1")} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required type={key.includes("Date") ? "date" : key === "password" ? "password" : key === "adminEmail" ? "email" : "text"} />)}
                    <TextField label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Automobile, Cosmetic, Electronics..." required />
                    <TextField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    <div className="md:col-span-2"><Button type="submit"><Plus size={16} /> Create Company</Button></div>
                  </FormGrid>
                </SectionCard>
                <SectionCard title="Preview summary">
                  <div className="space-y-4">
                    <div className="rounded-md bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Company</p>
                      <p className="mt-1 text-lg font-semibold text-slate-950">{form.companyName || "Company name"}</p>
                      <p className="text-sm text-slate-500">{form.category || "Category"}</p>
                    </div>
                    <div className="grid gap-3 text-sm">
                      <SummaryRow label="Admin" value={form.adminName || "-"} />
                      <SummaryRow label="Email" value={form.adminEmail || "-"} />
                      <SummaryRow label="Start" value={formatDate(form.startDate)} />
                      <SummaryRow label="End" value={formatDate(form.endDate)} />
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmModal open={!!confirmDelete} title="Delete company?" description={`This will delete ${confirmDelete?.companyName}. Confirm only if this tenant should be removed.`} danger confirmText="Delete" onConfirm={remove} onClose={() => setConfirmDelete(null)} />
    </Layout>
  );
}

function MiniCompanyList({ title, rows = [], emptyText = "No companies found" }) {
  return (
    <SectionCard title={title}>
      {rows.length ? <div className="space-y-3">{rows.map((company) => <div key={company.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-3"><div><p className="font-semibold text-slate-900">{company.companyName}</p><p className="text-xs text-slate-500">{company.category} | Ends {formatDate(company.endDate)}</p></div><StatusBadge value={company.status} /></div>)}</div> : <Empty text={emptyText} />}
    </SectionCard>
  );
}

function SummaryRow({ label, value }) {
  return <div className="flex justify-between gap-3 border-b border-slate-100 pb-2"><span className="text-slate-500">{label}</span><span className="font-semibold text-slate-800">{value}</span></div>;
}

function SubscriptionProgress({ company }) {
  const start = new Date(company.startDate);
  const end = new Date(company.endDate);
  const now = new Date();
  const total = Math.max(end - start, 1);
  const used = Math.max(0, Math.min(now - start, total));
  const progress = Math.round((used / total) * 100);
  return (
    <div className="min-w-36">
      <p className="text-sm">{formatDate(company.endDate)}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-600" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
