import clsx from "clsx";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileUp,
  Inbox,
  Loader2,
  PackageOpen,
  Plus,
  Search,
  Send,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";

const statusTones = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  approved: "border-blue-200 bg-blue-50 text-blue-700",
  blocked: "border-rose-200 bg-rose-50 text-rose-700",
  cash: "border-slate-200 bg-slate-100 text-slate-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
  expired: "border-amber-200 bg-amber-50 text-amber-700",
  failed: "border-rose-200 bg-rose-50 text-rose-700",
  inactive: "border-slate-200 bg-slate-100 text-slate-600",
  suspended: "border-rose-200 bg-rose-50 text-rose-700",
  deleted: "border-slate-300 bg-slate-100 text-slate-600",
  low: "border-amber-200 bg-amber-50 text-amber-700",
  online: "border-indigo-200 bg-indigo-50 text-indigo-700",
  out_for_delivery: "border-amber-200 bg-amber-50 text-amber-700",
  packing: "border-sky-200 bg-sky-50 text-sky-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  requested: "border-yellow-200 bg-yellow-50 text-yellow-700",
  manager_approved: "border-blue-200 bg-blue-50 text-blue-700",
  manager_rejected: "border-red-200 bg-red-50 text-red-700",
  admin_approved: "border-indigo-200 bg-indigo-50 text-indigo-700",
  admin_rejected: "border-red-200 bg-red-50 text-red-700",
  transfer_completed: "border-green-200 bg-green-50 text-green-700",
  cancelled: "border-slate-200 bg-slate-100 text-slate-600",
  sales_approved: "border-blue-200 bg-blue-50 text-blue-700",
  finance_pending: "border-amber-200 bg-amber-50 text-amber-700",
  payment_confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  license_delivered: "border-green-200 bg-green-50 text-green-700",
  payment_rejected: "border-red-200 bg-red-50 text-red-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  shipping: "border-indigo-200 bg-indigo-50 text-indigo-700"
};

const buttonVariants = {
  danger: "bg-rose-600 text-white shadow-sm shadow-rose-200 hover:-translate-y-0.5 hover:bg-rose-700 hover:shadow-md",
  ghost: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md",
  primary: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-200/70 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-200",
  soft: "border border-indigo-100 bg-indigo-50 text-indigo-700 hover:-translate-y-0.5 hover:bg-indigo-100 hover:shadow-sm",
  success: "bg-emerald-600 text-white shadow-sm shadow-emerald-200 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md",
  warning: "bg-amber-500 text-white shadow-sm shadow-amber-200 hover:-translate-y-0.5 hover:bg-amber-600 hover:shadow-md"
};

const cardTones = {
  amber: {
    accent: "from-amber-400 to-orange-500",
    icon: "bg-amber-50 text-amber-700 ring-amber-100",
    glow: "group-hover:shadow-amber-100/80"
  },
  emerald: {
    accent: "from-emerald-400 to-teal-500",
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    glow: "group-hover:shadow-emerald-100/80"
  },
  indigo: {
    accent: "from-blue-500 to-indigo-600",
    icon: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    glow: "group-hover:shadow-indigo-100/80"
  },
  violet: {
    accent: "from-violet-500 to-purple-600",
    icon: "bg-violet-50 text-violet-700 ring-violet-100",
    glow: "group-hover:shadow-violet-100/80"
  },
  rose: {
    accent: "from-rose-500 to-red-600",
    icon: "bg-rose-50 text-rose-700 ring-rose-100",
    glow: "group-hover:shadow-rose-100/80"
  },
  sky: {
    accent: "from-sky-400 to-cyan-600",
    icon: "bg-sky-50 text-sky-700 ring-sky-100",
    glow: "group-hover:shadow-sky-100/80"
  },
  slate: {
    accent: "from-slate-400 to-slate-600",
    icon: "bg-slate-100 text-slate-700 ring-slate-200",
    glow: "group-hover:shadow-slate-200/80"
  }
};

function inferCardTone(label = "") {
  const text = label.toLowerCase();
  if (/reject|alert|blocked|failed|overdue|out of stock/.test(text)) return "rose";
  if (/pending|order|low stock|expire/.test(text)) return "amber";
  if (/paid|revenue|sale|success|active|delivered|received/.test(text)) return "emerald";
  if (/credit|reward|wallet/.test(text)) return "violet";
  if (/delivery|shipping|dispatch/.test(text)) return "sky";
  if (/stock|product|inventory|company|dealer/.test(text)) return "indigo";
  return "slate";
}

