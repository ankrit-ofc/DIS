"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Package, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import OrderDetailModal from "@/components/OrderDetailModal";

interface Order {
  id: string;
  orderNumber: string;
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
  total: number;
  itemCount: number;
  createdAt: string;
  deliveryDistrict: string;
  paymentMethod: string;
}

const STATUS_STYLES: Record<Order["status"], string> = {
  PENDING: "bg-amber-50 text-amber-600",
  CONFIRMED: "bg-blue-light text-blue",
  PROCESSING: "bg-purple-50 text-purple-600",
  DISPATCHED: "bg-indigo-50 text-indigo-600",
  DELIVERED: "bg-green-light text-green",
  CANCELLED: "bg-red-50 text-red-500",
};

const STATUS_LABELS: Record<Order["status"], string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default function OrdersPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: orders = [], isLoading, refetch, isFetching } = useQuery<Order[]>({
    queryKey: ["my-orders"],
    queryFn: () =>
      api.get("/orders").then((r) => {
        const list = r.data?.orders ?? [];
        return list.map((o: Order & { items?: { length: number }[] }) => ({
          ...o,
          itemCount:
            typeof o.itemCount === "number"
              ? o.itemCount
              : Array.isArray(o.items)
                ? o.items.length
                : 0,
        }));
      }),
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-grotesk font-bold text-2xl text-ink">My Orders</h1>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-sm text-blue border border-blue rounded-lg px-3 py-1.5 hover:bg-blue-pale transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 h-20 animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <Package size={56} strokeWidth={1.2} className="mx-auto mb-4" />
          <p className="font-medium">No orders yet</p>
          <p className="text-sm mt-1">Browse the catalogue to place your first order.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => setSelectedId(order.id)}
              className="w-full bg-white border border-gray-200 hover:border-blue hover:shadow-md rounded-2xl p-4 flex items-center gap-4 text-left transition-all duration-200"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-grotesk font-semibold text-sm text-ink">
                    #{order.orderNumber}
                  </span>
                  <span
                    className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_STYLES[order.status]}`}
                  >
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
                <p className="text-xs text-gray-400 truncate">
                  {order.itemCount} item{order.itemCount !== 1 ? "s" : ""} ·{" "}
                  {order.deliveryDistrict} · {order.paymentMethod}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(order.createdAt).toLocaleDateString("en-NP", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="font-grotesk font-bold text-blue text-sm">
                  {formatPrice(order.total)}
                </span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <OrderDetailModal
          orderId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
