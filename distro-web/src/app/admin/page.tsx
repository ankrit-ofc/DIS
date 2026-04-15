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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-blue hover:shadow-md transition-all duration-200"
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${card.color}`}
              >
                <Icon size={20} />
              </div>
              <p className="font-grotesk font-bold text-2xl text-ink">
                {card.value}
              </p>
              <p className="text-xs text-gray-400 mt-1">{card.label}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        {/* Recent orders */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
            <h2 className="font-grotesk font-semibold text-base text-ink">
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
                <thead className="bg-off-white">
                  <tr>
                    {["Order", "Buyer", "Status", "Total", "Time"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentOrders.map((o) => (
                    <tr
                      key={o.id}
                      className="hover:bg-off-white transition-colors cursor-pointer"
                      onClick={() =>
                        window.location.assign(`/admin/orders?id=${o.id}`)
                      }
                    >
                      <td className="px-4 py-3 font-grotesk font-semibold text-ink">
                        #{o.orderNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-[140px]">
                        {o.storeName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                            STATUS_STYLES[o.status] || "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-grotesk font-semibold text-blue">
                        {formatPrice(o.total)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
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
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="font-grotesk font-semibold text-base text-ink mb-4">
            Quick Actions
          </h2>
          <div className="space-y-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-blue hover:bg-blue-pale transition-all"
                >
                  <div className="w-8 h-8 bg-blue-light rounded-lg flex items-center justify-center">
                    <Icon size={16} className="text-blue" />
                  </div>
                  <span className="text-sm font-medium text-ink">
                    {action.label}
                  </span>
                  <ChevronRight size={14} className="ml-auto text-gray-400" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
