"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import api from "@/lib/api";
import { formatPrice } from "@/lib/utils";

const RevenueChart = dynamic(() => import("@/components/admin/RevenueChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[224px] bg-blue-pale rounded-xl animate-pulse" />
  ),
});

interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

interface TopProduct {
  id: number;
  name: string;
  brand?: string;
  revenue: number;
  unitsSold: number;
}

interface TopBuyer {
  id: number;
  storeName: string;
  phone: string;
  totalOrders: number;
  totalValue: number;
}

interface ReportData {
  revenue: RevenuePoint[];
  topProducts: TopProduct[];
  topBuyers: TopBuyer[];
  totalRevenue: number;
  totalOrders: number;
}

export default function AdminReportsPage() {
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5)
    .toISOString()
    .split("T")[0];

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);

  const { data, isLoading } = useQuery<ReportData>({
    queryKey: ["admin-reports", dateFrom, dateTo],
    queryFn: () =>
      api
        .get(`/reports?from=${dateFrom}&to=${dateTo}`)
        .then((r) => r.data),
  });

  const chartData =
    data?.revenue.map((d) => ({
      ...d,
      label: new Date(d.date).toLocaleDateString("en-NP", {
        day: "numeric",
        month: "short",
      }),
    })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-grotesk font-bold text-2xl text-ink">Reports</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue"
          />
          <span className="text-gray-400 text-sm">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs text-gray-400 mb-1">Total Revenue</p>
          <p className="font-grotesk font-bold text-2xl text-blue">
            {data ? formatPrice(data.totalRevenue) : "—"}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-xs text-gray-400 mb-1">Total Orders</p>
          <p className="font-grotesk font-bold text-2xl text-ink">
            {data ? data.totalOrders : "—"}
          </p>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="font-grotesk font-semibold text-base text-ink mb-5">
          Revenue by Day
        </h2>
        {isLoading ? (
          <div className="h-56 bg-blue-pale rounded-xl animate-pulse" />
        ) : chartData.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
            No data for selected period.
          </div>
        ) : (
          <RevenueChart data={chartData} />
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top products */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-grotesk font-semibold text-base text-ink">
              Top 5 Products by Revenue
            </h2>
          </div>
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-blue-pale rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {(data?.topProducts || []).map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <span className="font-grotesk font-bold text-lg text-gray-200 w-6 text-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.unitsSold} units sold
                    </p>
                  </div>
                  <p className="font-grotesk font-semibold text-blue text-sm">
                    {formatPrice(p.revenue)}
                  </p>
                </li>
              ))}
              {(!data?.topProducts || data.topProducts.length === 0) && (
                <li className="px-5 py-8 text-center text-gray-400 text-sm">
                  No data available.
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Top buyers */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-grotesk font-semibold text-base text-ink">
              Top 5 Buyers by Order Value
            </h2>
          </div>
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-blue-pale rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {(data?.topBuyers || []).map((b, i) => (
                <li
                  key={b.id}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <span className="font-grotesk font-bold text-lg text-gray-200 w-6 text-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {b.storeName}
                    </p>
                    <p className="text-xs text-gray-400">{b.totalOrders} orders</p>
                  </div>
                  <p className="font-grotesk font-semibold text-blue text-sm">
                    {formatPrice(b.totalValue)}
                  </p>
                </li>
              ))}
              {(!data?.topBuyers || data.topBuyers.length === 0) && (
                <li className="px-5 py-8 text-center text-gray-400 text-sm">
                  No data available.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
