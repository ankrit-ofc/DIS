"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X, ChevronDown, ChevronRight, History } from "lucide-react";
import api from "@/lib/api";
import { formatPrice } from "@/lib/utils";

interface PriceHistory {
  id: number;
  price: number;
  mrp: number;
  reason: string;
  changedAt: string;
  changedBy: string;
}

interface Product {
  id: number;
  name: string;
  brand?: string;
  price: number;
  mrp: number;
  unit: string;
  history?: PriceHistory[];
}

interface EditState {
  price: string;
  mrp: string;
}

export default function AdminPricingPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<number, EditState>>({});
  const [expandedHistory, setExpandedHistory] = useState<number[]>([]);
  const [bulkReason, setBulkReason] = useState("");
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["admin-pricing"],
    queryFn: () =>
      api.get("/products?limit=200&all=1").then((r) =>
        Array.isArray(r.data) ? r.data : r.data.products || []
      ),
  });

  const updatePrice = useMutation({
    mutationFn: ({
      id,
      price,
      mrp,
      reason,
    }: {
      id: number;
      price: number;
      mrp: number;
      reason: string;
    }) => api.patch(`/products/${id}/price`, { price, mrp, reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pricing"] }),
  });

  const pendingEdits = Object.entries(editing).filter(
    ([id]) => products.find((p) => p.id === Number(id))
  );

  function startEdit(product: Product) {
    setEditing((e) => ({
      ...e,
      [product.id]: {
        price: String(product.price),
        mrp: String(product.mrp),
      },
    }));
  }

  function cancelEdit(id: number) {
    setEditing((e) => {
      const n = { ...e };
      delete n[id];
      return n;
    });
  }

  function saveSingle(product: Product) {
    const edit = editing[product.id];
    if (!edit) return;
    updatePrice.mutate({
      id: product.id,
      price: Number(edit.price),
      mrp: Number(edit.mrp),
      reason: "Price updated",
    });
    cancelEdit(product.id);
  }

  async function handleBulkUpdate() {
    if (!bulkReason.trim()) return;
    for (const [id, edit] of pendingEdits) {
      await updatePrice.mutateAsync({
        id: Number(id),
        price: Number(edit.price),
        mrp: Number(edit.mrp),
        reason: bulkReason,
      });
    }
    setEditing({});
    setBulkReason("");
    setShowBulkConfirm(false);
  }

  function toggleHistory(id: number) {
    setExpandedHistory((h) =>
      h.includes(id) ? h.filter((x) => x !== id) : [...h, id]
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-grotesk font-bold text-2xl text-ink">Pricing</h1>
        {pendingEdits.length > 0 && (
          <button
            onClick={() => setShowBulkConfirm(true)}
            className="flex items-center gap-2 bg-blue hover:bg-blue-dark text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            Bulk Update ({pendingEdits.length})
          </button>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 bg-blue-pale rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-off-white">
              <tr>
                {["Product", "Current Price", "MRP", "New Price", "New MRP", ""].map(
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
              {products.map((p) => {
                const edit = editing[p.id];
                const hasHistory = expandedHistory.includes(p.id);
                return (
                  <>
                    <tr
                      key={p.id}
                      className={`hover:bg-off-white transition-colors ${
                        edit ? "bg-blue-pale" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{p.name}</p>
                        <p className="text-xs text-gray-400">
                          {p.brand} · {p.unit}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-grotesk font-semibold text-blue">
                        {formatPrice(p.price)}
                      </td>
                      <td className="px-4 py-3 text-gray-400 line-through text-xs">
                        {formatPrice(p.mrp)}
                      </td>
                      <td className="px-4 py-3">
                        {edit ? (
                          <input
                            type="number"
                            value={edit.price}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [p.id]: { ...prev[p.id], price: e.target.value },
                              }))
                            }
                            className="w-24 border border-blue rounded-lg px-2 py-1 text-sm font-grotesk focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => startEdit(p)}
                            className="text-sm text-gray-400 hover:text-blue hover:underline"
                          >
                            Click to edit
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {edit ? (
                          <input
                            type="number"
                            value={edit.mrp}
                            onChange={(e) =>
                              setEditing((prev) => ({
                                ...prev,
                                [p.id]: { ...prev[p.id], mrp: e.target.value },
                              }))
                            }
                            className="w-24 border border-blue rounded-lg px-2 py-1 text-sm font-grotesk focus:outline-none"
                          />
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {edit ? (
                            <>
                              <button
                                onClick={() => saveSingle(p)}
                                className="p-1.5 text-green hover:bg-green-light rounded-lg transition-colors"
                                title="Save"
                              >
                                <Check size={15} />
                              </button>
                              <button
                                onClick={() => cancelEdit(p.id)}
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                title="Cancel"
                              >
                                <X size={15} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => toggleHistory(p.id)}
                              className="p-1.5 text-gray-400 hover:text-blue hover:bg-blue-pale rounded-lg transition-colors"
                              title="Price history"
                            >
                              {hasHistory ? (
                                <ChevronDown size={15} />
                              ) : (
                                <ChevronRight size={15} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {hasHistory && (
                      <tr key={`${p.id}-history`} className="bg-off-white">
                        <td colSpan={6} className="px-8 py-3">
                          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                            <History size={12} />
                            Price History
                          </div>
                          {!p.history || p.history.length === 0 ? (
                            <p className="text-xs text-gray-400">No history available.</p>
                          ) : (
                            <div className="space-y-1">
                              {p.history.map((h) => (
                                <div
                                  key={h.id}
                                  className="flex items-center gap-4 text-xs text-gray-600"
                                >
                                  <span className="text-gray-400">
                                    {new Date(h.changedAt).toLocaleDateString()}
                                  </span>
                                  <span className="font-grotesk font-medium text-ink">
                                    {formatPrice(h.price)}
                                  </span>
                                  <span className="line-through text-gray-400">
                                    MRP {formatPrice(h.mrp)}
                                  </span>
                                  <span className="text-gray-400">{h.reason}</span>
                                  <span className="text-gray-400">by {h.changedBy}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bulk confirm modal */}
      {showBulkConfirm && (
        <>
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50"
            onClick={() => setShowBulkConfirm(false)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl z-50 p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-grotesk font-semibold text-base text-ink mb-2">
              Bulk Price Update
            </h2>
            <p className="text-sm text-gray-400 mb-4">
              Updating {pendingEdits.length} product price
              {pendingEdits.length !== 1 ? "s" : ""}. This action will be logged.
            </p>
            <label className="text-xs font-medium text-gray-600 block mb-1.5">
              Reason for update *
            </label>
            <input
              type="text"
              value={bulkReason}
              onChange={(e) => setBulkReason(e.target.value)}
              placeholder="e.g. Monthly price revision"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={handleBulkUpdate}
                disabled={!bulkReason.trim() || updatePrice.isPending}
                className="flex-1 bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
              >
                {updatePrice.isPending ? "Updating…" : "Confirm Update"}
              </button>
              <button
                onClick={() => setShowBulkConfirm(false)}
                className="flex-1 border border-gray-200 text-sm text-gray-600 hover:bg-off-white py-2.5 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
