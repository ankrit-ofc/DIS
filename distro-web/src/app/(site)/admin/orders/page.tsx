"use client";

import { Fragment, useMemo, useState, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, X, MapPin, RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatPrice } from "@/lib/utils";

const MapView = dynamic(() => import("@/components/admin/OrderMapView"), {
  ssr: false,
  loading: () => (
    <div className="h-48 bg-blue-pale rounded-xl animate-pulse flex items-center justify-center">
      <MapPin size={24} className="text-blue animate-pulse" />
    </div>
  ),
});

interface Order {
  id: number;
  orderNumber: string;
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
  storeName: string;
  buyerPhone?: string;
  buyer?: { id?: string; storeName?: string | null; phone?: string };
  deliveryAddress: string;
  deliveryDistrict: string;
  deliveryLat?: number;
  deliveryLng?: number;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  items: { id: number; productName: string; qty: number; price: number; unit: string }[];
  invoicePdfPath?: string | null;
  invoiceEmailSent?: boolean;
}

const STATUSES = ["ALL", "PENDING", "CONFIRMED", "PROCESSING", "DISPATCHED", "DELIVERED", "CANCELLED"];
const BULK_STATUSES = ["CONFIRMED", "PROCESSING", "DISPATCHED", "DELIVERED", "CANCELLED"];
const DATE_RANGES = [
  { key: "TODAY", label: "Today" },
  { key: "YESTERDAY", label: "Yesterday" },
  { key: "7D", label: "Last 7 days" },
  { key: "30D", label: "Last 30 days" },
  { key: "ALL", label: "All time" },
];

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600",
  CONFIRMED: "bg-blue-light text-blue",
  PROCESSING: "bg-purple-50 text-purple-600",
  DISPATCHED: "bg-indigo-50 text-indigo-600",
  DELIVERED: "bg-green-light text-green",
  CANCELLED: "bg-red-50 text-red-500",
};

function dayKey(d: string | Date): string {
  const date = new Date(d);
  return date.toISOString().slice(0, 10);
}

