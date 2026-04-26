"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ShoppingCart,
  TrendingUp,
  Clock,
  AlertTriangle,
  Plus,
  Layers,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import api from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface DashboardStats {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  lowStockItems: number;
}

interface RecentOrder {
  id: number;
  orderNumber: string;
  status: string;
  storeName: string;
  total: number;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600",
  CONFIRMED: "bg-blue-light text-blue",
  PROCESSING: "bg-purple-50 text-purple-600",
  DISPATCHED: "bg-indigo-50 text-indigo-600",
  DELIVERED: "bg-green-light text-green",
  CANCELLED: "bg-red-50 text-red-500",
};

export default function AdminDashboard() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["admin-stats"],
    queryFn: () => api.get("/admin/stats").then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: recentOrders = [] } = useQuery<RecentOrder[]>({
    queryKey: ["admin-recent-orders"],
    queryFn: () =>
      api.get("/orders?limit=10&sort=newest").then((r) =>
        Array.isArray(r.data) ? r.data : r.data.orders || []
      ),
    refetchInterval: 30000,
  });

  const statCards = [
    {
      label: "Today's Orders",
      value: stats?.todayOrders ?? "—",
      icon: ShoppingCart,
      color: "bg-blue-light text-blue",
      href: "/admin/orders",
    },
    {
      label: "Today's Revenue",
      value: stats?.todayRevenue !== undefined ? formatPrice(stats.todayRevenue) : "—",
      icon: TrendingUp,
      color: "bg-green-light text-green",
      href: "/admin/reports",
    },
    {
      label: "Pending Orders",
      value: stats?.pendingOrders ?? "—",
      icon: Clock,
      color: "bg-amber-50 text-amber-600",
      href: "/admin/orders",
    },
    {
      label: "Low Stock Items",
      value: stats?.lowStockItems ?? "—",
      icon: AlertTriangle,
      color: "bg-red-50 text-red-500",
      href: "/admin/inventory",
    },
  ];

  const quickActions = [
    { label: "Add Product", icon: Plus, href: "/admin/products?action=add" },
    { label: "Adjust Stock", icon: Layers, href: "/admin/inventory" },
    { label: "View Ledger", icon: BookOpen, href: "/admin/ledger" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-grotesk font-bold text-2xl text-ink">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          {new Date().toLocaleDateString("en-NP", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="bg-white border border-gray-100 rounded-[24px] p-6 shadow-sm shadow-gray-200/50 hover:shadow-lg hover:shadow-gray-200/50 hover:-translate-y-1 transition-all duration-300 group"
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 group-hover:rotate-3 ${card.color}`}
              >
                <Icon size={22} />
              </div>
              <p className="font-grotesk font-extrabold text-3xl text-ink tracking-tight">
                {card.value}
              </p>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1.5">{card.label}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8">
        {/* Recent orders */}
        <div className="bg-white border border-gray-100 rounded-[32px] shadow-sm shadow-gray-200/50 overflow-hidden">
          <div className="flex items-center justify-between px-8 py-6 border-b border-gray-50">
            <h2 className="font-grotesk font-bold text-lg text-ink">
              Recent Orders
            </h2>
            <Link
              href="/admin/orders"
              className="text-xs text-blue hover:underline flex items-center gap-1"
            >
              View all <ChevronRight size={12} />
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-center py-12 text-gray-400 text-sm">
              No orders yet today.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50">
                  <tr>
                    {["Order", "Buyer", "Status", "Total", "Time"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentOrders.map((o) => (
                    <tr
                      key={o.id}
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() =>
                        window.location.assign(`/admin/orders?id=${o.id}`)
                      }
                    >
                      <td className="px-6 py-5 font-grotesk font-bold text-ink">
                        #{o.orderNumber}
                      </td>
                      <td className="px-6 py-5 text-gray-600 font-medium truncate max-w-[140px]">
                        {o.storeName}
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`text-xs font-medium px-3 py-1 rounded-full ${
                            STATUS_STYLES[o.status] || "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-6 py-5 font-grotesk font-semibold text-blue">
                        {formatPrice(o.total)}
                      </td>
                      <td className="px-6 py-5 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(o.createdAt).toLocaleTimeString("en-NP", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="bg-white border border-gray-100 rounded-[32px] shadow-sm shadow-gray-200/50 p-8">
          <h2 className="font-grotesk font-bold text-lg text-ink mb-6">
            Quick Actions
          </h2>
          <div className="space-y-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-blue/20 hover:bg-blue-50/50 transition-all group"
                >
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <Icon size={18} className="text-gray-600 group-hover:text-blue" />
                  </div>
                  <span className="text-sm font-semibold text-ink">
                    {action.label}
                  </span>
                  <ChevronRight size={16} className="ml-auto text-gray-300 group-hover:text-blue" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
