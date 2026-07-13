import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Plus, Save, Send, ShieldCheck } from "lucide-react";
import Layout from "../components/Layout";
import { api } from "../api/client";
import { Button, EmptyState, Loading, PageHeader, SectionCard, StatCard, StatusBadge, TextField, formatMoney } from "../components/UI";
import { roleTabs } from "../utils/profileNavigation";

const endpointByRole = {
  SUPER_ADMIN_CEO: "/super-admin-ceo/dashboard",
  SUPER_ADMIN_IT_MANAGER: "/super-admin-it/dashboard",
  SUPER_ADMIN_SALES_MANAGER: "/super-admin-sales/dashboard",
  SUPER_ADMIN_FINANCE_MANAGER: "/super-admin-finance/dashboard"
};

const titleByRole = {
  SUPER_ADMIN_CEO: "CEO Dashboard",
  SUPER_ADMIN_IT_MANAGER: "IT Manager Dashboard",
  SUPER_ADMIN_SALES_MANAGER: "Sales Manager Dashboard",
  SUPER_ADMIN_FINANCE_MANAGER: "Finance Manager Dashboard"
};

export default function SuperAdminRoleDashboard({ role }) {
  const tabs = roleTabs[role] || [];
  const [activeTab, setActiveTab] = useState("dashboard");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: payload } = await api.get(endpointByRole[role]);
      setData(payload);
    } catch (err) {
      setData(null);
      setError(err.response?.data?.message || "Dashboard data could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [role]);

  const notify = (text) => {
    setMessage(text);
    setError("");
    load();
  };
  const fail = (err, fallback) => {
    setError(err.response?.data?.message || fallback);
    setMessage("");
  };

  if (loading) return <Layout title={titleByRole[role]} subtitle="Super Admin operations" tabs={tabs} activeTab={activeTab} onTab={setActiveTab}><Loading /></Layout>;

  return (
    <Layout title={titleByRole[role]} subtitle="Internal hierarchy and license management" tabs={tabs} activeTab={activeTab} onTab={setActiveTab}>
      <PageHeader eyebrow="Super Admin" title={titleByRole[role]} description="Manage licenses, approvals, payments, manager tasks and internal communication." />
      {message && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{message}</div>}
      {error && <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
      {!data ? (
        <SectionCard title="Dashboard unavailable">
          <EmptyState text="We could not load this dashboard. Check your connection and try again." />
          <div className="mt-4 flex justify-center"><Button variant="ghost" onClick={load}>Try again</Button></div>
        </SectionCard>
      ) : (
        <>
          {role === "SUPER_ADMIN_CEO" && <CeoView activeTab={activeTab} data={data} notify={notify} fail={fail} />}
          {role === "SUPER_ADMIN_IT_MANAGER" && <ItView activeTab={activeTab} data={data} notify={notify} fail={fail} />}
          {role === "SUPER_ADMIN_SALES_MANAGER" && <SalesView activeTab={activeTab} data={data} notify={notify} fail={fail} />}
          {role === "SUPER_ADMIN_FINANCE_MANAGER" && <FinanceView activeTab={activeTab} data={data} notify={notify} fail={fail} />}
          {["chat"].includes(activeTab) && <ChatPanel />}
        </>
      )}
    </Layout>
  );
}

function StatGrid({ stats }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map(([label, value]) => (
        <StatCard key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function DataTable({ title, rows = [], cols }) {
  return (
    <SectionCard title={title}>
      {rows.length ? <div className="max-h-[38rem] overflow-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100/95 text-xs font-bold uppercase tracking-wide text-slate-500 backdrop-blur">
            <tr>{cols.map((col) => <th key={col.key} className={`whitespace-nowrap px-4 py-3 ${col.className || ""}`}>{col.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={row.id || index} className="odd:bg-white even:bg-stone-50/60 transition hover:bg-blue-50/60">
                {cols.map((col) => <td key={col.key} className={`px-4 py-3 text-slate-700 ${col.className || ""}`}>{col.render ? col.render(row) : row[col.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div> : <EmptyState text={`No ${title.toLowerCase()} found`} />}
    </SectionCard>
  );
}

function requestColumns(actions) {
  return [
    { key: "company", label: "Company", render: (r) => r.Company?.companyName || "-" },
    { key: "dealers", label: "Dealers", render: (r) => `${r.currentDealerCount || 0}/${r.currentLicenseCapacity || 0}` },
    { key: "license", label: "License", render: (r) => `${r.LicensePlan?.name || "-"} x ${r.quantity}` },
    { key: "limit", label: "Capacity Added", render: (r) => r.totalDealerLimit },
    { key: "amount", label: "Amount", render: (r) => formatMoney(r.amount) },
    { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
    { key: "payment", label: "Payment", render: (r) => <StatusBadge value={r.paymentStatus} /> },
    ...(actions ? [{ key: "actions", label: "Actions", render: actions }] : [])
  ];
}

function CeoView({ activeTab, data, notify, fail }) {
  const [manager, setManager] = useState({ name: "", email: "", phone: "", password: "", role: "SUPER_ADMIN_IT_MANAGER", status: "active" });
  const [target, setTarget] = useState({ assignedTo: "", title: "", targetType: "GENERAL", targetValue: 0, startDate: "", endDate: "", description: "" });
  const [pin, setPin] = useState({ assignedTo: "", roleTarget: "", title: "", message: "" });
  const [viewCompany, setViewCompany] = useState(null);
  const stats = [
    ["Companies", data.totalCompanies || 0],
    ["Active Companies", data.activeCompanies || 0],
    ["Pending Companies", data.pendingCompanies || 0],
    ["Blocked Companies", data.blockedCompanies || 0],
    ["Company Admins", data.totalCompanyAdmins || 0],
    ["Dealers", data.totalDealers || 0],
    ["Licenses Sold", data.soldLicenses || 0],
    ["Revenue", formatMoney(data.revenue || 0)],
    ["Pending Payments", data.pendingPayments || 0],
    ["Expiring Soon", data.expiringSubscriptions || 0]
  ];
  const createManager = async (e) => {
    e.preventDefault();
    try {
      await api.post("/super-admin-ceo/managers", manager);
      setManager({ name: "", email: "", phone: "", password: "", role: "SUPER_ADMIN_IT_MANAGER", status: "active" });
      notify("Manager created successfully");
    } catch (err) { fail(err, "Unable to create manager"); }
  };
  const createTarget = async (e) => {
    e.preventDefault();
    try {
      await api.post("/super-admin-ceo/targets", target);
      setTarget({ assignedTo: "", title: "", targetType: "GENERAL", targetValue: 0, startDate: "", endDate: "", description: "" });
      notify("Target created successfully");
    } catch (err) { fail(err, "Unable to create target"); }
  };
  const createPin = async (e) => {
    e.preventDefault();
    try {
      await api.post("/super-admin-ceo/pinned-messages", { ...pin, assignedTo: pin.assignedTo || null, roleTarget: pin.roleTarget || null });
      setPin({ assignedTo: "", roleTarget: "", title: "", message: "" });
      notify("Pinned message created successfully");
    } catch (err) { fail(err, "Unable to create pinned message"); }
  };
  const editManager = async (managerRow) => {
    const name = window.prompt("Manager name", managerRow.name);
    if (!name) return;
    try {
      await api.put(`/super-admin-ceo/managers/${managerRow.id}`, { name });
      notify("Manager updated");
    } catch (err) { fail(err, "Unable to update manager"); }
  };
  const toggleManager = async (managerRow) => {
    try {
      await api.patch(`/super-admin-ceo/managers/${managerRow.id}/status`, { status: managerRow.status === "active" ? "inactive" : "active" });
      notify(managerRow.status === "active" ? "Manager blocked" : "Manager unblocked");
    } catch (err) { fail(err, "Unable to update manager status"); }
  };
  const deleteManager = async (managerRow) => {
    if (!window.confirm(`Delete ${managerRow.name}? This will disable login but keep audit history.`)) return;
    try {
      await api.delete(`/super-admin-ceo/managers/${managerRow.id}`);
      notify("Manager deleted safely");
    } catch (err) { fail(err, "Unable to delete manager"); }
  };
  const toggleCompany = async (company) => {
    const action = company.status === "blocked" ? "unblock" : "block";
    if (!window.confirm(`${action === "block" ? "Block" : "Unblock"} ${company.companyName}?`)) return;
    try {
      await api.patch(`/super-admin-ceo/companies/${company.id}/${action}`);
      notify(`Company ${action === "block" ? "blocked" : "unblocked"}`);
    } catch (err) { fail(err, "Unable to update company"); }
  };

  const companyCols = [
    { key: "companyName", label: "Company" },
    { key: "category", label: "Category" },
    { key: "admin", label: "Admin CEO", render: (r) => <div><p className="font-semibold">{r.adminCeoName || "-"}</p><p className="text-xs text-slate-500">{r.adminCeoEmail || "-"}</p></div> },
    { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> },
    { key: "paymentStatus", label: "Payment", render: (r) => <StatusBadge value={r.paymentStatus} /> },
    { key: "subscriptionAmount", label: "Subscription", render: (r) => formatMoney(r.subscriptionAmount) },
    { key: "dates", label: "Subscription Dates", render: (r) => `${r.startDate || "-"} to ${r.endDate || "-"}` },
    { key: "dealers", label: "Dealers", render: (r) => `${r.usedDealerSlots || 0}/${r.totalLicenseCapacity || 0}` },
    { key: "remainingDealerSlots", label: "Remaining" },
    { key: "createdBySalesManagerName", label: "Sales Manager" },
    { key: "financeApprovedByName", label: "Finance Approved By" },
    { key: "createdAt", label: "Created", render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-" },
    { key: "actions", label: "Actions", className: "w-44 whitespace-nowrap", render: (r) => <div className="flex flex-nowrap gap-2"><Button variant="ghost" className="min-h-8 whitespace-nowrap px-3 py-1" onClick={() => setViewCompany(r)}>View</Button><Button variant={r.status === "blocked" ? "soft" : "danger"} className="min-h-8 whitespace-nowrap px-3 py-1" onClick={() => toggleCompany(r)}>{r.status === "blocked" ? "Unblock" : "Block"}</Button></div> }
  ];

  if (activeTab === "dashboard") return <div className="space-y-6"><StatGrid stats={stats} /><DataTable title="Company & Admin Details" rows={data.companies || []} cols={companyCols} /><DataTable title="Top companies by licenses" rows={data.topCompanies || []} cols={[{ key: "companyName", label: "Company" }, { key: "dealers", label: "Dealers" }, { key: "dealerCapacity", label: "Capacity" }, { key: "licenseQuantity", label: "Licenses" }]} />{viewCompany && <CompanyDetailsModal company={viewCompany} onClose={() => setViewCompany(null)} onToggle={toggleCompany} />}</div>;
  if (activeTab === "companies") return <><DataTable title="Company & Admin Details" rows={data.companies || []} cols={companyCols} />{viewCompany && <CompanyDetailsModal company={viewCompany} onClose={() => setViewCompany(null)} onToggle={toggleCompany} />}</>;
  if (activeTab === "licenses") return <DataTable title="License inventory" rows={data.inventory || []} cols={[{ key: "plan", label: "Plan", render: (r) => r.LicensePlan?.name }, { key: "totalQuantity", label: "Total" }, { key: "availableQuantity", label: "Available" }, { key: "soldQuantity", label: "Sold" }]} />;
  if (activeTab === "managers") return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <SectionCard title="Create Manager">
        <form onSubmit={createManager} className="grid gap-3">
          <TextField label="Name" value={manager.name} onChange={(e) => setManager({ ...manager, name: e.target.value })} required />
          <TextField label="Email" value={manager.email} onChange={(e) => setManager({ ...manager, email: e.target.value })} required />
          <TextField label="Phone" value={manager.phone} onChange={(e) => setManager({ ...manager, phone: e.target.value })} />
          <TextField label="Password" value={manager.password} onChange={(e) => setManager({ ...manager, password: e.target.value })} required />
          <label className="text-sm font-semibold text-slate-600">Role<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={manager.role} onChange={(e) => setManager({ ...manager, role: e.target.value })}><option value="SUPER_ADMIN_IT_MANAGER">IT Manager</option><option value="SUPER_ADMIN_SALES_MANAGER">Sales Manager</option><option value="SUPER_ADMIN_FINANCE_MANAGER">Finance Manager</option></select></label>
          <Button type="submit"><Plus size={16} /> Create Manager</Button>
        </form>
      </SectionCard>
      <DataTable title="Managers" rows={data.managers || []} cols={[{ key: "name", label: "Name" }, { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "role", label: "Role", render: (r) => <StatusBadge value={r.role} /> }, { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> }, { key: "actions", label: "Actions", className: "w-72 whitespace-nowrap", render: (r) => <div className="flex flex-nowrap gap-2"><button className="whitespace-nowrap rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white" onClick={() => editManager(r)}>Edit</button><button className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold text-white ${r.status === "active" ? "bg-amber-500" : "bg-emerald-600"}`} onClick={() => toggleManager(r)}>{r.status === "active" ? "Block" : "Unblock"}</button><button className="whitespace-nowrap rounded-md bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white" onClick={() => deleteManager(r)}>Delete</button></div> }]} />
    </div>
  );
  if (activeTab === "targets") return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <SectionCard title="Set Target"><form onSubmit={createTarget} className="grid gap-3"><label className="text-sm font-semibold text-slate-600">Assign To<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={target.assignedTo} onChange={(e) => setTarget({ ...target, assignedTo: e.target.value })} required><option value="">Select manager</option>{(data.managers || []).map((m) => <option key={m.id} value={m.id}>{m.name} - {m.role.replaceAll("_", " ")}</option>)}</select></label><TextField label="Title" value={target.title} onChange={(e) => setTarget({ ...target, title: e.target.value })} required /><TextField label="Target Value" type="number" value={target.targetValue} onChange={(e) => setTarget({ ...target, targetValue: e.target.value })} /><TextField label="Start Date" type="date" value={target.startDate} onChange={(e) => setTarget({ ...target, startDate: e.target.value })} /><TextField label="End Date" type="date" value={target.endDate} onChange={(e) => setTarget({ ...target, endDate: e.target.value })} /><Button type="submit"><Save size={16} /> Save Target</Button></form></SectionCard>
      <DataTable title="Targets" rows={data.targets || []} cols={[{ key: "title", label: "Title" }, { key: "assignee", label: "Assigned To", render: (r) => r.assignee?.name }, { key: "targetValue", label: "Target" }, { key: "achievedValue", label: "Achieved" }, { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> }]} />
    </div>
  );
  if (activeTab === "pinned") return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <SectionCard title="Pinned Message"><form onSubmit={createPin} className="grid gap-3"><TextField label="Title" value={pin.title} onChange={(e) => setPin({ ...pin, title: e.target.value })} required /><label className="text-sm font-semibold text-slate-600">Assign To<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={pin.assignedTo} onChange={(e) => setPin({ ...pin, assignedTo: e.target.value })}><option value="">All managers</option>{(data.managers || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label><textarea className="min-h-28 rounded-md border border-slate-200 p-3 text-sm" value={pin.message} onChange={(e) => setPin({ ...pin, message: e.target.value })} required /><Button type="submit"><MessageSquare size={16} /> Pin Message</Button></form></SectionCard>
      <DataTable title="Pinned Messages" rows={data.pinnedMessages || []} cols={[{ key: "title", label: "Title" }, { key: "message", label: "Message" }, { key: "assignee", label: "Assigned To", render: (r) => r.assignee?.name || r.roleTarget || "All managers" }]} />
    </div>
  );
  return null;
}

function CompanyDetailsModal({ company, onClose, onToggle }) {
  const tiles = [
    ["Company Details", [["Company", company.companyName], ["Category", company.category], ["Status", company.status], ["Payment", company.paymentStatus], ["Subscription", formatMoney(company.subscriptionAmount)], ["Start Date", company.startDate || "-"], ["End Date", company.endDate || "-"], ["Created", company.createdAt ? new Date(company.createdAt).toLocaleString() : "-"]]],
    ["Admin CEO Details", [["Name", company.adminCeoName || company.adminName], ["Email", company.adminCeoEmail || company.adminEmail], ["Phone", company.phone || "-"], ["Role", "ADMIN CEO"], ["Account Status", company.adminStatus || "-"]]],
    ["License Details", [["License Type", company.licenseDetails?.[0]?.licenseType || company.selectedLicense || "-"], ["License Quantity", company.totalLicenses || company.selectedLicenseQuantity || 0], ["Total Dealer Capacity", company.totalLicenseCapacity || 0], ["Used Dealer Slots", company.usedDealerSlots || 0], ["Remaining Dealer Slots", company.remainingDealerSlots || 0], ["Activated", company.licenseDetails?.[0]?.activatedAt ? new Date(company.licenseDetails[0].activatedAt).toLocaleDateString() : "-"], ["Expiry", company.licenseDetails?.[0]?.expiresAt || company.endDate || "-"]]],
    ["Dealer Summary", [["Total Dealers", company.totalDealers || 0], ["Active Dealers", company.activeDealers || 0], ["Blocked Dealers", company.blockedDealers || 0], ["City / Area", company.areaSummary || "-"]]],
    ["Finance Summary", [["Subscription Amount", formatMoney(company.subscriptionAmount)], ["Paid Amount", formatMoney(company.paidAmount || 0)], ["Pending Amount", formatMoney(company.pendingAmount || 0)], ["Revenue Contribution", formatMoney(company.revenueContribution || 0)]]]
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-md bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Company view</p>
            <h2 className="text-xl font-semibold text-slate-950">{company.companyName}</h2>
            <p className="mt-1 text-sm text-slate-500">Subscription {company.subscriptionStatus || "active"}{company.daysRemaining !== null && company.daysRemaining !== undefined ? ` | ${company.daysRemaining} days remaining` : ""}</p>
          </div>
          <button className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={onClose}>Close</button>
        </div>
        <div className="max-h-[68vh] overflow-y-auto p-5">
          <div className="grid gap-4 md:grid-cols-2">
            {tiles.map(([title, rows]) => (
              <div key={title} className="rounded-md border border-slate-200 bg-white p-4 shadow-soft">
                <h3 className="font-semibold text-slate-950">{title}</h3>
                <div className="mt-3 divide-y divide-slate-100">
                  {rows.map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-2 text-sm"><span className="text-slate-500">{label}</span><span className="text-right font-semibold text-slate-800">{value}</span></div>)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <Button variant={company.status === "blocked" ? "soft" : "danger"} onClick={() => onToggle(company)}>{company.status === "blocked" ? "Unblock Company" : "Block Company"}</Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function ItView({ activeTab, data, notify, fail }) {
  const [stock, setStock] = useState({ licensePlanId: "", quantity: 1 });
  const [planEdit, setPlanEdit] = useState({});
  const addStock = async (e) => {
    e.preventDefault();
    try { await api.post("/super-admin-it/license-inventory/add-stock", stock); notify("License stock updated"); } catch (err) { fail(err, "Unable to add stock"); }
  };
  const updatePlan = async (plan) => {
    try { await api.put(`/super-admin-it/license-plans/${plan.id}`, planEdit[plan.id] || plan); notify("License plan updated"); } catch (err) { fail(err, "Unable to update plan"); }
  };
  if (activeTab === "dashboard" || activeTab === "inventory") return <div className="space-y-6"><StatGrid stats={[["Plans", data.plans?.length || 0], ["Available Stock", (data.inventory || []).reduce((s, r) => s + Number(r.availableQuantity || 0), 0)], ["Sold", (data.inventory || []).reduce((s, r) => s + Number(r.soldQuantity || 0), 0)], ["Requests", data.requests?.length || 0]]} /><SectionCard title="Increase License Stock"><form onSubmit={addStock} className="grid gap-3 md:grid-cols-3"><label className="text-sm font-semibold text-slate-600">Plan<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={stock.licensePlanId} onChange={(e) => setStock({ ...stock, licensePlanId: e.target.value })} required><option value="">Select plan</option>{(data.plans || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><TextField label="Quantity" type="number" min="1" value={stock.quantity} onChange={(e) => setStock({ ...stock, quantity: e.target.value })} required /><div className="flex items-end"><Button type="submit"><Plus size={16} /> Add Stock</Button></div></form></SectionCard><DataTable title="License Inventory" rows={data.inventory || []} cols={[{ key: "plan", label: "Plan", render: (r) => r.LicensePlan?.name }, { key: "totalQuantity", label: "Total" }, { key: "availableQuantity", label: "Available" }, { key: "soldQuantity", label: "Sold" }]} /></div>;
  if (activeTab === "plans") return <div className="space-y-4">{(data.plans || []).map((plan) => { const draft = planEdit[plan.id] || plan; return <SectionCard key={plan.id} title={`${plan.name} License`}><div className="grid gap-3 md:grid-cols-5"><TextField label="Dealer Limit" type="number" value={draft.dealerLimit} onChange={(e) => setPlanEdit({ ...planEdit, [plan.id]: { ...draft, dealerLimit: e.target.value } })} /><TextField label="Price" type="number" value={draft.price} onChange={(e) => setPlanEdit({ ...planEdit, [plan.id]: { ...draft, price: e.target.value } })} /><TextField label="Description" value={draft.description || ""} onChange={(e) => setPlanEdit({ ...planEdit, [plan.id]: { ...draft, description: e.target.value } })} /><label className="text-sm font-semibold text-slate-600">Status<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={draft.status} onChange={(e) => setPlanEdit({ ...planEdit, [plan.id]: { ...draft, status: e.target.value } })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label><div className="flex items-end"><Button onClick={() => updatePlan(plan)}><Save size={16} /> Save</Button></div></div></SectionCard>; })}</div>;
  return null;
}

function SalesView({ activeTab, data, notify, fail }) {
  const [company, setCompany] = useState({ companyName: "", category: "", adminName: "", adminEmail: "", password: "admin123", subscriptionAmount: 0, startDate: "", endDate: "", initialLicensePlanId: "", selectedLicenseQuantity: 1, notes: "" });
  const [notice, setNotice] = useState({ companyId: "", sendToAll: false, title: "", message: "" });
  const approve = async (id) => { try { await api.patch(`/super-admin-sales/license-requests/${id}/approve`); notify("Request forwarded to finance"); } catch (err) { fail(err, "Unable to approve request"); } };
  const reject = async (id) => { try { await api.patch(`/super-admin-sales/license-requests/${id}/reject`); notify("Request rejected"); } catch (err) { fail(err, "Unable to reject request"); } };
  const createCompany = async (e) => {
    e.preventDefault();
    try {
      await api.post("/super-admin-sales/companies", company);
      setCompany({ companyName: "", category: "", adminName: "", adminEmail: "", password: "admin123", subscriptionAmount: 0, startDate: "", endDate: "", initialLicensePlanId: "", selectedLicenseQuantity: 1, notes: "" });
      notify("Company created in pending payment status");
    } catch (err) { fail(err, "Unable to create company"); }
  };
  const sendNotice = async (e) => {
    e.preventDefault();
    try {
      await api.post("/super-admin-sales/company-notifications", notice);
      setNotice({ companyId: "", sendToAll: false, title: "", message: "" });
      notify("Notification sent");
    } catch (err) { fail(err, "Unable to send notification"); }
  };
  const requests = data.requests || [];
  const rows = activeTab === "pending" ? requests.filter((r) => ["REQUESTED", "FINANCE_PENDING"].includes(r.status)) : activeTab === "confirmed" ? requests.filter((r) => r.status === "LICENSE_DELIVERED") : activeTab === "requests" ? requests : requests;
  return <div className="space-y-6"><StatGrid stats={[["Requested", requests.filter((r) => r.status === "REQUESTED").length], ["Finance Pending", requests.filter((r) => r.status === "FINANCE_PENDING").length], ["Confirmed", requests.filter((r) => r.status === "LICENSE_DELIVERED").length], ["Pending Companies", data.companyRequests?.filter((c) => c.paymentStatus === "PENDING").length || 0]]} />{activeTab === "dashboard" && <SectionCard title="Create Company / Organization"><form onSubmit={createCompany} className="grid gap-3 md:grid-cols-2"><TextField label="Company Name" value={company.companyName} onChange={(e) => setCompany({ ...company, companyName: e.target.value })} required /><TextField label="Category" value={company.category} onChange={(e) => setCompany({ ...company, category: e.target.value })} required /><TextField label="Admin CEO Name" value={company.adminName} onChange={(e) => setCompany({ ...company, adminName: e.target.value })} required /><TextField label="Admin CEO Email" value={company.adminEmail} onChange={(e) => setCompany({ ...company, adminEmail: e.target.value })} required /><TextField label="Admin CEO Password" value={company.password} onChange={(e) => setCompany({ ...company, password: e.target.value })} required /><TextField label="Subscription Amount" type="number" value={company.subscriptionAmount} onChange={(e) => setCompany({ ...company, subscriptionAmount: e.target.value })} /><TextField label="Start Date" type="date" value={company.startDate} onChange={(e) => setCompany({ ...company, startDate: e.target.value })} required /><TextField label="End Date" type="date" value={company.endDate} onChange={(e) => setCompany({ ...company, endDate: e.target.value })} required /><label className="text-sm font-semibold text-slate-600">Initial License Plan<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={company.initialLicensePlanId} onChange={(e) => setCompany({ ...company, initialLicensePlanId: e.target.value })}><option value="">None</option>{(data.plans || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><TextField label="License Quantity" type="number" min="1" value={company.selectedLicenseQuantity} onChange={(e) => setCompany({ ...company, selectedLicenseQuantity: e.target.value })} /><TextField label="Notes" value={company.notes} onChange={(e) => setCompany({ ...company, notes: e.target.value })} /><div className="md:col-span-2"><Button type="submit"><Plus size={16} /> Create Pending Company</Button></div></form></SectionCard>}{activeTab === "createdCompanies" && <div className="space-y-6"><SectionCard title="Send Company Notification"><form onSubmit={sendNotice} className="grid gap-3 md:grid-cols-2"><label className="text-sm font-semibold text-slate-600">Company<select className="mt-1 w-full rounded-md border border-slate-200 p-2.5" value={notice.companyId} onChange={(e) => setNotice({ ...notice, companyId: e.target.value, sendToAll: false })} disabled={notice.sendToAll}><option value="">Select company</option>{(data.createdCompanies || []).map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}</select></label><label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"><input type="checkbox" checked={notice.sendToAll} onChange={(e) => setNotice({ ...notice, sendToAll: e.target.checked, companyId: "" })} /> Send to all my active companies</label><TextField label="Title" value={notice.title} onChange={(e) => setNotice({ ...notice, title: e.target.value })} required /><TextField label="Message" value={notice.message} onChange={(e) => setNotice({ ...notice, message: e.target.value })} required /><div className="md:col-span-2"><Button type="submit"><Send size={16} /> Send Notification</Button></div></form></SectionCard><DataTable title="Created Companies" rows={data.createdCompanies || []} cols={[{ key: "companyName", label: "Company" }, { key: "admin", label: "Admin CEO", render: (r) => <div><p className="font-semibold">{r.adminCeoName}</p><p className="text-xs text-slate-500">{r.adminCeoEmail}</p></div> }, { key: "selectedLicense", label: "License", render: (r) => `${r.selectedLicense || "-"} x ${r.selectedLicenseQuantity || 1}` }, { key: "subscriptionAmount", label: "Amount", render: (r) => formatMoney(r.subscriptionAmount) }, { key: "paymentStatus", label: "Payment", render: (r) => <StatusBadge value={r.paymentStatus} /> }, { key: "status", label: "Status", render: (r) => <StatusBadge value={r.status} /> }, { key: "startDate", label: "Start" }, { key: "endDate", label: "End" }, { key: "licenseDeliveredStatus", label: "License Delivered" }, { key: "createdAt", label: "Created", render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "-" }]} /></div>}<DataTable title="Company Payment Requests" rows={data.companyRequests || []} cols={[{ key: "companyName", label: "Company" }, { key: "adminEmail", label: "Admin CEO Email" }, { key: "subscriptionAmount", label: "Amount", render: (r) => formatMoney(r.subscriptionAmount) }, { key: "paymentStatus", label: "Payment", render: (r) => <StatusBadge value={r.paymentStatus} /> }, { key: "status", label: "Company Status", render: (r) => <StatusBadge value={r.status} /> }]} /><DataTable title="License Purchase Requests" rows={rows} cols={requestColumns((r) => r.status === "REQUESTED" ? <div className="flex flex-nowrap gap-2"><Button onClick={() => approve(r.id)} className="min-h-8 whitespace-nowrap px-3 py-1">Approve</Button><Button variant="danger" onClick={() => reject(r.id)} className="min-h-8 whitespace-nowrap px-3 py-1">Reject</Button></div> : "-")} /></div>;
}

function FinanceView({ activeTab, data, notify, fail }) {
  const [payment, setPayment] = useState({});
  const confirm = async (id) => { try { await api.patch(`/super-admin-finance/payment-requests/${id}/confirm-payment`, payment[id] || {}); notify("Payment confirmed and license delivered"); } catch (err) { fail(err, "Unable to confirm payment"); } };
  const reject = async (id) => { try { await api.patch(`/super-admin-finance/payment-requests/${id}/reject-payment`, payment[id] || {}); notify("Payment rejected"); } catch (err) { fail(err, "Unable to reject payment"); } };
  const approveCompany = async (id) => { try { await api.patch(`/super-admin-finance/company-payment-requests/${id}/approve`); notify("Company payment approved and activated"); } catch (err) { fail(err, "Unable to approve company"); } };
  const rejectCompany = async (id) => { try { await api.patch(`/super-admin-finance/company-payment-requests/${id}/reject`); notify("Company payment rejected"); } catch (err) { fail(err, "Unable to reject company"); } };
  const requests = data.requests || [];
  const rows = activeTab === "revenue" ? requests.filter((r) => r.paymentStatus === "PAID") : requests;
  return <div className="space-y-6"><StatGrid stats={[["Pending Amount", formatMoney(data.totals?.pendingAmount || 0)], ["Paid Amount", formatMoney(data.totals?.paidAmount || 0)], ["Rejected Amount", formatMoney(data.totals?.rejectedAmount || 0)], ["Pending Companies", data.companyRequests?.filter((c) => c.paymentStatus === "PENDING").length || 0]]} /><DataTable title="Company Payment Requests" rows={data.companyRequests || []} cols={[{ key: "companyName", label: "Company" }, { key: "adminEmail", label: "Admin CEO Email" }, { key: "subscriptionAmount", label: "Amount", render: (r) => formatMoney(r.subscriptionAmount) }, { key: "paymentStatus", label: "Payment", render: (r) => <StatusBadge value={r.paymentStatus} /> }, { key: "actions", label: "Actions", render: (r) => r.paymentStatus === "PENDING" ? <div className="flex gap-2"><Button onClick={() => approveCompany(r.id)} className="min-h-8 px-3 py-1">Approve</Button><Button variant="danger" onClick={() => rejectCompany(r.id)} className="min-h-8 px-3 py-1">Reject</Button></div> : "-" }]} /><DataTable title="License Payment Verification" rows={rows} cols={requestColumns((r) => r.status === "FINANCE_PENDING" ? <div className="space-y-2"><input className="w-44 rounded-md border border-slate-200 px-2 py-1 text-xs" placeholder="Transaction reference" value={payment[r.id]?.transactionReference || ""} onChange={(e) => setPayment({ ...payment, [r.id]: { ...(payment[r.id] || {}), transactionReference: e.target.value } })} /><div className="flex gap-2"><Button onClick={() => confirm(r.id)} className="min-h-8 px-3 py-1">Confirm</Button><Button variant="danger" onClick={() => reject(r.id)} className="min-h-8 px-3 py-1">Reject</Button></div></div> : "-")} /></div>;
}

function ChatPanel() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  useEffect(() => { api.get("/super-admin-chat/conversations").then(({ data }) => setUsers(data)); }, []);
  useEffect(() => { if (selected) api.get(`/super-admin-chat/${selected.id}`).then(({ data }) => setMessages(data)); }, [selected]);
  const send = async (e) => {
    e.preventDefault();
    if (!selected || !text.trim()) return;
    await api.post("/super-admin-chat/send", { receiverId: selected.id, message: text.trim() });
    setText("");
    const { data } = await api.get(`/super-admin-chat/${selected.id}`);
    setMessages(data);
  };
  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <SectionCard title="Managers"><div className="space-y-2">{users.map((user) => <button key={user.id} onClick={() => setSelected(user)} className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selected?.id === user.id ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700"}`}><p className="font-semibold">{user.name}</p><p className="text-xs">{user.role.replaceAll("_", " ")}</p></button>)}</div></SectionCard>
      <SectionCard title={selected ? `Chat with ${selected.name}` : "Chat"}>{selected ? <><div className="mb-4 max-h-96 space-y-3 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-4">{messages.map((m) => <div key={m.id} className="rounded-md bg-white p-3 shadow-sm"><p className="text-xs font-semibold text-slate-500">{m.sender?.name}</p><p className="text-sm text-slate-800">{m.message}</p></div>)}</div><form onSubmit={send} className="flex gap-2"><input className="min-h-10 flex-1 rounded-md border border-slate-200 px-3 text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type message" /><Button type="submit"><Send size={16} /> Send</Button></form></> : <div className="grid min-h-48 place-items-center text-sm text-slate-500">Select a manager to start chatting</div>}</SectionCard>
    </div>
  );
}
