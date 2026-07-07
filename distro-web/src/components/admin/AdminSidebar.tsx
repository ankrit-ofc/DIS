"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tag,
  Tags,
  Users,
  BriefcaseBusiness,
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
  { href: "/admin/sales", label: "Sales Team", icon: BriefcaseBusiness },
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
      className={`relative flex flex-col h-full bg-white border-r border-gray-200 ${
        collapsed ? "w-18" : "w-[220px]"
      }`}
    >
      {/* Logo */}
      <div
        className={`flex items-center h-14 border-b border-gray-200 px-5 ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <span className="font-grotesk font-bold text-lg text-ink tracking-tight">
          {collapsed ? "D" : "DISTRO"}
        </span>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="absolute -right-3 top-[64px] w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-ink z-10"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {NAV.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <div
              key={item.href}
              onClick={() => router.push(item.href)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-[6px] mb-0.5 cursor-pointer transition-colors ${
                active
                  ? "bg-blue-light text-blue"
                  : "text-gray-600 hover:bg-gray-50 hover:text-ink"
              }`}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm truncate">{item.label}</span>
              )}
            </div>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="border-t border-gray-200 p-3">
        {!collapsed && (
          <div className="px-1 py-2 mb-1 flex items-center gap-2 min-w-0">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-light text-blue text-sm font-grotesk font-bold"
              title={user?.ownerName || user?.storeName || user?.phone || "Admin"}
              aria-hidden
            >
              {getSessionInitial(user ?? undefined)}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
                Admin
              </p>
              <p className="text-xs text-gray-600 truncate mt-0.5">
                {user?.ownerName || user?.name || user?.storeName || user?.phone}
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center mb-2" title={user?.ownerName || user?.storeName || user?.phone || "Admin"}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-light text-blue text-sm font-grotesk font-bold">
              {getSessionInitial(user ?? undefined)}
            </span>
          </div>
        )}
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className="flex items-center gap-3 px-3 py-2 rounded-[6px] text-gray-600 hover:text-ink hover:bg-gray-50 transition-colors w-full"
        >
          <LogOut size={16} className="flex-shrink-0" />
          {!collapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
