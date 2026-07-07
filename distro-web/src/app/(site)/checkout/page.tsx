"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useCartStore } from "@/store/cartStore";
import { useCartValidation } from "@/hooks/useCartValidation";
import { formatPrice, unitShort } from "@/lib/utils";
import api from "@/lib/api";
import { AlertCircle, MapPin, Pencil, Store } from "lucide-react";
import toast from "react-hot-toast";

const MapLocationPicker = dynamic(
  () => import("@/components/MapLocationPicker"),
  { ssr: false, loading: () => <div className="h-72 bg-blue-pale rounded-xl animate-pulse" /> }
);

interface MeProfile {
  id: string;
  storeName: string | null;
  district: string | null;
  address: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
}

interface District {
  id: string;
  name: string;
  deliveryFee: number;
  active: boolean;
}

function CheckoutForm() {
  const router = useRouter();
  const { items, subtotal, clearCart, updateQty, removeItem } = useCartStore();

  // Fresh profile — the persisted auth store doesn't carry address/district.
  const { data: profile, isLoading: profileLoading } = useQuery<MeProfile>({
    queryKey: ["me-profile"],
    queryFn: () => api.get("/auth/me").then((r) => r.data),
  });
  const { data: districts = [] } = useQuery<District[]>({
    queryKey: ["districts-active"],
    queryFn: () => api.get("/districts?active=true").then((r) => r.data.districts ?? []),
  });

  const [storeName, setStoreName] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  // "Change" flow: edit inline, then either keep for this order or persist.
  const [editing, setEditing] = useState(false);
  const [saveMode, setSaveMode] = useState<"order" | "profile">("order");
  const [paymentMethod, setPaymentMethod] = useState<"COD">("COD");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the form from the profile once it arrives.
  useEffect(() => {
    if (!profile) return;
    setStoreName((s) => s || profile.storeName || "");
    setAddress((a) => a || profile.address || "");
    setDistrict((d) => d || profile.district || "");
  }, [profile]);

  const hasSavedAddress = !!(profile?.address?.trim() && profile?.district);
  // Happy path: saved address → compact summary card, zero fields.
  const showForm = !profileLoading && (!hasSavedAddress || editing);

  const MIN_ORDER = 10000;
  const VAT_RATE = 0.13;
  const sub = subtotal();
  const vat = Math.round(sub * VAT_RATE * 100) / 100;
  // District drives the fee — server recomputes from the District table as the
  // source of truth; this mirrors that lookup so the shown total is honest.
  const deliveryFee = districts.find((d) => d.name === district)?.deliveryFee ?? 0;
  const total = sub + vat + deliveryFee;
  const belowMin = sub < MIN_ORDER;
  const needed = Math.max(0, MIN_ORDER - sub);

  // Server-side re-validation (stock, inactive, price drift) on mount.
  const { issues: stockIssues, revalidate } = useCartValidation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    if (belowMin) {
      setError(`Minimum order is Rs ${MIN_ORDER.toLocaleString("en-IN")}. Add Rs ${needed.toLocaleString("en-IN")} more.`);
      return;
    }
    if (!district) {
      setError("Please select your delivery district.");
      return;
    }
    if (!address.trim()) {
      setError("Please enter your delivery address.");
      return;
    }
    setSubmitting(true);
    setError(null);

    // Order pin: an explicit map pin from the edit form wins, else the
    // profile's saved shop location.
    const lat = location?.lat ?? (profile?.latitude != null ? Number(profile.latitude) : null);
    const lng = location?.lng ?? (profile?.longitude != null ? Number(profile.longitude) : null);

    try {
      const res = await api.post("/orders", {
        storeName,
        deliveryAddress: address.trim(),
        deliveryDistrict: district,
        deliveryLat: lat,
        deliveryLng: lng,
        paymentMethod,
        items: items.map((item) => ({
          productId: item.id,
          qty: item.qty,
          price: item.price,
        })),
      });

      // "Save as my new address" — persist to the profile after the order
      // succeeded. Best-effort: the order is already in.
      if (editing && saveMode === "profile") {
        try {
          await api.patch("/auth/me", { address: address.trim(), district });
        } catch {
          toast.error("Order placed, but the new address could not be saved to your profile.");
        }
      }

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
      const resp = (err as {
        response?: {
          status?: number;
          data?: { message?: string; error?: string; code?: string; items?: Array<{ productId: string; requested: number; available: number }> };
        };
      })?.response;
      // Checkout race: someone took the stock first — surface the same inline
      // "Update to N" cart UI instead of a generic failure toast.
      if (resp?.status === 409 && resp.data?.code === "INSUFFICIENT_STOCK") {
        void revalidate();
        setError("Stock changed while you were checking out — review the highlighted items above.");
        setSubmitting(false);
        return;
      }
      const message = resp?.data?.message || resp?.data?.error || "Failed to place order. Please try again.";
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
            <AlertCircle size={16} /> Some items in your van need attention
          </p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {stockIssues.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {s.name}:{" "}
                  {s.type === "INACTIVE"
                    ? "no longer available"
                    : s.type === "PRICE"
                    ? `price changed to ${formatPrice(s.price ?? 0)}`
                    : `requested ${s.requested}, only ${s.available} available`}
                </span>
                {s.type === "STOCK" && s.available > 0 && (
                  <button
                    type="button"
                    onClick={() => { updateQty(s.id, s.available); void revalidate(); }}
                    className="font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-md px-2 py-0.5 transition-colors"
                  >
                    Update to {s.available}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { removeItem(s.id); void revalidate(); }}
                  className="font-semibold underline hover:no-underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Left: Delivery + payment */}
        <div className="space-y-6">
          {/* Delivery details */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-grotesk font-semibold text-base text-ink mb-5">
              Delivery Details
            </h2>

            {profileLoading ? (
              <div className="h-20 bg-blue-pale/50 rounded-xl animate-pulse" />
            ) : hasSavedAddress && !editing ? (
              /* Saved address — compact read-only summary, zero fields */
              <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-off-white/60 p-4">
                <span className="w-9 h-9 shrink-0 rounded-full bg-blue-light text-blue flex items-center justify-center">
                  <Store size={16} />
                </span>
                <div className="flex-1 min-w-0 text-sm">
                  <p className="font-semibold text-ink truncate">
                    {profile?.storeName || "My shop"}
                  </p>
                  <p className="text-gray-600 mt-0.5">{profile?.address}</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <MapPin size={11} /> {profile?.district}
                    {deliveryFee > 0 ? ` · delivery ${formatPrice(deliveryFee)}` : " · free delivery"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditing(true); setSaveMode("order"); }}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-blue hover:text-blue-dark transition-colors"
                >
                  <Pencil size={12} />
                  Change
                </button>
              </div>
            ) : (
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
                    Delivery District
                  </label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      required
                      className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm bg-white focus:outline-none focus:border-blue"
                    >
                      <option value="">Select district…</option>
                      {districts.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name}
                          {d.deliveryFee > 0 ? ` — delivery ${formatPrice(d.deliveryFee)}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    We currently deliver within the Kathmandu Valley area
                  </p>
                </div>

                {/* Only offered when editing a saved address; first-time
                    addresses are saved to the profile automatically. */}
                {hasSavedAddress && (
                  <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                    {([
                      ["order", "Use for this order only"],
                      ["profile", "Save as my new address"],
                    ] as const).map(([mode, label]) => (
                      <label key={mode} className="flex items-center gap-2.5 text-sm text-ink cursor-pointer">
                        <input
                          type="radio"
                          name="saveMode"
                          className="accent-blue"
                          checked={saveMode === mode}
                          onChange={() => setSaveMode(mode)}
                        />
                        {label}
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        // Collapse back to the saved address untouched.
                        setEditing(false);
                        setAddress(profile?.address ?? "");
                        setDistrict(profile?.district ?? "");
                        setLocation(null);
                      }}
                      className="text-xs text-gray-400 hover:text-blue underline transition-colors"
                    >
                      Cancel — keep my saved address
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Map — only when entering/editing an address */}
          {showForm && (
            <section className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="font-grotesk font-semibold text-base text-ink mb-5">
                Pin Your Store Location
              </h2>
              <MapLocationPicker
                onLocationChange={(loc) => setLocation(loc)}
              />
            </section>
          )}

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
                      {item.qty} {unitShort(item.sellUnit)} × {formatPrice(item.price)}
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
                <span>Delivery{district ? ` (${district})` : ""}</span>
                {deliveryFee > 0 ? (
                  <span className="font-grotesk font-medium">{formatPrice(deliveryFee)}</span>
                ) : (
                  <span className="font-grotesk font-medium text-green">Free</span>
                )}
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
              disabled={submitting || belowMin || profileLoading}
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