export function formatMoney(value) {
  const numeric = Number(value || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(numeric);
}

export function formatDate(value, fallback = "-") {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return format(parsed, "dd MMM yyyy");
}

export function cn(...classes) {
  return clsx(classes);
}

export function Button({ children, className, variant = "primary", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant] || buttonVariants.primary,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DashboardCard({ label, value, icon: Icon = PackageOpen, tone, helper }) {
  const resolvedTone = cardTones[tone] ? tone : inferCardTone(label);
  const style = cardTones[resolvedTone];
  return (
    <div className={clsx("group relative isolate min-h-36 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card transition duration-200 hover:-translate-y-1 hover:border-slate-200 hover:shadow-xl", style.glow)}>
      <div className={clsx("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", style.accent)} />
      <div className="absolute -right-10 -top-12 -z-10 h-32 w-32 rounded-full bg-slate-50 transition duration-300 group-hover:scale-125" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value ?? 0}</p>
        </div>
        <div className={clsx("grid h-12 w-12 shrink-0 place-items-center rounded-xl ring-1 transition duration-200 group-hover:-translate-y-0.5 group-hover:scale-105", style.icon)}>
          <Icon size={20} />
        </div>
      </div>
      {helper && <p className="mt-3 border-t border-slate-100 pt-3 text-xs font-medium text-slate-500">{helper}</p>}
    </div>
  );
}

export function StatCard(props) {
  return <DashboardCard {...props} />;
}

export function Card(props) {
  return <DashboardCard {...props} />;
}

export function SectionCard({ title, actions, children, className }) {
  return (
    <section className={clsx("overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card transition-shadow duration-200 hover:shadow-card-hover", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/60 px-5 py-4">
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">{title}</h2>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Section(props) {
  return <SectionCard className="mt-6" {...props} />;
}

export function ChartCard({ title, actions, children }) {
  return <SectionCard title={title} actions={actions}>{children}</SectionCard>;
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ value }) {
  const normalized = String(value || "").toLowerCase();
  const tone = statusTones[normalized] || "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold capitalize shadow-sm", tone)}>
      {String(value || "-").replaceAll("_", " ")}
    </span>
  );
}

export function PaymentBadge({ value }) {
  return <StatusBadge value={value} />;
}

export function TextField({ label, className, icon: Icon, ...props }) {
  return (
    <label className={clsx("block", className)}>
      {label && <span className="text-sm font-semibold text-slate-600">{label}</span>}
      <div className="relative mt-1">
        {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />}
        <input
          className={clsx(
            "w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100",
            Icon && "pl-10"
          )}
          {...props}
        />
      </div>
    </label>
  );
}

export function FormInput(props) {
  return <TextField {...props} />;
}

export function Select({ label, children, className, ...props }) {
  return (
    <label className={clsx("block", className)}>
      {label && <span className="text-sm font-semibold text-slate-600">{label}</span>}
      <select className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" {...props}>
        {children}
      </select>
    </label>
  );
}

export function FormSelect(props) {
  return <Select {...props} />;
}

export function FormGrid({ children, onSubmit, className, ...props }) {
  return <form onSubmit={onSubmit} className={clsx("grid gap-4 md:grid-cols-2", className)} {...props}>{children}</form>;
}

export function SearchFilterBar({ search, onSearch, placeholder = "Search", children }) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50/80 p-3 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
        <input
          className="w-full rounded-md border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      {children}
    </div>
  );
}

