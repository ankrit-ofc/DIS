"use client";

import { useQuery } from "@tanstack/react-query";
import { X, Download, CheckCircle2, Circle } from "lucide-react";
import api from "@/lib/api";
import { formatPrice, routeParamId } from "@/lib/utils";

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

const STEPS: { key: Order["status"]; label: string }[] = [
  { key: "PENDING", label: "Placed" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "PROCESSING", label: "Processing" },
  { key: "DISPATCHED", label: "Dispatched" },
  { key: "DELIVERED", label: "Delivered" },
];

export default function OrderDetailModal({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const id = routeParamId(orderId);
  const { data: order, isLoading } = useQuery<Order>({
    queryKey: ["order", id],
    queryFn: () =>
      api.get(`/orders/${id}`).then((r) => r.data?.order ?? r.data),
    enabled: Boolean(id),
  });

  const currentStep = order
    ? STEPS.findIndex((s) => s.key === order.status)
    : -1;

  function downloadInvoice() {
    if (!id) return;
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL}/orders/${id}/invoice`,
      "_blank"
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div className="fixed inset-x-4 top-8 bottom-8 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px] bg-white rounded-2xl z-50 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <p className="text-xs text-gray-400">Order</p>
            <p className="font-grotesk font-bold text-base text-ink">
              #{order?.orderNumber || "…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {order && (
              <button
                onClick={downloadInvoice}
                className="flex items-center gap-1.5 text-xs text-blue border border-blue rounded-lg px-3 py-1.5 hover:bg-blue-pale transition-colors"
              >
                <Download size={13} />
                Invoice
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-blue-pale rounded-xl animate-pulse" />
              ))}
            </div>
          ) : order ? (
            <>
              {/* Timeline */}
              {order.status !== "CANCELLED" && (
                <div className="flex items-center">
                  {STEPS.map((step, i) => {
                    const done = i <= currentStep;
                    const last = i === STEPS.length - 1;
                    return (
                      <div key={step.key} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center ${
                              done ? "bg-green text-white" : "bg-gray-200 text-gray-400"
                            }`}
                          >
                            {done ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <Circle size={14} />
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-medium whitespace-nowrap ${
                              done ? "text-green" : "text-gray-400"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                        {!last && (
                          <div
                            className={`flex-1 h-0.5 mx-1 mb-4 ${
                              i < currentStep ? "bg-green" : "bg-gray-200"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {order.status === "CANCELLED" && (
                <div className="bg-red-50 text-red-500 text-sm rounded-xl px-4 py-3 font-medium">
                  This order was cancelled.
                </div>
              )}

              {/* Items */}
              <div>
                <h3 className="font-grotesk font-semibold text-sm text-ink mb-3">
                  Items
                </h3>
                <ul className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium text-ink">{item.productName ?? item.name}</p>
                        <p className="text-xs text-gray-400">
                          {item.qty} × {formatPrice(item.price)}{item.unit ? ` ${item.unit}` : ""}
                        </p>
                      </div>
                      <p className="font-grotesk font-semibold text-ink">
                        {formatPrice(item.total ?? item.price * item.qty)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-grotesk">{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Delivery ({order.deliveryDistrict})</span>
                  <span className="font-grotesk">{formatPrice(order.deliveryFee)}</span>
                </div>
                <div className="flex justify-between font-grotesk font-bold text-base text-ink border-t border-gray-200 pt-2">
                  <span>Total</span>
                  <span className="text-blue">{formatPrice(order.total)}</span>
                </div>
              </div>

              {/* Delivery + payment */}
              <div className="bg-off-white rounded-xl p-4 space-y-2 text-xs text-gray-600">
                <p>
                  <span className="font-medium text-ink">Address:</span>{" "}
                  {order.deliveryAddress}
                </p>
                <p>
                  <span className="font-medium text-ink">Payment:</span>{" "}
                  {order.paymentMethod} ·{" "}
                  <span
                    className={
                      order.paymentStatus === "PAID"
                        ? "text-green font-medium"
                        : "text-amber-600"
                    }
                  >
                    {order.paymentStatus}
                  </span>
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
