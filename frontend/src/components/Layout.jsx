import {
  Bell,
  Building2,
  Boxes,
  ClipboardList,
  CreditCard,
  FileText,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Megaphone,
  Package,
  Star,
  ShieldCheck,
  Truck,
  UserRound,
  Users,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";

const iconMap = {
  companies: Building2,
  dashboard: LayoutDashboard,
  dealers: Users,
  delivery: Truck,
  finance: CreditCard,
  credits: Gift,
  performance: Star,
  inventory: Boxes,
  internalUpdates: Megaphone,
  messages: MessageSquare,
  orders: ClipboardList,
  policies: FileText,
  products: Package,
  profile: UserRound,
  reports: FileText
};

export default function Layout({ title, subtitle, tabs, activeTab, onTab, children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadUpdates, setUnreadUpdates] = useState(0);
  const initials = useMemo(() => (user?.name || user?.email || "DMS").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(), [user]);

  useEffect(() => {
    if (!user || !["ADMIN", "ADMIN_CEO", "DEALER", "DEALER_CEO", "DEALER_STOCK_INVENTORY_MANAGER", "DEALER_STOCK_DELIVERY_MANAGER", "DEALER_SALES_FINANCE_MANAGER", "SUPER_ADMIN", "SUPER_ADMIN_CEO"].includes(user.role)) return;
    api.get("/internal-updates").then((res) => setUnreadUpdates(res.data.unreadCount || 0)).catch(() => setUnreadUpdates(0));
  }, [activeTab, user]);

  const selectTab = (id) => {
    onTab(id);
    setOpen(false);
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-800">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-white/5 bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#0B1120] text-white shadow-2xl shadow-slate-950/20 lg:block">
        <SidebarContent tabs={tabs} activeTab={activeTab} onTab={selectTab} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/50" aria-label="Close sidebar" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 bg-gradient-to-b from-[#0F172A] to-[#0B1120] text-white shadow-2xl">
            <button className="absolute right-4 top-4 rounded-lg p-2 text-slate-300 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
            <SidebarContent tabs={tabs} activeTab={activeTab} onTab={selectTab} />
          </aside>
        </div>
      )}

      <main className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 px-4 shadow-sm shadow-slate-200/30 backdrop-blur-xl lg:px-8">
          <div className="flex min-h-[4.5rem] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
                <Menu size={19} />
              </button>
              <div className="min-w-0">
                <h1 className="truncate font-display text-lg font-bold tracking-tight text-slate-950 md:text-xl">{title}</h1>
                <p className="hidden truncate text-sm text-slate-500 sm:block">{subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => tabs.some((tab) => tab.id === "internalUpdates") && selectTab("internalUpdates")} className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md" title="Notifications">
                <Bell size={18} />
                {unreadUpdates > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">{unreadUpdates}</span>}
              </button>
              <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-sm shadow-indigo-200">{initials}</div>
                <div className="text-right">
                  <p className="max-w-36 truncate text-sm font-semibold text-slate-800">{user?.name || user?.email}</p>
                  <p className="text-xs font-medium text-slate-500">{String(user?.role || "").replaceAll("_", " ")}</p>
                </div>
              </div>
              <button onClick={logout} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" title="Logout">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>
        <section className="mx-auto max-w-[1720px] p-4 md:p-6 lg:p-8">{children}</section>
      </main>
    </div>
  );
}

function SidebarContent({ tabs, activeTab, onTab }) {
  const navigate = useNavigate();
  const location = useLocation();
  const profileSelected = location.pathname === "/profile";
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-indigo-950/40 ring-1 ring-white/15">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="font-display text-lg font-bold tracking-tight">DMS</p>
            <p className="text-xs font-medium text-slate-400">Dealer Management</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
        {tabs.map((tab) => {
          const Icon = iconMap[tab.icon] || LayoutDashboard;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTab(tab.id)}
              className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition duration-200 ${selected ? "bg-gradient-to-r from-blue-600/95 to-indigo-600/90 text-white shadow-lg shadow-blue-950/30 ring-1 ring-white/10" : "text-slate-300 hover:translate-x-0.5 hover:bg-slate-800/80 hover:text-white"}`}
            >
              {selected && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />}
              <Icon className={selected ? "text-white" : "text-slate-400 transition group-hover:text-white"} size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <button
          onClick={() => navigate("/profile")}
          className={`mb-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${profileSelected ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950/30" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
        >
          <UserRound size={18} />
          <span>Profile</span>
        </button>
      </div>
    </div>
  );
}
