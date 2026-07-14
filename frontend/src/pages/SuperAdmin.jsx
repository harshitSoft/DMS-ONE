import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, CheckCircle2, Edit3, Eye, Plus, Power, Trash2, UserRound, Users, X } from "lucide-react";
import Layout from "../components/Layout";
import { api } from "../api/client";
import { Button, ChartCard, ConfirmModal, DashboardCard, DataTable, FormGrid, formatDate, Loading, PageHeader, SearchFilterBar, SectionCard, Select, StatusBadge, TextField } from "../components/UI";

const tabs = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "create-organization", label: "Create Organization", icon: "companies" },
  { id: "organizations", label: "Organizations", icon: "companies" }
];
const colors = ["#4F46E5", "#0EA5E9", "#10B981", "#F59E0B", "#F43F5E", "#64748B"];
const blankForm = {
  companyName: "", category: "", description: "", phone: "", address: "", city: "", state: "", pincode: "",
  startDate: new Date().toISOString().slice(0, 10), endDate: "", status: "active",
  adminName: "", adminEmail: "", adminPhone: "", password: "", confirmPassword: ""
};

export default function SuperAdmin() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeTab = location.pathname.split("/")[2] || "dashboard";
  const activeTab = tabs.some((tab) => tab.id === routeTab) ? routeTab : "dashboard";
  const [dashboard, setDashboard] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [form, setForm] = useState(blankForm);
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
      setForm(blankForm); setMessage("Organization and Admin CEO created successfully");
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
  return <div>
    <PageHeader eyebrow="Super Admin" title="Organization overview" description="Current organization activity and dealer distribution from the live database." actions={<Button onClick={onCreate}><Plus size={16} /> Create Organization</Button>} />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <DashboardCard label="Total Organizations" value={dashboard.totalOrganizations || 0} icon={Building2} tone="indigo" />
      <DashboardCard label="Active Organizations" value={dashboard.activeOrganizations || 0} icon={CheckCircle2} tone="emerald" />
      <DashboardCard label="Inactive Organizations" value={dashboard.inactiveOrganizations || 0} icon={Power} tone="amber" />
      <DashboardCard label="Total Admin CEOs" value={dashboard.totalAdminCeos || 0} icon={UserRound} tone="sky" />
      <DashboardCard label="Total Dealers" value={dashboard.totalDealers || 0} icon={Users} tone="rose" />
    </div>
    <div className="mt-6 grid gap-6 xl:grid-cols-2">
      <ChartCard title="Organizations created by month"><ChartBox><BarChart data={dashboard.organizationsByMonth || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} /></BarChart></ChartBox></ChartCard>
      <ChartCard title="Active vs inactive"><ChartBox><PieChart><Pie data={dashboard.statusDistribution || []} dataKey="count" nameKey="status" outerRadius={95} label>{(dashboard.statusDistribution || []).map((entry, index) => <Cell key={entry.status} fill={colors[index]} />)}</Pie><Tooltip /></PieChart></ChartBox></ChartCard>
      <ChartCard title="Organization category distribution"><ChartBox><PieChart><Pie data={dashboard.categoryDistribution || []} dataKey="count" nameKey="category" outerRadius={95} label>{(dashboard.categoryDistribution || []).map((entry, index) => <Cell key={entry.category} fill={colors[index % colors.length]} />)}</Pie><Tooltip /></PieChart></ChartBox></ChartCard>
      <ChartCard title="Dealer count by organization"><ChartBox><BarChart data={dashboard.dealersByOrganization || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="organization" hide /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#0EA5E9" radius={[6, 6, 0, 0]} /></BarChart></ChartBox></ChartCard>
    </div>
    <SectionCard title="Recently created organizations" className="mt-6"><OrganizationTable rows={dashboard.recentOrganizations || []} compact /></SectionCard>
  </div>;
}

function ChartBox({ children }) { return <div className="h-72"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>; }

function OrganizationForm({ form, setForm, onSubmit, saving }) {
  const field = (key, label, props = {}) => <TextField label={label} value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />;
  return <div><PageHeader eyebrow="Create Organization" title="New organization and Admin CEO" description="Creates the organization and its linked Admin CEO directly, without licensing or approval steps." />
    <SectionCard title="Organization details"><FormGrid onSubmit={onSubmit}>
      {field("companyName", "Organization / company name", { required: true })}{field("category", "Category", { required: true, placeholder: "Enter a custom category" })}
      {field("description", "Description (optional)")}{field("phone", "Organization phone", { required: true })}
      {field("address", "Address (optional)")}{field("city", "City (optional)")}{field("state", "State (optional)")}{field("pincode", "Pincode (optional)")}
      {field("startDate", "Start date", { type: "date", required: true })}{field("endDate", "End date (optional)", { type: "date" })}
      <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option></Select>
      <div className="md:col-span-2 mt-2 border-t border-slate-200 pt-4"><h3 className="font-semibold text-slate-900">Admin CEO details</h3></div>
      {field("adminName", "Admin CEO name", { required: true })}{field("adminEmail", "Admin CEO email", { type: "email", required: true })}{field("adminPhone", "Admin CEO phone", { required: true })}
      {field("password", "Password", { type: "password", minLength: 6, required: true })}{field("confirmPassword", "Confirm password", { type: "password", minLength: 6, required: true })}
      <div className="md:col-span-2"><Button type="submit" disabled={saving}><Plus size={16} /> {saving ? "Creating..." : "Create Organization"}</Button></div>
    </FormGrid></SectionCard>
  </div>;
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
    { header: "Dealers", key: "totalDealers" }, { header: "Status", render: (row) => <StatusBadge value={row.status} /> },
    { header: "Created", render: (row) => formatDate(row.createdAt) }
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
