"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Download } from "lucide-react";
import api from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface LedgerEntry {
  id: number;
  type: "DEBIT" | "CREDIT";
  amount: number;
  description: string;
  customer: { id: number; storeName: string };
  orderId?: number;
  createdAt: string;
}

interface Customer {
  id: number;
  storeName: string;
}

export default function AdminLedgerPage() {
  const qc = useQueryClient();

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0];

  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [customerId, setCustomerId] = useState<number | "">("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    type: "DEBIT" as "DEBIT" | "CREDIT",
    amount: "",
    description: "",
    customerId: "",
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers-list"],
    queryFn: () =>
      api.get("/users?role=BUYER&limit=200").then((r) =>
        Array.isArray(r.data) ? r.data : r.data.users || []
      ),
  });

  const { data: entries = [], isLoading } = useQuery<LedgerEntry[]>({
    queryKey: ["admin-ledger", dateFrom, dateTo, customerId],
    queryFn: () => {
      const p = new URLSearchParams({ from: dateFrom, to: dateTo });
      if (customerId) p.set("customerId", String(customerId));
      return api.get(`/ledger?${p.toString()}`).then((r) => r.data.entries ?? []);
    },
  });

  const addEntry = useMutation({
    mutationFn: (data: typeof form) =>
      api.post("/ledger", {
        ...data,
        amount: Number(data.amount),
        customerId: Number(data.customerId),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ledger"] });
      setShowModal(false);
      setForm({ type: "DEBIT", amount: "", description: "", customerId: "" });
    },
  });

  function exportTally() {
    const p = new URLSearchParams({ from: dateFrom, to: dateTo });
    if (customerId) p.set("customerId", String(customerId));
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL}/reports/tally-export?${p.toString()}`,
      "_blank"
    );
  }

  const totalDebit = entries.filter((e) => e.type === "DEBIT").reduce((s, e) => s + e.amount, 0);
  const totalCredit = entries.filter((e) => e.type === "CREDIT").reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-grotesk font-bold text-xl text-ink">Ledger</h1>
        <div className="flex gap-2">
          <button
            onClick={exportTally}
            className="flex items-center gap-2 border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-[6px] transition-colors"
          >
            <Download size={15} />
            Export Tally XML
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue hover:bg-blue-dark text-white text-sm font-medium px-4 py-2 rounded-[6px] transition-colors"
          >
            <Plus size={16} />
            Manual Entry
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-200 rounded-[6px] px-3 py-1.5 text-sm focus:outline-none focus:border-blue"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-200 rounded-[6px] px-3 py-1.5 text-sm focus:outline-none focus:border-blue"
          />
        </div>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(Number(e.target.value) || "")}
          className="border border-gray-200 rounded-[6px] px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-blue text-ink"
        >
          <option value="">All Customers</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.storeName}
            </option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Debit", value: formatPrice(totalDebit), color: "text-red-500" },
          { label: "Total Credit", value: formatPrice(totalCredit), color: "text-green" },
          {
            label: "Net",
            value: formatPrice(Math.abs(totalCredit - totalDebit)),
            color: totalCredit >= totalDebit ? "text-green" : "text-red-500",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-gray-200 rounded-[8px] p-4 text-center"
          >
            <p className={`font-grotesk font-bold text-xl ${s.color}`}>
              {s.value}
            </p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-[8px] overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-50 rounded-[6px] animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-center py-16 text-gray-400 text-sm">
            No entries for selected period.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {["Date", "Customer", "Type", "Description", "Amount"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleDateString("en-NP", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="px-3 py-2 font-medium text-ink">
                    {e.customer?.storeName}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-sm text-ink whitespace-nowrap">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: e.type === "CREDIT" ? "#00C46F" : "#DC2626" }}
                      />
                      {e.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">{e.description}</td>
                  <td className="px-3 py-2 font-grotesk font-semibold text-ink">
                    {formatPrice(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Manual entry modal */}
      {showModal && (
        <>
          <div
            className="fixed inset-0 bg-ink/40 z-50"
            onClick={() => setShowModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-[8px] z-50 p-6 w-full max-w-sm border border-gray-200">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-grotesk font-semibold text-base text-ink">
                Manual Entry
              </h2>
              <button onClick={() => setShowModal(false)}>
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  Customer *
                </label>
                <select
                  value={form.customerId}
                  onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                  required
                  className="w-full border border-gray-200 rounded-[6px] px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-blue"
                >
                  <option value="">Select customer…</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.storeName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setForm((f) => ({ ...f, type: "DEBIT" }))}
                  className={`py-2 rounded-[6px] text-sm font-medium border-2 transition-colors ${
                    form.type === "DEBIT"
                      ? "border-red-500 bg-red-50 text-red-500"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  Debit
                </button>
                <button
                  onClick={() => setForm((f) => ({ ...f, type: "CREDIT" }))}
                  className={`py-2 rounded-[6px] text-sm font-medium border-2 transition-colors ${
                    form.type === "CREDIT"
                      ? "border-green bg-green-light text-green"
                      : "border-gray-200 text-gray-600"
                  }`}
                >
                  Credit
                </button>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  Amount (Rs) *
                </label>
                <input
                  type="number"
                  min={1}
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-[6px] px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  Description *
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="e.g. Cash payment received"
                  className="w-full border border-gray-200 rounded-[6px] px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
                />
              </div>
              <button
                onClick={() => addEntry.mutate(form)}
                disabled={
                  addEntry.isPending ||
                  !form.amount ||
                  !form.description ||
                  !form.customerId
                }
                className="w-full bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white font-medium py-3 rounded-[6px] transition-colors text-sm"
              >
                {addEntry.isPending ? "Saving…" : "Add Entry"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