export function DataTable({ columns, rows = [], emptyText = "No records found" }) {
  if (!rows.length) return <EmptyState text={emptyText} />;
  return (
    <div className="max-h-[38rem] overflow-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-100/95 text-xs font-bold uppercase tracking-wide text-slate-500 backdrop-blur">
          <tr>{columns.map((col) => <th className="px-4 py-3" key={col.key || col.header}>{col.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row, index) => (
            <tr key={row.id || index} className="odd:bg-white even:bg-slate-50/50 transition hover:bg-blue-50/60">
              {columns.map((col) => <td className="px-4 py-3 align-middle text-slate-700" key={col.key || col.header}>{col.render ? col.render(row, index) : String(row[col.key] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ text = "No records found", icon: Icon = Inbox }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white p-10 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400"><Icon size={24} /></span>
      <p className="mt-3 text-sm font-semibold text-slate-600">{text}</p>
    </div>
  );
}

export function Empty(props) {
  return <EmptyState {...props} />;
}

export function LoadingSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  );
}

export function Loading() {
  return (
    <div className="grid min-h-64 place-items-center text-indigo-600">
      <div className="rounded-md border border-indigo-100 bg-white p-5 shadow-soft">
        <Loader2 className="animate-spin" />
      </div>
    </div>
  );
}

export function ConfirmModal({ open, title, description, confirmText = "Confirm", cancelText = "Cancel", onConfirm, onClose, danger }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-md bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            {description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}
          </div>
          <button className="rounded-md p-1 text-slate-400 hover:bg-slate-100" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{cancelText}</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmText}</Button>
        </div>
      </div>
    </div>
  );
}

export function FileUploadPreview({ label = "Upload file", preview, accept, onChange }) {
  return (
    <label className="block rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-indigo-300 hover:bg-indigo-50/40">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700"><UploadCloud size={17} /> {label}</span>
      <input className="sr-only" type="file" accept={accept} onChange={onChange} />
      {preview ? <img src={preview} alt="Preview" className="mt-3 h-28 w-28 rounded-md object-cover" /> : <p className="mt-2 text-xs text-slate-500">Choose a file to preview before saving.</p>}
    </label>
  );
}

export function DeliveryTimeline({ order }) {
  const steps = [
    ["packing", "Packing", order?.packingDate],
    ["shipping", "Shipping", order?.shippingDate],
    ["out_for_delivery", "Out For Delivery", order?.outForDeliveryDate],
    ["delivered", "Delivered", order?.deliveredDate]
  ];
  const status = order?.status === "approved" ? "packing" : order?.status;
  const activeIndex = Math.max(steps.findIndex(([key]) => key === status), 0);
  const progress = order?.progressPercentage ?? order?.deliveryProgress ?? (order?.status === "delivered" ? 100 : activeIndex * 33);
  return (
    <div className="mt-4">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {steps.map(([key, label, date], index) => {
          const complete = order?.status === "delivered" || index < activeIndex;
          const active = index === activeIndex && order?.status !== "delivered";
          return (
            <div key={key} className="text-center">
              <span className={clsx("mx-auto mb-2 grid h-7 w-7 place-items-center rounded-full border text-xs", complete && "border-emerald-500 bg-emerald-500 text-white", active && "border-indigo-500 bg-indigo-500 text-white", !complete && !active && "border-slate-300 bg-white text-slate-400")}>
                {complete ? <CheckCircle2 size={14} /> : active ? <Clock size={14} /> : index + 1}
              </span>
              <p className={clsx("text-xs font-semibold", complete || active ? "text-slate-800" : "text-slate-400")}>{label}</p>
              <p className="mt-1 text-[11px] text-slate-400">{formatDate(date)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChatWindow({ messages = [], mine, value, onChange, onSend, placeholder = "Type a message" }) {
  return (
    <div>
      <div className="h-96 space-y-3 overflow-y-auto rounded-md bg-slate-50 p-4">
        {messages.length ? messages.map((message) => {
          const isMine = mine?.(message);
          const highlighted = message.messageType === "stock_request";
          return (
            <div key={message.id} className={clsx("flex", isMine ? "justify-end" : "justify-start")}>
              <div className={clsx("max-w-[80%] rounded-md px-3 py-2 text-sm shadow-sm", isMine ? "bg-indigo-600 text-white" : "border border-slate-200 bg-white text-slate-700", highlighted && "ring-2 ring-amber-200")}>
                {message.title && <p className={clsx("mb-1 text-xs font-bold", isMine ? "text-indigo-100" : "text-slate-500")}>{message.title}</p>}
                <p>{message.message}</p>
                {highlighted && <p className="mt-1 text-[11px] opacity-80">Requested: {message.requestedQuantity}, available: {message.availableStock}</p>}
                <p className="mt-1 text-[11px] opacity-75">{message.createdAt ? new Date(message.createdAt).toLocaleString() : ""}</p>
              </div>
            </div>
          );
        }) : <EmptyState text="No messages in this conversation" />}
      </div>
      <form onSubmit={onSend} className="mt-3 flex gap-2">
        <input className="flex-1 rounded-md border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required />
        <Button type="submit"><Send size={16} /> Send</Button>
      </form>
    </div>
  );
}

export function ActionIcon({ danger, className, ...props }) {
  return <button className={clsx("inline-flex h-9 w-9 items-center justify-center rounded-md transition", danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-600 hover:bg-slate-100", className)} {...props} />;
}

export function ActionButton({ compact = true, className, ...props }) {
  return <Button className={clsx(compact && "min-h-9 px-3 py-1.5 text-xs", className)} {...props} />;
}

export function InlineAlert({ children, tone = "warning" }) {
  const styles = tone === "danger" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-800";
  const Icon = tone === "danger" ? AlertTriangle : FileUp;
  return <div className={clsx("flex items-start gap-2 rounded-md border p-3 text-sm font-semibold", styles)}><Icon size={17} /> {children}</div>;
}

export { ArrowRight, Plus, Search, Trash2 };
