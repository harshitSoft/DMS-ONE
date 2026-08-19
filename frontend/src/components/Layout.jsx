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

export default function Layout({ title, subtitle, tabs, activeTab, onTab, children, terminal = false }) {
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
    <div className={terminal ? "min-h-screen bg-[#0A0D16] text-[#DCE1F2]" : "min-h-screen bg-transparent text-slate-800"}>
      <aside className={`fixed inset-y-0 left-0 z-40 hidden border-r text-white shadow-2xl lg:block ${terminal ? "w-20 border-[#1B2036] bg-[#0C0F1A] shadow-black/30 xl:w-72" : "w-72 border-white/5 bg-gradient-to-b from-[#0F172A] via-[#111827] to-[#0B1120] shadow-slate-950/20"}`}>
        <SidebarContent tabs={tabs} activeTab={activeTab} onTab={selectTab} terminal={terminal} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-slate-950/50" aria-label="Close sidebar" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 bg-gradient-to-b from-[#0F172A] to-[#0B1120] text-white shadow-2xl">
            <button className="absolute right-4 top-4 rounded-lg p-2 text-slate-300 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
            <SidebarContent tabs={tabs} activeTab={activeTab} onTab={selectTab} terminal={terminal} />
          </aside>
        </div>
      )}

      <main className={terminal ? "bg-[radial-gradient(circle_at_0%_0%,#1B2140_0%,#0A0D16_34%)] lg:pl-20 xl:pl-72" : "lg:pl-72"}>
        <header className={`sticky top-0 z-30 border-b px-4 backdrop-blur-xl lg:px-8 ${terminal ? "border-[#1F2537] bg-[#0A0D16]/80 shadow-lg shadow-black/10" : "border-slate-200/80 bg-white/80 shadow-sm shadow-slate-200/30"}`}>
          <div className="flex min-h-[4.5rem] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
                <Menu size={19} />
              </button>
              <div className="min-w-0">
                <h1 className={`truncate font-display text-lg font-bold tracking-tight md:text-xl ${terminal ? "text-white" : "text-slate-950"}`}>{title}</h1>
                <p className={`hidden truncate text-sm sm:block ${terminal ? "text-[#747B99]" : "text-slate-500"}`}>{subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => tabs.some((tab) => tab.id === "internalUpdates") && selectTab("internalUpdates")} className={`relative grid h-10 w-10 place-items-center rounded-xl border shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#7C6CF0] ${terminal ? "border-[#252B40] bg-[#121625] text-[#8B92AE] hover:border-[#7C6CF0]/60 hover:text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:shadow-md"}`} title="Notifications">
                <Bell size={18} />
                {unreadUpdates > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">{unreadUpdates}</span>}
              </button>
              <div className={`hidden items-center gap-3 rounded-xl border px-3 py-2 shadow-sm sm:flex ${terminal ? "border-[#252B40] bg-[#121625]" : "border-slate-200 bg-white"}`}>
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-sm shadow-indigo-200">{initials}</div>
                <div className="text-right">
                  <p className={`max-w-36 truncate text-sm font-semibold ${terminal ? "text-[#E6E9F5]" : "text-slate-800"}`}>{user?.name || user?.email}</p>
                  <p className={`text-xs font-medium ${terminal ? "text-[#68708D]" : "text-slate-500"}`}>{String(user?.role || "").replaceAll("_", " ")}</p>
                </div>
              </div>
              <button onClick={logout} className={`grid h-10 w-10 place-items-center rounded-xl border shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-rose-400 ${terminal ? "border-[#252B40] bg-[#121625] text-[#8B92AE] hover:border-[#FB7189]/60 hover:text-[#FB7189]" : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"}`} title="Logout">
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

function SidebarContent({ tabs, activeTab, onTab, terminal }) {
  const navigate = useNavigate();
  const location = useLocation();
  const profileSelected = location.pathname === "/profile";
  return (
    <div className="flex h-full flex-col">
      <div className={`border-b border-white/10 py-6 ${terminal ? "px-3 xl:px-6" : "px-6"}`}>
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-indigo-950/40 ring-1 ring-white/15">
            <ShieldCheck size={22} />
          </div>
          <div className={terminal ? "lg:hidden xl:block" : ""}>
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
              className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#7C6CF0] ${selected ? (terminal ? "bg-gradient-to-r from-[#6355D9] to-[#7C6CF0] text-white shadow-lg shadow-[#7C6CF0]/15 ring-1 ring-white/10" : "bg-gradient-to-r from-blue-600/95 to-indigo-600/90 text-white shadow-lg shadow-blue-950/30 ring-1 ring-white/10") : "text-slate-300 hover:translate-x-0.5 hover:bg-slate-800/80 hover:text-white"}`}
            >
              {selected && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]" />}
              <Icon className={selected ? "text-white" : "text-slate-400 transition group-hover:text-white"} size={18} />
              <span className={terminal ? "lg:hidden xl:inline" : ""}>{tab.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        {terminal && <div className="mb-3 rounded-xl border border-[#20263A] bg-[#10131F] p-3 lg:hidden xl:block"><p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#5C6280]">System status</p><div className="flex items-center gap-2 text-xs font-medium text-[#A7AEC7]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#3EE0A8] motion-reduce:animate-none" />All systems live</div></div>}
        <button
          onClick={() => navigate("/profile")}
          className={`mb-3 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${profileSelected ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950/30" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
        >
          <UserRound size={18} />
          <span className={terminal ? "lg:hidden xl:inline" : ""}>Profile</span>
        </button>
      </div>
    </div>
  );
}
