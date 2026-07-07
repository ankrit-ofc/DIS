"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ReceiptText } from "lucide-react";
import api from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import SalesShell from "@/components/sales/SalesShell";

interface RepOrder {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: string;
  buyer: { storeName: string | null; phone: string };
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-blue-light text-blue",
  PROCESSING: "bg-blue-light text-blue",
  DISPATCHED: "bg-blue-light text-blue",
  DELIVERED: "bg-green/10 text-green",
  CANCELLED: "bg-red-50 text-red-500",
};

export default function SalesTodayPage() {
  const router = useRouter();

  const { data: orders = [], isLoading } = useQuery<RepOrder[]>({
    queryKey: ["sales-today-orders"],
    queryFn: () => api.get("/sales/orders").then((r) => r.data.orders ?? []),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const activeTotal = orders
    .filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <SalesShell>
      <button
        onClick={() => router.push("/sales")}
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue mb-4 transition-colors"
      >
        <ChevronLeft size={14} /> Back
      </button>

      <div className="flex items-baseline justify-between mb-3">
        <h1 className="font-grotesk font-semibold text-base text-ink">
          Today&apos;s orders <span className="text-gray-400 font-normal text-sm">· {todayLabel}</span>
        </h1>
        <p className="font-grotesk font-semibold text-sm text-ink">{formatPrice(activeTotal)}</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white border border-gray-200 rounded-[8px] animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-[8px] p-8 text-center text-gray-400">
          <ReceiptText size={32} strokeWidth={1.2} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No orders yet today — find a shop and get rolling.</p>
        </div>
      ) : (
        <ul className="bg-white border border-gray-200 rounded-[8px] divide-y divide-gray-100">
          {orders.map((o) => (
            <li key={o.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {o.buyer.storeName ?? o.buyer.phone}
                </p>
                <p className="text-xs text-gray-400">
                  {o.orderNumber} ·{" "}
                  {new Date(o.createdAt).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  STATUS_STYLES[o.status] ?? "bg-gray-100 text-gray-500"
                }`}
              >
                {o.status}
              </span>
              <p className="font-grotesk font-semibold text-sm text-ink w-24 text-right">
                {formatPrice(o.total)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </SalesShell>
  );
}
