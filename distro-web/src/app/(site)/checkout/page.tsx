"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { formatPrice } from "@/lib/utils";
import api from "@/lib/api";
import { AlertCircle, MapPin } from "lucide-react";
import toast from "react-hot-toast";

interface StockIssue {
  productId: number | string;
  name: string;
  requested: number;
  available: number;
}

const MapLocationPicker = dynamic(
  () => import("@/components/MapLocationPicker"),
  { ssr: false, loading: () => <div className="h-72 bg-blue-pale rounded-xl animate-pulse" /> }
);

function CheckoutForm() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCartStore();
  const { user } = useAuthStore();

  const [storeName, setStoreName] = useState(user?.storeName || "");
  const [address, setAddress] = useState("");
  const [deliveryArea, setDeliveryArea] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"COD">("COD");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MIN_ORDER = 50000;
  const VAT_RATE = 0.13;
  const sub = subtotal();
  const vat = Math.round(sub * VAT_RATE * 100) / 100;
  const total = sub + vat;
  const belowMin = sub < MIN_ORDER;
  const needed = Math.max(0, MIN_ORDER - sub);

  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) {
      setStockIssues([]);
      return;
    }
    (async () => {
      try {
        const checks = await Promise.all(
          items.map((it) =>
            api
              .get(`/products/${it.id}`)
              .then((r) => ({ item: it, product: r.data }))
              .catch(() => null)
          )
        );
        if (cancelled) return;
        const issues: StockIssue[] = [];
        for (const c of checks) {
          if (!c) continue;
          // stockQty is in pieces; cart qty is in cartons.
          const availablePieces = c.product?.stockQty ?? c.product?.stock ?? 0;
          const ppc = c.item.piecesPerCarton || 1;
          const cartonsAvailable = Math.floor(availablePieces / ppc);
          if (cartonsAvailable < c.item.qty) {
            issues.push({
              productId: c.item.id,
              name: c.item.name,
              requested: c.item.qty,
              available: cartonsAvailable,
            });
          }
        }
        setStockIssues(issues);
      } catch {
        /* ignore — backend will re-validate on submit */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    if (belowMin) {
      setError(`Minimum order is Rs ${MIN_ORDER.toLocaleString("en-IN")}. Add Rs ${needed.toLocaleString("en-IN")} more.`);
      return;
    }
    if (!deliveryArea.trim()) {
      setError("Please enter your delivery area.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await api.post("/orders", {
        storeName,
        deliveryAddress: address,
        deliveryDistrict: deliveryArea.trim(),
        deliveryLat: location?.lat ?? null,
        deliveryLng: location?.lng ?? null,
        paymentMethod,
        items: items.map((item) => ({
          productId: item.id,
          qty: item.qty,
          price: item.price,
        })),
      });

      clearCart();
      toast.success("Order placed successfully");
      const created = res.data?.order ?? res.data;
      const orderId = created?.id ?? res.data?.orderId;
      if (!orderId) {
        setError("Order placed but confirmation link is missing. Check My Orders.");
        toast.error("Missing order id in response");
        setSubmitting(false);
        return;
      }
      router.push(`/order-confirm/${orderId}`);
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      const message = errData?.message || errData?.error || "Failed to place order. Please try again.";
      setError(message);
      toast.error(message);
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-24 text-gray-400">
        <p className="text-lg font-medium">Your distro van is empty</p>
        <a href="/catalogue" className="mt-4 inline-block text-blue hover:underline text-sm">
          Browse Catalogue
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {stockIssues.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold flex items-center gap-2">
            <AlertCircle size={16} /> Some items in your van no longer have enough stock
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-0.5 text-xs">
            {stockIssues.map((s) => (
              <li key={s.productId}>
                {s.name}: requested {s.requested} cartons, only {s.available} available
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Reduce the quantity in your van or remove the item before checking out.
          </p>
        </div>
      )}
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Left: Form */}
        <div className="space-y-6">
          {/* Delivery details */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-grotesk font-semibold text-base text-ink mb-5">
              Delivery Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-ink block mb-1.5">
                  Store Name
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  required
                  placeholder="e.g. Ram General Store"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-ink block mb-1.5">
                  Delivery Address
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  rows={3}
                  placeholder="Street, tole, landmark…"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue resize-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-ink block mb-1.5">
                  Delivery Area
                </label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={deliveryArea}
                    onChange={(e) => setDeliveryArea(e.target.value)}
                    required
                    placeholder="e.g. Balaju, Kathmandu"
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-blue"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  We currently deliver within the Kathmandu Valley area
                </p>
              </div>
            </div>
          </section>

          {/* Map */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-grotesk font-semibold text-base text-ink mb-5">
              Pin Your Store Location
            </h2>
            <MapLocationPicker
              onLocationChange={(loc) => setLocation(loc)}
            />
          </section>

          {/* Payment */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-grotesk font-semibold text-base text-ink mb-5">
              Payment Method
            </h2>
            <div className="space-y-3">
              {/* [ESEWA - UNCOMMENT WHEN MERCHANT ACCOUNT READY]
              <label
                className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  paymentMethod === "ESEWA"
                    ? "border-blue bg-blue-pale"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value="ESEWA"
                  checked={paymentMethod === "ESEWA"}
                  onChange={() => setPaymentMethod("ESEWA")}
                  className="accent-blue"
                />
                <div>
                  <p className="text-sm font-semibold text-ink">eSewa</p>
                  <p className="text-xs text-gray-400">Digital wallet</p>
                </div>
              </label>
              [/ESEWA] */}

              {/* [KHALTI - UNCOMMENT WHEN MERCHANT ACCOUNT READY]
              <label
                className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  paymentMethod === "KHALTI"
                    ? "border-blue bg-blue-pale"
                    : "border-gray-200 hover:border-gray-400"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value="KHALTI"
                  checked={paymentMethod === "KHALTI"}
                  onChange={() => setPaymentMethod("KHALTI")}
                  className="accent-blue"
                />
                <div>
                  <p className="text-sm font-semibold text-ink">Khalti</p>
                  <p className="text-xs text-gray-400">Digital wallet</p>
                </div>
              </label>
              [/KHALTI] */}

              <label
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-blue bg-blue-pale cursor-pointer"
              >
                <input
                  type="radio"
                  name="payment"
                  value="COD"
                  checked={true}
                  readOnly
                  className="accent-blue"
                />
                <div>
                  <p className="text-sm font-semibold text-ink">Cash on Delivery</p>
                  <p className="text-xs text-gray-400">Pay when delivered</p>
                </div>
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Online payments coming soon — eSewa &amp; PhonePe
            </p>
          </section>
        </div>

        {/* Right: Summary */}
        <div>
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sticky top-20">
            <h2 className="font-grotesk font-semibold text-base text-ink mb-4">
              Order Summary
            </h2>

            <ul className="space-y-3 mb-4">
              {items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">
                      {item.qty} {item.qty === 1 ? "carton" : "cartons"} × {formatPrice(item.price)}
                    </p>
                  </div>
                  <p className="text-sm font-grotesk font-medium text-ink">
                    {formatPrice(item.price * item.qty)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-grotesk font-medium">
                  {formatPrice(sub)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>VAT (13%)</span>
                <span className="font-grotesk font-medium">
                  {formatPrice(vat)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery</span>
                <span className="font-grotesk font-medium text-green">Free</span>
              </div>
              <div className="flex justify-between font-grotesk font-bold text-base text-ink border-t border-gray-200 pt-3">
                <span>Total</span>
                <span className="text-blue">{formatPrice(total)}</span>
              </div>
            </div>

            {belowMin && (
              <div className="mt-4 flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                Minimum order is Rs {MIN_ORDER.toLocaleString("en-IN")}. Add Rs {needed.toLocaleString("en-IN")} more to proceed.
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-start gap-2 text-red-500 bg-red-50 rounded-xl p-3 text-xs">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || belowMin}
              className="mt-5 w-full bg-blue hover:bg-blue-dark disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-medium py-3.5 rounded-xl transition-colors shadow-lg shadow-blue/20"
            >
              {submitting ? "Placing Order…" : "Place Order"}
            </button>

            <p className="text-xs text-gray-400 text-center mt-3">
              By placing an order you agree to our terms of service
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}

export default function CheckoutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-grotesk font-bold text-2xl text-ink mb-8">
        Checkout
      </h1>
      <Suspense fallback={<div className="text-gray-400">Loading…</div>}>
        <CheckoutForm />
      </Suspense>
    </div>
  );
}
