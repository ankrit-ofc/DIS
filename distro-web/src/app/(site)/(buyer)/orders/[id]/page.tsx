"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, Download, CheckCircle2, Circle, RotateCcw, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatPrice, routeParamId } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";

interface OrderItem {
  id: number;
  name: string;
  productName?: string;
  qty: number;
  price: number;
  total: number;
  unit?: string;
}

interface Order {
  id: number;
  orderNumber: string;
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
  storeName?: string;
  buyer?: { storeName?: string; phone?: string };
  deliveryAddress: string;
  deliveryDistrict: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

const STEPS: { key: Order["status"]; label: string; desc: string }[] = [
  { key: "PENDING", label: "Order Placed", desc: "Your order has been received" },
  { key: "CONFIRMED", label: "Confirmed", desc: "Order confirmed by DISTRO" },
  { key: "PROCESSING", label: "Processing", desc: "Being packed for dispatch" },
  { key: "DISPATCHED", label: "Dispatched", desc: "Out for delivery" },
  { key: "DELIVERED", label: "Delivered", desc: "Delivered to your store" },
];

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = routeParamId(params?.id as string | string[] | undefined);
  const { addItem } = useCartStore();

  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ["order", id],
    queryFn: () =>
      api.get(`/orders/${id}`).then((r) => r.data?.order ?? r.data),
    enabled: Boolean(id),
  });

  const currentStep = order ? STEPS.findIndex((s) => s.key === order.status) : -1;

  // Cancel window countdown
  const [remainingMs, setRemainingMs] = useState(0);
  useEffect(() => {
    if (!order || order.status !== "PENDING") return;
    const deadline = new Date(order.createdAt).getTime() + 30 * 60 * 1000;
    const tick = () => setRemainingMs(Math.max(0, deadline - Date.now()));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [order]);

  const canCancel = order?.status === "PENDING" && remainingMs > 0;
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);

  async function handleReorder() {
    if (!order) return;
    try {
      const res = await api.post(`/orders/${order.id}/reorder`);
      const items: Array<{ productId: string; name: string; price: number; qty: number; moq: number; piecesPerCarton: number; unit: string; imageUrl: string | null; available: boolean }> = res.data.items ?? [];
      let unavailable = 0;
      for (const it of items) {
        if (!it.available) { unavailable++; continue; }
        addItem({
          id: it.productId as unknown as number,
          name: it.name,
          price: it.price,
          mrp: it.price,
          unit: it.unit,
          moq: it.moq,
          piecesPerCarton: it.piecesPerCarton ?? it.moq ?? 1,
          image: it.imageUrl ?? undefined,
        }, it.qty);
      }
      toast.success(unavailable > 0
        ? `Added to cart — ${unavailable} item(s) unavailable`
        : "Items added to cart");
      router.push("/cart");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Reorder failed";
      toast.error(msg);
    }
  }

  async function handleCancel() {
    if (!order) return;
    if (!confirm("Are you sure you want to cancel this order?")) return;
    try {
      await api.patch(`/orders/${order.id}/cancel`);
      toast.success("Order cancelled");
      queryClient.invalidateQueries({ queryKey: ["order", id] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Cancel failed";
      toast.error(msg);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="h-6 bg-blue-pale rounded w-32 animate-pulse" />
        <div className="h-32 bg-blue-pale rounded-2xl animate-pulse" />
        <div className="h-48 bg-blue-pale rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">
        <p>Order not found.</p>
        <Link href="/orders" className="mt-4 inline-block text-blue hover:underline text-sm">
          ← Back to Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue transition-colors"
        >
          <ChevronLeft size={14} /> My Orders
        </Link>
        <button
          onClick={() =>
            window.open(`${process.env.NEXT_PUBLIC_API_URL}/orders/${id}/invoice`, "_blank")
          }
          className="flex items-center gap-1.5 text-sm text-blue border border-blue rounded-lg px-3 py-1.5 hover:bg-blue-pale transition-colors"
        >
          <Download size={14} />
          Download Invoice
        </button>
      </div>

      {/* Order header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-start justify-between mb-1">
          <p className="font-grotesk font-bold text-lg text-ink">
            #{order.orderNumber}
          </p>
          <span
            className={`text-xs font-medium px-3 py-1 rounded-full ${
              order.status === "DELIVERED"
                ? "bg-green-light text-green"
                : order.status === "CANCELLED"
                ? "bg-red-50 text-red-500"
                : "bg-blue-light text-blue"
            }`}
          >
            {order.status}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          Placed on{" "}
          {new Date(order.createdAt).toLocaleDateString("en-NP", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* Timeline */}
      {order.status !== "CANCELLED" ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="font-grotesk font-semibold text-sm text-ink mb-5">
            Order Status
          </h2>
          <ol className="space-y-0">
            {STEPS.map((step, i) => {
              const done = i <= currentStep;
              const isCurrent = i === currentStep;
              const isLast = i === STEPS.length - 1;
              return (
                <li key={step.key} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        done ? "bg-green text-white" : "bg-gray-200 text-gray-400"
                      }`}
                    >
                      {done ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                    </div>
                    {!isLast && (
                      <div
                        className={`w-0.5 flex-1 my-1 ${
                          i < currentStep ? "bg-green" : "bg-gray-200"
                        }`}
                        style={{ minHeight: 20 }}
                      />
                    )}
                  </div>
                  <div className={`pb-5 ${isLast ? "pb-0" : ""}`}>
                    <p
                      className={`text-sm font-semibold ${
                        done ? "text-ink" : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
                    {isCurrent && (
                      <span className="inline-block mt-1.5 text-xs bg-blue-light text-blue font-medium px-2.5 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <div className="bg-red-50 text-red-500 rounded-2xl p-4 font-medium text-sm">
          This order has been cancelled.
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="font-grotesk font-semibold text-sm text-ink">Items</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between px-5 py-4">
              <div>
                <p className="text-sm font-medium text-ink">{item.productName ?? item.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {item.qty}{item.unit ? ` ${item.unit}` : ""} × {formatPrice(item.price)}
                </p>
              </div>
              <p className="font-grotesk font-semibold text-ink text-sm">
                {formatPrice(item.total ?? item.price * item.qty)}
              </p>
            </li>
          ))}
        </ul>
        <div className="px-5 py-4 border-t border-gray-200 space-y-2 text-sm bg-off-white">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span className="font-grotesk">{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Delivery</span>
            <span className="font-grotesk">{formatPrice(order.deliveryFee)}</span>
          </div>
          <div className="flex justify-between font-grotesk font-bold text-base text-blue border-t border-gray-200 pt-2">
            <span className="text-ink">Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Actions: Reorder / Cancel */}
      {(canCancel || order.status === "DELIVERED") && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          {canCancel && (
            <>
              <p className="text-xs text-gray-500">
                Cancel available for{" "}
                <span className="font-grotesk font-semibold text-ink">
                  {mins}:{secs.toString().padStart(2, "0")}
                </span>{" "}
                minutes
              </p>
              <button
                onClick={handleCancel}
                className="w-full inline-flex items-center justify-center gap-2 border border-red-300 text-red-600 hover:bg-red-50 font-medium py-2.5 rounded-xl text-sm"
              >
                <XCircle size={16} />
                Cancel Order
              </button>
            </>
          )}
          {order.status === "DELIVERED" && (
            <button
              onClick={handleReorder}
              className="w-full inline-flex items-center justify-center gap-2 bg-blue hover:bg-blue-dark text-white font-medium py-2.5 rounded-xl text-sm"
            >
              <RotateCcw size={16} />
              Reorder
            </button>
          )}
        </div>
      )}

      {/* Delivery info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2 text-sm">
        <h2 className="font-grotesk font-semibold text-sm text-ink mb-3">
          Delivery Info
        </h2>
        <p className="text-gray-600">
          <span className="font-medium text-ink">Store:</span> {order.storeName ?? order.buyer?.storeName ?? "—"}
        </p>
        <p className="text-gray-600">
          <span className="font-medium text-ink">Address:</span>{" "}
          {order.deliveryAddress}, {order.deliveryDistrict}
        </p>
        <p className="text-gray-600">
          <span className="font-medium text-ink">Payment:</span>{" "}
          {order.paymentMethod} ·{" "}
          <span
            className={
              order.paymentStatus === "PAID" ? "text-green font-medium" : "text-amber-600"
            }
          >
            {order.paymentStatus}
          </span>
        </p>
      </div>
    </div>
  );
}
