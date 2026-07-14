import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Edit3, Eye, EyeOff, Power, RefreshCw, Save, Search, Trash2, UserPlus, X } from "lucide-react";
import { api } from "../api/client";
import { Button, ConfirmModal, Empty, Loading, SectionCard, Select, StatusBadge, TextField, formatDate, formatMoney } from "./UI";

const emptyDealer = { dealerName: "", ownerName: "", email: "", phone: "", password: "dealer123", confirmPassword: "dealer123", area: "", city: "", state: "", address: "", pincode: "", status: "active" };
const emptyFilters = { search: "", ownerName: "", email: "", area: "", city: "", status: "", startDate: "", endDate: "" };
const sortOptions = {
  newest: ["createdAt", "DESC"], oldest: ["createdAt", "ASC"], dealerAsc: ["dealerName", "ASC"],
  dealerDesc: ["dealerName", "DESC"], ownerAsc: ["ownerName", "ASC"], cityAsc: ["city", "ASC"]
};

export default function DealerManagement({ onChanged }) {
  const [form, setForm] = useState(emptyDealer);
  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 1, hasNext: false, hasPrevious: false });
  const [filterOptions, setFilterOptions] = useState({ areas: [], cities: [] });
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = (message, tone = "success") => setToast({ message, tone });
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadDealers = async (targetPage = pagination.page, targetLimit = pagination.limit) => {
    setLoading(true);
    try {
      const [sortBy, sortOrder] = sortOptions[sort];
      const params = new URLSearchParams({ page: String(targetPage), limit: String(targetLimit), sortBy, sortOrder });
      Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
      const { data } = await api.get(`/admin/dealers?${params.toString()}`);
      setRows(data.dealers || []);
      setPagination(data.pagination);
      setFilterOptions(data.filters || { areas: [], cities: [] });
    } catch (error) {
      notify(error.response?.data?.message || "Unable to load dealers", "error");
    } finally { setLoading(false); }
  };

  useEffect(() => { loadDealers(1, pagination.limit); }, [filters, sort]);

  const validate = () => {
    const errors = {};
    if (!form.dealerName.trim()) errors.dealerName = "Dealer name is required";
    if (!form.ownerName.trim()) errors.ownerName = "Owner name is required";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = "Enter a valid email address";
    if (!form.password || form.password.length < 6) errors.password = "Password must be at least 6 characters";
    if (form.password !== form.confirmPassword) errors.confirmPassword = "Passwords do not match";
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) errors.pincode = "Pincode must be 6 digits";
    setFormErrors(errors);
    return !Object.keys(errors).length;
  };

  const createDealer = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const { confirmPassword, ...payload } = form;
      await api.post("/admin/dealers", payload);
      setForm(emptyDealer); setFormErrors({}); notify("Dealer and login account created successfully");
      await loadDealers(1, pagination.limit); onChanged?.();
    } catch (error) { notify(error.response?.data?.message || "Unable to create dealer", "error"); }
    finally { setSaving(false); }
  };

  const openDetails = async (dealer) => {
    setSelected({ dealer, summary: null }); setDetailLoading(true);
    try { const { data } = await api.get(`/admin/dealers/${dealer.id}`); setSelected(data); }
    catch (error) { setSelected(null); notify(error.response?.data?.message || "Unable to load dealer details", "error"); }
    finally { setDetailLoading(false); }
  };

  const saveEdit = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      await api.put(`/admin/dealers/${editing.id}`, editing);
      setEditing(null); setSelected(null); notify("Dealer updated successfully"); await loadDealers(); onChanged?.();
    } catch (error) { notify(error.response?.data?.message || "Unable to update dealer", "error"); }
    finally { setSaving(false); }
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction.type === "delete") {
        const { data } = await api.delete(`/admin/dealers/${confirmAction.dealer.id}`);
        notify(data.message || "Dealer archived safely");
      } else {
        const status = confirmAction.dealer.status === "active" ? "inactive" : "active";
        await api.patch(`/admin/dealers/${confirmAction.dealer.id}/status`, { status });
        notify(`Dealer ${status === "active" ? "activated" : "deactivated"} successfully`);
      }
      setConfirmAction(null); setSelected(null); await loadDealers(); onChanged?.();
    } catch (error) { notify(error.response?.data?.message || "Unable to update dealer", "error"); }
  };

  const applyFilters = () => { setFilters({ ...draftFilters }); setPagination((current) => ({ ...current, page: 1 })); };
  const resetFilters = () => { setDraftFilters(emptyFilters); setFilters(emptyFilters); setSort("newest"); setPagination((current) => ({ ...current, page: 1 })); };
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4));
    return Array.from({ length: Math.min(5, pagination.totalPages) }, (_, index) => start + index);
  }, [pagination]);

  return <div className="space-y-6">
    {toast && <div className={`fixed right-5 top-5 z-[70] max-w-sm rounded-xl border px-4 py-3 text-sm font-semibold shadow-xl ${toast.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{toast.message}</div>}

    <SectionCard title="Create Dealer" actions={<span className="text-xs font-medium text-slate-500">Fields marked * are required</span>}>
      <form onSubmit={createDealer} className="space-y-6">
        <FormSection title="Basic Information">
          <DealerField field="dealerName" label="Dealer Name" required form={form} setForm={setForm} errors={formErrors} />
          <DealerField field="ownerName" label="Owner Name" required form={form} setForm={setForm} errors={formErrors} />
          <DealerField field="email" label="Email" type="email" required form={form} setForm={setForm} errors={formErrors} />
          <DealerField field="phone" label="Phone" form={form} setForm={setForm} errors={formErrors} />
          <PasswordField field="password" label="Password" value={form.password} show={showPassword} toggle={() => setShowPassword((value) => !value)} onChange={(value) => setForm({ ...form, password: value })} error={formErrors.password} />
          <PasswordField field="confirmPassword" label="Confirm Password" value={form.confirmPassword} show={showPassword} toggle={() => setShowPassword((value) => !value)} onChange={(value) => setForm({ ...form, confirmPassword: value })} error={formErrors.confirmPassword} />
        </FormSection>
        <FormSection title="Location Information">
          <DealerField field="area" label="Area" form={form} setForm={setForm} errors={formErrors} />
          <DealerField field="city" label="City" form={form} setForm={setForm} errors={formErrors} />
          <DealerField field="state" label="State" form={form} setForm={setForm} errors={formErrors} />
          <DealerField field="address" label="Address" form={form} setForm={setForm} errors={formErrors} />
          <DealerField field="pincode" label="Pincode" inputMode="numeric" maxLength={6} form={form} setForm={setForm} errors={formErrors} />
        </FormSection>
        <FormSection title="Account Information">
          <Select label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option><option value="blocked">Blocked</option></Select>
        </FormSection>
        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-5"><Button type="submit" disabled={saving}><Save size={16} /> {saving ? "Saving Dealer..." : "Save Dealer"}</Button><Button variant="ghost" onClick={() => { setForm(emptyDealer); setFormErrors({}); }}><RefreshCw size={16} /> Cancel / Reset</Button></div>
      </form>
    </SectionCard>

    <SectionCard title="Our Dealers" actions={<span className="text-sm font-semibold text-slate-500">{pagination.totalItems} dealers</span>}>
      <div className="mb-5 rounded-xl border border-slate-200 bg-stone-50 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterInput label="Dealer Name" value={draftFilters.search} onChange={(value) => setDraftFilters({ ...draftFilters, search: value })} />
          <FilterInput label="Owner Name" value={draftFilters.ownerName} onChange={(value) => setDraftFilters({ ...draftFilters, ownerName: value })} />
          <FilterInput label="Email" value={draftFilters.email} onChange={(value) => setDraftFilters({ ...draftFilters, email: value })} />
          <Select label="Area" value={draftFilters.area} onChange={(event) => setDraftFilters({ ...draftFilters, area: event.target.value, city: "" })}><option value="">All areas</option>{filterOptions.areas.map((area) => <option key={area}>{area}</option>)}</Select>
          <Select label="City" value={draftFilters.city} onChange={(event) => setDraftFilters({ ...draftFilters, city: event.target.value })}><option value="">All cities</option>{filterOptions.cities.map((city) => <option key={city}>{city}</option>)}</Select>
          <Select label="Status" value={draftFilters.status} onChange={(event) => setDraftFilters({ ...draftFilters, status: event.target.value })}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="blocked">Suspended / Blocked</option></Select>
          <TextField label="Created From" type="date" value={draftFilters.startDate} onChange={(event) => setDraftFilters({ ...draftFilters, startDate: event.target.value })} />
          <TextField label="Created To" type="date" value={draftFilters.endDate} onChange={(event) => setDraftFilters({ ...draftFilters, endDate: event.target.value })} />
          <Select label="Sort By" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest Created</option><option value="oldest">Oldest Created</option><option value="dealerAsc">Dealer Name A-Z</option><option value="dealerDesc">Dealer Name Z-A</option><option value="ownerAsc">Owner Name A-Z</option><option value="cityAsc">City A-Z</option></Select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><Button onClick={applyFilters}><Search size={16} /> Apply Filters</Button><Button variant="ghost" onClick={resetFilters}><RefreshCw size={16} /> Reset Filters</Button></div>
      </div>

      {loading ? <Loading /> : rows.length ? <div className="overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="sticky top-0 z-10 bg-slate-100 text-xs font-bold uppercase tracking-wide text-slate-500"><tr>{["Dealer Name", "Owner Name", "Email", "Area", "City", "Address", "Status", "Actions"].map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100 bg-white">{rows.map((dealer) => <tr key={dealer.id} className="even:bg-stone-50/70 hover:bg-indigo-50/60"><td className="px-4 py-3"><button onClick={() => openDetails(dealer)} className="font-semibold text-indigo-700 hover:underline">{dealer.dealerName}</button></td><td className="px-4 py-3 text-slate-700">{dealer.ownerName}</td><td className="px-4 py-3 text-slate-600">{dealer.email}</td><td className="px-4 py-3">{dealer.area || "-"}</td><td className="px-4 py-3">{dealer.city || "-"}</td><td className="max-w-64 truncate px-4 py-3" title={dealer.address}>{dealer.address || "-"}</td><td className="px-4 py-3"><StatusBadge value={dealer.status} /></td><td className="px-4 py-3"><div className="flex items-center gap-1 whitespace-nowrap"><ActionButton label="View" onClick={() => openDetails(dealer)}><Eye size={14} /></ActionButton><ActionButton label="Edit" onClick={() => setEditing({ ...dealer })}><Edit3 size={14} /></ActionButton><ActionButton label={dealer.status === "active" ? "Deactivate" : "Activate"} onClick={() => setConfirmAction({ type: "status", dealer })}><Power size={14} /></ActionButton><ActionButton danger label="Delete" onClick={() => setConfirmAction({ type: "delete", dealer })}><Trash2 size={14} /></ActionButton></div></td></tr>)}</tbody></table></div> : <Empty text="No dealers match the selected filters" />}

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3 text-sm text-slate-600"><span>{pagination.totalItems ? `Showing ${(pagination.page - 1) * pagination.limit + 1}-${Math.min(pagination.page * pagination.limit, pagination.totalItems)} of ${pagination.totalItems} dealers` : "Showing 0 dealers"}</span><Select label="" value={pagination.limit} onChange={(event) => { const limit = Number(event.target.value); setPagination((current) => ({ ...current, limit, page: 1 })); loadDealers(1, limit); }}><option value="10">10 per page</option><option value="25">25 per page</option><option value="50">50 per page</option></Select></div><div className="flex items-center gap-1"><PageButton disabled={!pagination.hasPrevious} onClick={() => loadDealers(pagination.page - 1)}><ChevronLeft size={16} /></PageButton>{pageNumbers.map((page) => <PageButton key={page} active={page === pagination.page} onClick={() => loadDealers(page)}>{page}</PageButton>)}<PageButton disabled={!pagination.hasNext} onClick={() => loadDealers(pagination.page + 1)}><ChevronRight size={16} /></PageButton></div></div>
    </SectionCard>

    <DealerDetailModal value={selected} loading={detailLoading} onClose={() => setSelected(null)} onEdit={(dealer) => { setEditing({ ...dealer }); setSelected(null); }} onStatus={(dealer) => setConfirmAction({ type: "status", dealer })} onDelete={(dealer) => setConfirmAction({ type: "delete", dealer })} />
    <DealerEditModal dealer={editing} setDealer={setEditing} onSubmit={saveEdit} saving={saving} />
    <ConfirmModal open={!!confirmAction} title={confirmAction?.type === "delete" ? "Archive dealer?" : `${confirmAction?.dealer?.status === "active" ? "Deactivate" : "Activate"} dealer?`} description={confirmAction?.type === "delete" ? "The dealer login will be disabled while all order, payment, inventory and credit history is preserved." : `This will ${confirmAction?.dealer?.status === "active" ? "disable" : "restore"} access for ${confirmAction?.dealer?.dealerName || "this dealer"}.`} danger={confirmAction?.type === "delete" || confirmAction?.dealer?.status === "active"} confirmText={confirmAction?.type === "delete" ? "Archive Dealer" : "Confirm"} onConfirm={runConfirmedAction} onClose={() => setConfirmAction(null)} />
  </div>;
}

function FormSection({ title, children }) { return <div className="rounded-xl border border-slate-200 bg-stone-50/60 p-4"><h3 className="mb-4 font-semibold text-slate-900">{title}</h3><div className="grid gap-4 md:grid-cols-2">{children}</div></div>; }
function DealerField({ field, label, required, form, setForm, errors, ...props }) { return <div><TextField label={<>{label}{required && <span className="text-rose-500"> *</span>}</>} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} required={required} {...props} />{errors[field] && <p className="mt-1 text-xs font-medium text-rose-600">{errors[field]}</p>}</div>; }
function PasswordField({ field, label, value, show, toggle, onChange, error }) { return <div><label className="block text-sm font-semibold text-slate-600">{label} <span className="text-rose-500">*</span></label><div className="relative mt-1"><input name={field} type={show ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" required /><button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}</div>; }
function FilterInput({ label, value, onChange }) { return <TextField label={label} value={value} onChange={(event) => onChange(event.target.value)} placeholder={`Search by ${label.toLowerCase()}`} />; }
function ActionButton({ label, children, onClick, danger }) { return <button type="button" onClick={onClick} className={`inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold whitespace-nowrap transition ${danger ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{children}{label}</button>; }
function PageButton({ active, children, ...props }) { return <button type="button" className={`grid h-9 min-w-9 place-items-center rounded-md border px-2 text-sm font-semibold disabled:opacity-40 ${active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`} {...props}>{children}</button>; }

function ModalShell({ title, onClose, children, footer }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4"><h2 className="text-lg font-semibold text-slate-950">{title}</h2><button onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></div><div className="p-5">{children}</div>{footer && <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">{footer}</div>}</div></div>; }

function DealerDetailModal({ value, loading, onClose, onEdit, onStatus, onDelete }) {
  if (!value) return null;
  const dealer = value.dealer;
  const summary = value.summary || {};
  const basic = [["Dealer Name", dealer.dealerName], ["Owner Name", dealer.ownerName], ["Email", dealer.email], ["Phone", dealer.phone], ["Status", dealer.status]];
  const location = [["Area", dealer.area], ["City", dealer.city], ["State", dealer.state], ["Address", dealer.address], ["Pincode", dealer.pincode]];
  const account = [["Created Date", formatDate(dealer.createdAt)], ["Last Updated", formatDate(dealer.updatedAt)], ["Access", dealer.status === "active" ? "Active" : "Inactive"]];
  const business = [["Total Orders", summary.totalOrders ?? 0], ["Approved Orders", summary.approvedOrders ?? 0], ["Delivered Orders", summary.deliveredOrders ?? 0], ["Pending Orders", summary.pendingOrders ?? 0], ["Total Purchase Amount", formatMoney(summary.totalPurchaseAmount || 0)], ["Pending Payment Amount", formatMoney(summary.pendingPaymentAmount || 0)], ["Current Inventory Items", summary.currentInventoryItems ?? 0], ["Low Stock Items", summary.lowStockItems ?? 0], ["Credit Balance", summary.creditBalance ?? 0], ["Last Order Date", summary.lastOrderDate ? formatDate(summary.lastOrderDate) : "No orders yet"]];
  return <ModalShell title="Dealer Details" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button variant="ghost" onClick={() => onEdit(dealer)}><Edit3 size={16} /> Edit Dealer</Button><Button variant="ghost" onClick={() => onStatus(dealer)}><Power size={16} /> {dealer.status === "active" ? "Deactivate" : "Activate"}</Button><Button variant="danger" onClick={() => onDelete(dealer)}><Trash2 size={16} /> Delete</Button></>}>
    {loading ? <Loading /> : <div className="grid gap-5 lg:grid-cols-2"><DetailSection title="Basic Details" rows={basic} /><DetailSection title="Location Details" rows={location} /><DetailSection title="Account Details" rows={account} /><DetailSection title="Business Summary" rows={business} /></div>}
  </ModalShell>;
}
function DetailSection({ title, rows }) { return <section><h3 className="mb-3 font-semibold text-slate-900">{title}</h3><div className="grid gap-2 sm:grid-cols-2">{rows.filter(([, value]) => value !== null && value !== undefined && value !== "").map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-stone-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words font-medium text-slate-900">{String(value)}</p></div>)}</div></section>; }

function DealerEditModal({ dealer, setDealer, onSubmit, saving }) {
  if (!dealer) return null;
  const fields = [["dealerName", "Dealer Name"], ["ownerName", "Owner Name"], ["email", "Email"], ["phone", "Phone"], ["area", "Area"], ["city", "City"], ["state", "State"], ["address", "Address"], ["pincode", "Pincode"]];
  return <ModalShell title="Edit Dealer" onClose={() => setDealer(null)} footer={<><Button variant="ghost" onClick={() => setDealer(null)}>Cancel</Button><Button type="submit" form="dealer-edit-form" disabled={saving}><Save size={16} /> {saving ? "Saving..." : "Save Changes"}</Button></>}><form id="dealer-edit-form" onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">{fields.map(([field, label]) => <TextField key={field} label={label} type={field === "email" ? "email" : "text"} value={dealer[field] || ""} onChange={(event) => setDealer({ ...dealer, [field]: event.target.value })} required={["dealerName", "ownerName", "email"].includes(field)} />)}<Select label="Status" value={dealer.status} onChange={(event) => setDealer({ ...dealer, status: event.target.value })}><option value="active">Active</option><option value="inactive">Inactive</option><option value="blocked">Blocked</option></Select></form></ModalShell>;
}
