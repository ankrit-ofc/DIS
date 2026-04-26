"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tag,
  Tags,
  Users,
  BookOpen,
  Warehouse,
  CreditCard,
  Megaphone,
  BarChart2,
  Settings,
  LogOut,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Image,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { getSessionInitial } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/pricing", label: "Pricing", icon: Tag },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/ledger", label: "Ledger", icon: BookOpen },
  { href: "/admin/inventory", label: "Inventory", icon: Warehouse },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/banners",       label: "Banners",       icon: Image },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/chat",          label: "Chat",          icon: MessageSquare },
  { href: "/admin/reports",       label: "Reports",       icon: BarChart2 },
  { href: "/admin/settings",      label: "Settings",      icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { clearAuth, user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  // Prefetch all admin routes on mount for instant navigation
  useEffect(() => {
    NAV.forEach((item) => {
      router.prefetch(item.href);
    });
  }, [router]);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  function handleLogout() {
    clearAuth();
    // Hard reload wipes TanStack Query cache and any in-memory state from the previous user
    window.location.href = "/login";
  }

  return (
    <aside
      className={`relative flex flex-col h-full bg-ink transition-all duration-300 ease-in-out shadow-2xl shadow-ink/20 ${
        collapsed ? "w-18" : "w-[240px]"
      }`}
    >
      {/* Logo */}
      <div
        className={`flex items-center h-16 border-b border-white/5 px-5 ${
          collapsed ? "justify-center" : ""
        }`}
      >
        {!collapsed && (
          <span className="font-grotesk font-bold text-xl text-blue tracking-tight">
            DISTRO
          </span>
        )}
        {collapsed && (
          <span className="font-grotesk font-bold text-xl text-blue">D</span>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-[72px] w-6 h-6 bg-ink border border-white/20 rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors z-10"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <div
              key={item.href}
              onClick={() => router.push(item.href)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl mb-1.5 transition-all duration-200 group cursor-pointer ${
                active
                  ? "bg-gradient-to-r from-blue to-blue-dark text-white shadow-lg shadow-blue/20"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon
                size={19}
                className={`flex-shrink-0 transition-transform group-hover:scale-110 ${active ? "text-white" : "opacity-80"}`}
              />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
              )}
            </div>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="border-t border-white/10 p-3">
        {!collapsed && (
          <div className="px-2 py-2 mb-1 flex items-center gap-2 min-w-0">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue text-white text-sm font-grotesk font-bold"
              title={user?.ownerName || user?.storeName || user?.phone || "Admin"}
              aria-hidden
            >
              {getSessionInitial(user ?? undefined)}
            </span>
            <div className="min-w-0">
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">
                Admin
              </p>
              <p className="text-xs text-white/70 truncate mt-0.5">
                {user?.ownerName || user?.name || user?.storeName || user?.phone}
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center mb-2" title={user?.ownerName || user?.storeName || user?.phone || "Admin"}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue text-white text-sm font-grotesk font-bold">
              {getSessionInitial(user ?? undefined)}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors w-full"
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
