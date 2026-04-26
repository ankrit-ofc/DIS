"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, CheckCircle2, Circle, Clock, Truck, Package, Home } from "lucide-react";
import api from "@/lib/api";

interface TrackingResult {
  id: number;
  orderNumber: string;
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "DISPATCHED" | "DELIVERED" | "CANCELLED";
  storeName: string;
  deliveryAddress: string;
  deliveryDistrict: string;
  createdAt: string;
  updatedAt: string;
}

const STEPS: {
  key: TrackingResult["status"];
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  { key: "PENDING", label: "Order Placed", icon: <Package size={18} />, description: "Your order has been received" },
  { key: "CONFIRMED", label: "Confirmed", icon: <CheckCircle2 size={18} />, description: "Order confirmed by DISTRO" },
  { key: "PROCESSING", label: "Processing", icon: <Clock size={18} />, description: "Order is being packed" },
  { key: "DISPATCHED", label: "On the Way", icon: <Truck size={18} />, description: "Out for delivery" },
  { key: "DELIVERED", label: "Delivered", icon: <Home size={18} />, description: "Delivered to your store" },
];

function getStepIndex(status: TrackingResult["status"]) {
  return STEPS.findIndex((s) => s.key === status);
}

function TrackContent() {
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [orderId, setOrderId] = useState(searchParams.get("orderId") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() && !orderId.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams();
      if (phone) params.set("phone", phone.trim());
      if (orderId) params.set("orderId", orderId.trim());
      const res = await api.get<TrackingResult>(`/orders/track?${params.toString()}`);
      setResult(res.data);
    } catch {
      setError("No order found with the provided details. Please check and try again.");
    } finally {
      setLoading(false);
    }
  }

  const currentStep = result ? getStepIndex(result.status) : -1;
  const isCancelled = result?.status === "CANCELLED";

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 pt-2 pb-12">
      <div className="text-center mb-8">
        <h1 className="font-grotesk font-bold text-2xl text-ink mb-2">
          Track Your Order
        </h1>
        <p className="text-gray-400 text-sm">
          Enter your phone number and order ID to track your delivery.
        </p>
      </div>

      {/* Search form */}
      <form
        onSubmit={handleTrack}
        className="bg-white rounded-2xl border border-gray-200 p-6 mb-6"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-ink block mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98XXXXXXXX"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink block mb-1.5">
              Order ID
            </label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="e.g. 12345"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
            />
          </div>
          <button
            type="submit"
            disabled={loading || (!phone.trim() && !orderId.trim())}
            className="w-full flex items-center justify-center gap-2 bg-blue hover:bg-blue-dark disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition-colors"
          >
            <Search size={16} />
            {loading ? "Tracking…" : "Track Order"}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-500 text-sm rounded-xl px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <p className="text-xs text-gray-400">Order</p>
            <p className="font-grotesk font-bold text-base text-ink">
              #{result.orderNumber}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {result.storeName} · {result.deliveryDistrict}
            </p>
          </div>

          {/* Timeline */}
          <div className="px-5 py-6">
            {isCancelled ? (
              <div className="text-center py-4 text-red-500">
                <p className="font-semibold">Order Cancelled</p>
                <p className="text-xs text-gray-400 mt-1">
                  This order has been cancelled.
                </p>
              </div>
            ) : (
              <ol className="space-y-0">
                {STEPS.map((step, i) => {
                  const isCompleted = i <= currentStep;
                  const isCurrent = i === currentStep;
                  const isLast = i === STEPS.length - 1;

                  return (
                    <li key={step.key} className="flex gap-4">
                      {/* Icon + line */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex items-center justify-center w-9 h-9 rounded-full border-2 transition-colors ${
                            isCompleted
                              ? "bg-green border-green text-white"
                              : isCurrent
                              ? "bg-blue border-blue text-white"
                              : "bg-white border-gray-200 text-gray-400"
                          }`}
                        >
                          {isCompleted && !isCurrent ? (
                            <CheckCircle2 size={18} />
                          ) : (
                            step.icon
                          )}
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

                      {/* Label */}
                      <div className={`pb-6 ${isLast ? "pb-0" : ""}`}>
                        <p
                          className={`text-sm font-semibold ${
                            isCompleted ? "text-ink" : "text-gray-400"
                          }`}
                        >
                          {step.label}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {step.description}
                        </p>
                        {isCurrent && (
                          <span className="inline-block mt-1 text-xs bg-blue-light text-blue font-medium px-2 py-0.5 rounded-full">
                            Current Status
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="px-5 py-3 border-t border-gray-200 bg-off-white">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Circle size={8} className="fill-current" />
              <p className="text-xs">
                Last updated: {new Date(result.updatedAt).toLocaleString("en-NP")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading…</div>}>
      <TrackContent />
    </Suspense>
  );
}
