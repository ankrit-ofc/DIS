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

const STATUS_STYLES: Record<Payment["status"], string> = {
  PENDING: "bg-amber-50 text-amber-600",
  PAID: "bg-green-light text-green",
  FAILED: "bg-red-50 text-red-500",
  REFUNDED: "bg-purple-50 text-purple-600",
};

const METHOD_COLORS: Record<Payment["method"], string> = {
  ESEWA: "bg-green-light text-green",
  KHALTI: "bg-purple-50 text-purple-600",
  COD: "bg-blue-light text-blue",
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
      <h1 className="font-grotesk font-bold text-2xl text-ink">Payments</h1>

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
            className="bg-white border border-gray-200 rounded-2xl p-4"
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                method === m
                  ? "bg-blue text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-blue"
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                status === s
                  ? "bg-ink text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-blue-pale rounded-xl animate-pulse" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <p className="text-center py-16 text-gray-400 text-sm">
            No payments found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-off-white">
                <tr>
                  {["Order", "Store", "Method", "Status", "Amount", "Transaction ID", "Date"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-off-white transition-colors">
                    <td className="px-4 py-3 font-grotesk font-semibold text-ink">
                      #{p.orderNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[120px] truncate">
                      {p.storeName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${METHOD_COLORS[p.method]}`}
                      >
                        {p.method}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${STATUS_STYLES[p.status]}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-grotesk font-semibold text-ink">
                      {formatPrice(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                      {p.transactionId || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
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
