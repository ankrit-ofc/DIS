"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import api from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { card, thBase, thNum, tdBase, tdNum, tdMuted, rowHover, StatusDot, PageHeader } from "@/components/admin/ui";

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
      href: "/admin/orders",
    },
    {
      label: "Today's Revenue",
      value: stats?.todayRevenue !== undefined ? formatPrice(stats.todayRevenue) : "—",
      href: "/admin/reports",
    },
    {
      label: "Pending Orders",
      value: stats?.pendingOrders ?? "—",
      href: "/admin/orders",
    },
    {
      label: "Low Stock Items",
      value: stats?.lowStockItems ?? "—",
      href: "/admin/inventory",
    },
  ];

  const quickActions = [
    { label: "Add Product", href: "/admin/products?action=add" },
    { label: "Adjust Stock", href: "/admin/inventory" },
    { label: "View Ledger", href: "/admin/ledger" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        subtitle={new Date().toLocaleDateString("en-NP", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      />

      {/* KPI cards — number + label only */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((c) => (
          <Link key={c.label} href={c.href} className={`${card} p-4 hover:bg-gray-50 transition-colors`}>
            <p className="font-grotesk font-bold text-2xl text-ink tabular-nums">
              {c.value}
            </p>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mt-1">
              {c.label}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_280px] gap-5">
        {/* Recent orders */}
        <div className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h2 className="font-grotesk font-semibold text-sm text-ink">Recent Orders</h2>
            <Link href="/admin/orders" className="text-xs text-blue hover:underline">
              View all
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-center py-10 text-gray-400 text-sm">No orders yet today.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className={thBase}>Order</th>
                    <th className={thBase}>Buyer</th>
                    <th className={thBase}>Status</th>
                    <th className={thNum}>Total</th>
                    <th className={thNum}>Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentOrders.map((o) => (
                    <tr
                      key={o.id}
                      className={`${rowHover} cursor-pointer`}
                      onClick={() => window.location.assign(`/admin/orders?id=${o.id}`)}
                    >
                      <td className={`${tdBase} font-grotesk font-medium`}>#{o.orderNumber}</td>
                      <td className={`${tdMuted} truncate max-w-[140px]`}>{o.storeName}</td>
                      <td className={tdBase}>
                        <StatusDot status={o.status} />
                      </td>
                      <td className={tdNum}>{formatPrice(o.total)}</td>
                      <td className={`${tdNum} text-gray-400 text-xs whitespace-nowrap`}>
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
        <div className={`${card} p-4`}>
          <h2 className="font-grotesk font-semibold text-sm text-ink mb-3">Quick Actions</h2>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center px-3 py-2 rounded-[6px] border border-gray-200 hover:bg-gray-50 transition-colors text-sm text-ink"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