function dayLabel(key: string): string {
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return new Date(key).toLocaleDateString("en-NP", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function rangeStart(key: string): Date | null {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === "TODAY") return start;
  if (key === "YESTERDAY") return new Date(start.getTime() - 86400000);
  if (key === "7D") return new Date(start.getTime() - 7 * 86400000);
  if (key === "30D") return new Date(start.getTime() - 30 * 86400000);
  return null;
}

function getOrderPhone(o: Order): string | undefined {
  return o.buyerPhone ?? o.buyer?.phone;
}

function getOrderStoreName(o: Order): string {
  return o.storeName || o.buyer?.storeName || "—";
}

function telHref(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (/^9\d{9}$/.test(digits)) return `tel:+977${digits}`;
  return `tel:${digits}`;
}

function rangeEnd(key: string): Date | null {
  if (key === "YESTERDAY") {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return null;
}

function OrdersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState("TODAY");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(
    searchParams.get("id") ? Number(searchParams.get("id")) : null
  );

  const { data: ordersData, isLoading, isFetching, refetch } = useQuery<{ orders: Order[]; total: number }>({
    queryKey: ["admin-orders", statusFilter, search],
    queryFn: () => {
      const p = new URLSearchParams();
      if (statusFilter !== "ALL") p.set("status", statusFilter);
      if (search) p.set("q", search);
      p.set("limit", "200");
      return api.get(`/orders?${p.toString()}`).then((r) =>
        Array.isArray(r.data)
          ? { orders: r.data, total: r.data.length }
          : r.data
      );
    },
  });

  const allOrders = ordersData?.orders || [];

  const orders = useMemo(() => {
    const start = rangeStart(dateRange);
    const end = rangeEnd(dateRange);
    if (!start) return allOrders;
    return allOrders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      if (end) return t >= start.getTime() && t < end.getTime();
      return t >= start.getTime();
    });
  }, [allOrders, dateRange]);

  const grouped = useMemo(() => {
    const byDay = new Map<string, { orders: Order[]; revenue: number }>();
    for (const o of orders) {
      const k = dayKey(o.createdAt);
      const bucket = byDay.get(k) ?? { orders: [], revenue: 0 };
      bucket.orders.push(o);
      if (o.status !== "CANCELLED") bucket.revenue += o.total;
      byDay.set(k, bucket);
    }
    return Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [orders]);

  const selectedOrder = orders.find((o) => o.id === selectedId);

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["admin-orders"] });
      const snapshots = qc.getQueriesData<{ orders: Order[]; total: number }>({ queryKey: ["admin-orders"] });
      for (const [key, prev] of snapshots) {
        if (!prev?.orders) continue;
        qc.setQueryData(key, {
          ...prev,
          orders: prev.orders.map((o) => (o.id === id ? { ...o, status: status as Order["status"] } : o)),
        });
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx?.snapshots) return;
      for (const [key, prev] of ctx.snapshots) {
        qc.setQueryData(key, prev);
      }
      toast.error("Status update failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  const bulkUpdate = useMutation({
    mutationFn: ({ ids, status }: { ids: number[]; status: string }) =>
      api.patch(`/orders/bulk-status`, { ids, status }),
    onSuccess: (res, vars) => {
      toast.success(`Updated ${res.data?.updated ?? vars.ids.length} orders → ${vars.status}`);
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Bulk update failed";
      toast.error(msg);
    },
  });

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (group: Order[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = group.every((o) => next.has(o.id));
      if (allSelected) group.forEach((o) => next.delete(o.id));
      else group.forEach((o) => next.add(o.id));
      return next;
    });
  };

  const allVisibleIds = orders.map((o) => o.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allVisibleIds));
  };

  const runBulk = (status: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Update ${ids.length} order(s) to ${status}? Notifications will be sent to all buyers.`)) return;
    bulkUpdate.mutate({ ids, status });
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-100px)]">
      {/* Left: orders list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="font-grotesk font-bold text-2xl text-ink">Orders</h1>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue border border-blue rounded-lg px-3 py-1.5 hover:bg-blue-pale transition-colors disabled:opacity-60"
            >
              <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {/* Date range picker */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {DATE_RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setDateRange(r.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  dateRange === r.key
                    ? "bg-ink text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-ink"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Status tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === s
                    ? "bg-blue text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:border-blue"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order number, store name, phone…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-blue"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 bg-blue-pale border border-blue/30 rounded-xl px-4 py-2.5">
            <CheckCircle2 size={16} className="text-blue" />
            <span className="text-sm font-medium text-ink">
              {selectedIds.size} selected
            </span>
            <span className="text-xs text-gray-400 mr-2">Mark as:</span>
            {BULK_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => runBulk(s)}
                disabled={bulkUpdate.isPending}
                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-blue hover:text-blue disabled:opacity-60"
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-auto text-xs text-gray-400 hover:text-ink"
            >
              Clear
            </button>
          </div>
        )}

        {/* Table — grouped by day */}
        <div className="flex-1 overflow-auto bg-white border border-gray-200 rounded-2xl">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="h-14 bg-blue-pale rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p>No orders in this range.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-off-white sticky top-0 z-10">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="accent-blue"
                    />
                  </th>
                  {["#", "Store", "Status", "Payment", "Total", "Time"].map((h) => (
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
                {grouped.map(([day, bucket]) => {
                  const groupAllSelected =
                    bucket.orders.length > 0 &&
                    bucket.orders.every((o) => selectedIds.has(o.id));
                  return (
                    <Fragment key={day}>
                      <tr className="bg-off-white">
                        <td className="px-4 py-2">
                          <input
                            type="checkbox"
                            checked={groupAllSelected}
                            onChange={() => toggleGroup(bucket.orders)}
                            onClick={(e) => e.stopPropagation()}
                            className="accent-blue"
                          />
                        </td>
                        <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-ink">
                          {dayLabel(day)}{" "}
                          <span className="text-gray-400 font-normal">
                            · {bucket.orders.length} orders · {formatPrice(bucket.revenue)} revenue
                          </span>
                        </td>
                      </tr>
                      {bucket.orders.map((o) => (
                        <tr
                          key={o.id}
                          onClick={() => {
                            setSelectedId(o.id);
                            router.replace(`/admin/orders?id=${o.id}`, { scroll: false });
                          }}
                          className={`cursor-pointer hover:bg-off-white transition-colors ${
                            selectedId === o.id ? "bg-blue-pale" : ""
                          }`}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(o.id)}
                              onChange={() => toggleOne(o.id)}
                              className="accent-blue"
                            />
                          </td>
                          <td className="px-4 py-3 font-grotesk font-semibold text-ink">
                            #{o.orderNumber}
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">
                            <p className="truncate">{getOrderStoreName(o)}</p>
                            {getOrderPhone(o) && (
                              <a
                                href={telHref(getOrderPhone(o))}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs text-blue hover:underline"
                              >
                                {getOrderPhone(o)}
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                                STATUS_STYLES[o.status] || ""
                              }`}
                            >
                              {o.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {o.paymentMethod}
                          </td>
                          <td className="px-4 py-3 font-grotesk font-semibold text-blue">
                            {formatPrice(o.total)}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                            {new Date(o.createdAt).toLocaleTimeString("en-NP", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Right: detail panel */}
      {selectedOrder && (
        <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col overflow-hidden bg-white border border-gray-200 rounded-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <p className="font-grotesk font-bold text-sm text-ink">
              #{selectedOrder.orderNumber}
            </p>
            <button
              onClick={() => {
                setSelectedId(null);
                router.replace("/admin/orders", { scroll: false });
              }}
              className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Status picker */}
            <div>
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-2">
                Order Status
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {STATUSES.filter((s) => s !== "ALL").map((s) => {
                  const pendingThis =
                    updateStatus.isPending &&
                    updateStatus.variables?.id === selectedOrder.id &&
                    updateStatus.variables?.status === s;
                  return (
                    <button
                      key={s}
                      disabled={updateStatus.isPending}
                      onClick={() =>
                        updateStatus.mutate({
                          id: selectedOrder.id,
                          status: s,
                        })
                      }
                      className={`inline-flex items-center justify-center gap-1 text-xs font-medium py-1.5 px-2 rounded-lg border transition-colors disabled:opacity-60 ${
                        selectedOrder.status === s
                          ? "border-blue bg-blue text-white"
                          : "border-gray-200 hover:border-blue text-gray-600"
                      }`}
                    >
                      {pendingThis && <Loader2 size={12} className="animate-spin" />}
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Invoice PDF */}
            {selectedOrder.invoicePdfPath && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-2">
                  Invoice
                </label>
                <a
                  href={`${(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/api\/?$/, "")}${selectedOrder.invoicePdfPath}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg border border-blue text-blue hover:bg-blue-pale transition-colors"
                >
                  Download Invoice PDF
                </a>
                <p className="text-[11px] text-gray-400 mt-1">
                  Email {selectedOrder.invoiceEmailSent ? "sent to buyer." : "not sent (check server logs)."}
                </p>
              </div>
            )}

            {/* Map */}
            {selectedOrder.deliveryLat && selectedOrder.deliveryLng && (
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wide block mb-2">
                  Delivery Location
                </label>
                <MapView
                  lat={selectedOrder.deliveryLat}
                  lng={selectedOrder.deliveryLng}
                />
              </div>
            )}

            {/* Delivery info */}
            <div className="bg-off-white rounded-xl p-3 text-xs space-y-1.5 text-gray-600">
              <p>
                <span className="font-medium text-ink">Store:</span>{" "}
                {getOrderStoreName(selectedOrder)}
              </p>
              <p>
                <span className="font-medium text-ink">Phone:</span>{" "}
                {getOrderPhone(selectedOrder) ? (
                  <a
                    href={telHref(getOrderPhone(selectedOrder))}
                    className="text-blue font-semibold hover:underline"
                  >
                    {getOrderPhone(selectedOrder)}
                  </a>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </p>
              <p>
                <span className="font-medium text-ink">Address:</span>{" "}
                {selectedOrder.deliveryAddress}, {selectedOrder.deliveryDistrict}
              </p>
              <p>
                <span className="font-medium text-ink">Payment:</span>{" "}
                {selectedOrder.paymentMethod} · {selectedOrder.paymentStatus}
              </p>
            </div>

            {/* Items */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Items
              </p>
              <ul className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
                {selectedOrder.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between px-3 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-medium text-ink">{item.productName}</p>
                      <p className="text-gray-400">
                        {item.qty} × {formatPrice(item.price)}
                      </p>
                    </div>
                    <p className="font-grotesk font-semibold text-ink">
                      {formatPrice(item.price * item.qty)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Totals */}
            <div className="space-y-1.5 text-xs border-t border-gray-200 pt-3">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>{formatPrice(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery</span>
                <span>{formatPrice(selectedOrder.deliveryFee)}</span>
              </div>
              <div className="flex justify-between font-grotesk font-bold text-sm text-ink">
                <span>Total</span>
                <span className="text-blue">{formatPrice(selectedOrder.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div className="text-gray-400">Loading…</div>}>
      <OrdersContent />
    </Suspense>
  );
}
