"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, X, AlertTriangle } from "lucide-react";
import api from "@/lib/api";

interface Product {
  id: number;
  name: string;
  brand?: string;
  unit: string;
  moq: number;
  stock: number;
  active: boolean;
}

interface StockMovement {
  id: number;
  type: "IN" | "OUT" | "ADJUSTMENT";
  qty: number;
  reason: string;
  createdAt: string;
  createdBy: string;
}

type TabType = "all" | "low";

export default function AdminInventoryPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabType>("all");
  const [search, setSearch] = useState("");
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustType, setAdjustType] = useState<"IN" | "OUT" | "ADJUSTMENT">("IN");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [historyProductId, setHistoryProductId] = useState<number | null>(null);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["admin-inventory", search, tab],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "200", all: "1" });
      if (search) p.set("q", search);
      if (tab === "low") p.set("lowStock", "1");
      return api.get(`/products?${p.toString()}`).then((r) =>
        Array.isArray(r.data) ? r.data : r.data.products || []
      );
    },
  });

  const { data: movements = [] } = useQuery<StockMovement[]>({
    queryKey: ["stock-movements", historyProductId],
    queryFn: () =>
      api.get(`/inventory/movements?productId=${historyProductId}`).then((r) => r.data),
    enabled: !!historyProductId,
  });

  const adjustStock = useMutation({
    mutationFn: (data: {
      productId: number;
      type: string;
      qty: number;
      reason: string;
    }) => api.post("/inventory/adjust", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-inventory"] });
      setAdjustProduct(null);
      setAdjustQty("");
      setAdjustReason("");
    },
  });

  const lowStockCount = products.filter(
    (p) => p.stock <= p.moq * 2 && p.stock > 0
  ).length;
  const outOfStockCount = products.filter((p) => p.stock === 0).length;

  function openAdjust(product: Product) {
    setAdjustProduct(product);
    setAdjustType("IN");
    setAdjustQty("");
    setAdjustReason("");
    setHistoryProductId(null);
  }

  function handleAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustProduct || !adjustQty || !adjustReason) return;
    adjustStock.mutate({
      productId: adjustProduct.id,
      type: adjustType,
      qty: Number(adjustQty),
      reason: adjustReason,
    });
  }

  const displayProducts =
    tab === "low"
      ? products.filter((p) => p.stock <= p.moq * 2)
      : products;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-grotesk font-bold text-2xl text-ink">Inventory</h1>
        <div className="flex gap-3 text-sm">
          {lowStockCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg font-medium">
              <AlertTriangle size={14} />
              {lowStockCount} Low Stock
            </span>
          )}
          {outOfStockCount > 0 && (
            <span className="flex items-center gap-1.5 text-red-500 bg-red-50 px-3 py-1.5 rounded-lg font-medium">
              <AlertTriangle size={14} />
              {outOfStockCount} Out of Stock
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Tabs */}
        <div className="flex gap-1 bg-off-white rounded-xl p-1">
          {(["all", "low"] as TabType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t
                  ? "bg-white shadow-sm text-ink"
                  : "text-gray-400 hover:text-ink"
              }`}
            >
              {t === "all" ? "All Products" : "Low Stock"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue"
          />
        </div>
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className="flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 bg-blue-pale rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-off-white">
                <tr>
                  {["Product", "Stock", "MOQ", "Status", "Actions"].map((h) => (
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
                {displayProducts.map((p) => {
                  const isLow = p.stock > 0 && p.stock <= p.moq * 2;
                  const isOut = p.stock === 0;
                  return (
                    <tr key={p.id} className="hover:bg-off-white transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-ink">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.brand}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-grotesk font-bold text-base ${
                            isOut
                              ? "text-red-500"
                              : isLow
                              ? "text-amber-600"
                              : "text-green"
                          }`}
                        >
                          {p.stock}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">{p.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm">
                        {p.moq} {p.unit}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                            isOut
                              ? "bg-red-50 text-red-500"
                              : isLow
                              ? "bg-amber-50 text-amber-600"
                              : "bg-green-light text-green"
                          }`}
                        >
                          {isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button
                            onClick={() => openAdjust(p)}
                            className="text-xs text-blue border border-blue rounded-lg px-2 py-1 hover:bg-blue-pale transition-colors"
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() =>
                              setHistoryProductId(
                                historyProductId === p.id ? null : p.id
                              )
                            }
                            className="text-xs text-gray-400 border border-gray-200 rounded-lg px-2 py-1 hover:bg-off-white transition-colors"
                          >
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Movement history panel */}
        {historyProductId && (
          <div className="w-72 flex-shrink-0 bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <p className="font-grotesk font-semibold text-sm text-ink">
                Stock Movements
              </p>
              <button
                onClick={() => setHistoryProductId(null)}
                className="p-1 rounded-lg hover:bg-gray-200"
              >
                <X size={14} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[500px] p-3 space-y-2">
              {movements.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">
                  No movements recorded.
                </p>
              ) : (
                movements.map((m) => (
                  <div
                    key={m.id}
                    className="bg-off-white rounded-xl p-3 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`font-medium px-2 py-0.5 rounded-full text-xs ${
                          m.type === "IN"
                            ? "bg-green-light text-green"
                            : m.type === "OUT"
                            ? "bg-red-50 text-red-500"
                            : "bg-blue-light text-blue"
                        }`}
                      >
                        {m.type}
                      </span>
                      <span className="font-grotesk font-bold text-ink">
                        {m.type === "OUT" ? "-" : "+"}
                        {m.qty}
                      </span>
                    </div>
                    <p className="text-gray-600">{m.reason}</p>
                    <p className="text-gray-400 mt-1">
                      {m.createdBy} ·{" "}
                      {new Date(m.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Adjust stock modal */}
      {adjustProduct && (
        <>
          <div
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50"
            onClick={() => setAdjustProduct(null)}
          />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl z-50 p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-grotesk font-semibold text-base text-ink">
                Adjust Stock
              </h2>
              <button onClick={() => setAdjustProduct(null)}>
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium text-ink">{adjustProduct.name}</span>
              {" "}· Current stock:{" "}
              <span className="font-grotesk font-bold">{adjustProduct.stock}</span>
            </p>
            <form onSubmit={handleAdjust} className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {(["IN", "OUT", "ADJUSTMENT"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAdjustType(t)}
                    className={`py-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
                      adjustType === t
                        ? t === "IN"
                          ? "border-green bg-green-light text-green"
                          : t === "OUT"
                          ? "border-red-500 bg-red-50 text-red-500"
                          : "border-blue bg-blue-light text-blue"
                        : "border-gray-200 text-gray-600"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  Quantity *
                </label>
                <input
                  type="number"
                  min={1}
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  Reason *
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  required
                  placeholder="e.g. Received from supplier"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
                />
              </div>
              <button
                type="submit"
                disabled={adjustStock.isPending}
                className="w-full bg-blue hover:bg-blue-dark disabled:bg-gray-200 text-white font-medium py-3 rounded-xl transition-colors text-sm"
              >
                {adjustStock.isPending ? "Saving…" : "Adjust Stock"}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
