"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface Payment {
  id: number;
  orderId: number;
  orderNumber: string;
  storeName: string;
  method: "ESEWA" | "KHALTI" | "COD";
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  amount: number;
  transactionId?: string;
  createdAt: string;
}

const METHOD_TABS = ["ALL", "ESEWA", "KHALTI", "COD"] as const;
const STATUS_TABS = ["ALL", "PENDING", "PAID", "FAILED", "REFUNDED"] as const;

const STATUS_DOTS: Record<Payment["status"], string> = {
  PENDING: "#D97706",
  PAID: "#00C46F",
  FAILED: "#DC2626",
  REFUNDED: "#5C6480",
};

export default function AdminPaymentsPage() {
  const [method, setMethod] = useState<(typeof METHOD_TABS)[number]>("ALL");
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>("ALL");

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ["admin-payments", method, status],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "100" });
      if (method !== "ALL") p.set("method", method);
      if (status !== "ALL") p.set("status", status);
      return api.get(`/payments?${p.toString()}`).then((r) =>
        Array.isArray(r.data) ? r.data : r.data.payments || []
      );
    },
  });

  const totalPaid = payments
    .filter((p) => p.status === "PAID")
    .reduce((s, p) => s + p.amount, 0);

  const totalPending = payments
    .filter((p) => p.status === "PENDING")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <h1 className="font-grotesk font-bold text-xl text-ink">Payments</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Transactions", value: String(payments.length), color: "text-ink" },
          { label: "Paid", value: formatPrice(totalPaid), color: "text-green" },
          { label: "Pending Collection", value: formatPrice(totalPending), color: "text-amber-600" },
          {
            label: "eSewa / Khalti",
            value: String(payments.filter((p) => p.method !== "COD").length),
            color: "text-blue",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-gray-200 rounded-[8px] p-4"
          >
            <p className={`font-grotesk font-bold text-xl ${s.color}`}>
              {s.value}
            </p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex gap-1">
          {METHOD_TABS.map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors border ${
                method === m
                  ? "bg-blue-light text-blue border-blue-light"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors border ${
                status === s
                  ? "bg-blue-light text-blue border-blue-light"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-[8px] overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-50 rounded-[6px] animate-pulse" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <p className="text-center py-16 text-gray-400 text-sm">
            No payments found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Order", "Store", "Method", "Status", "Amount", "Transaction ID", "Date"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 font-grotesk font-semibold text-ink">
                      #{p.orderNumber}
                    </td>
                    <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">
                      {p.storeName}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600">{p.method}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-sm text-ink whitespace-nowrap">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: STATUS_DOTS[p.status] ?? "#9BA3BF" }}
                        />
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-grotesk font-semibold text-ink">
                      {formatPrice(p.amount)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400 font-mono">
                      {p.transactionId || "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString("en-NP", {
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
