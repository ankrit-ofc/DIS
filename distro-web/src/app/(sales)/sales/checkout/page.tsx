"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Minus, Plus, Trash2, AlertCircle, CheckCircle2, MapPin, Pencil, Store } from "lucide-react";
import api from "@/lib/api";
import { formatPrice, unitShort, normalizeDistrictsList } from "@/lib/utils";
import { useSalesStore, type SalesBuyer } from "@/store/salesStore";
import { useCartStore } from "@/store/cartStore";
import { useCartValidation } from "@/hooks/useCartValidation";

const MIN_ORDER = 10000;
const VAT_RATE = 0.13;

interface District {
  id: string;
  name: string;
  deliveryFee: number;
  active: boolean;
}

// Field checkout: COD or credit only — no online gateways on a shop visit.
export default function SalesCheckoutPage() {
  const router = useRouter();
  const { buyer, setBuyer, clearBuyer } = useSalesStore();
  const { items, subtotal, updateQty, removeItem, clearCart } = useCartStore();
  const { issues, revalidate } = useCartValidation();

  const [paymentMethod, setPaymentMethod] = useState<"COD" | "CREDIT">("COD");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [editing, setEditing] = useState(false);
  const [saveMode, setSaveMode] = useState<"order" | "profile">("order");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<{ orderNumber: string; total: number } | null>(null);

  const { data: districts = [] } = useQuery<District[]>({
    queryKey: ["districts-active"],
    queryFn: () =>
      api.get("/districts?active=true").then((r) => normalizeDistrictsList<District>(r.data)),
  });

  useEffect(() => {
    if (!buyer) router.replace("/sales");
  }, [buyer, router]);

  // Pre-fill from the SELECTED BUYER's profile — never the rep's own.
  useEffect(() => {
    if (buyer) {
      setAddress(buyer.address ?? "");
      setDistrict(buyer.district ?? "");
    }
  }, [buyer]);

  if (!buyer) return null;

  const hasSavedAddress = !!(buyer.address?.trim() && buyer.district);

  const sub = subtotal();
  const vat = Math.round(sub * VAT_RATE * 100) / 100;
  // Mirror of the server's District-table fee lookup, so the total shown at
  // the shop door matches what the order will actually cost.
  const deliveryFee = districts.find((d) => d.name === district)?.deliveryFee ?? 0;
  const belowMin = sub < MIN_ORDER;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!buyer || items.length === 0 || belowMin) return;
    if (!district) {
      setError("Select the delivery district.");
      return;
    }
    if (!address.trim()) {
      setError("Enter the delivery address.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post("/orders", {
        buyerId: buyer.id,
        deliveryDistrict: district,
        deliveryAddress: address.trim(),
        paymentMethod,
        notes: notes || undefined,
        items: items.map((i) => ({ productId: i.id, qty: i.qty })),
      });

      // "Save as shop's new address" — persist onto the buyer's profile.
      if (editing && saveMode === "profile") {
        try {
          const upd = await api.patch(`/sales/buyers/${buyer.id}`, {
            address: address.trim(),
            district,
          });
          setBuyer(upd.data.buyer as SalesBuyer); // same id — selection survives
        } catch {
          // Order is in; profile save is best-effort.
        }
      }

      const order = res.data?.order;
      clearCart();
      setPlaced({ orderNumber: order?.orderNumber ?? "—", total: order?.total ?? 0 });
    } catch (err: any) {
      const resp = err?.response;
      if (resp?.status === 409 && resp.data?.code === "INSUFFICIENT_STOCK") {
        void revalidate();
        setError("Stock changed while ordering — fix the highlighted items below.");
      } else {
        setError(resp?.data?.error ?? err?.message ?? "Failed to place order");
      }
      setSubmitting(false);
    }
  }

  if (placed) {
    return (
      <SalesDone
        orderNumber={placed.orderNumber}
        total={placed.total}
        shopName={buyer.storeName ?? buyer.phone}
        onNextShop={() => {
          clearBuyer();
          router.push("/sales");
        }}
        onSameShop={() => router.push("/sales/catalogue")}
      />
    );
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen px-4 py-4">
      <button
        onClick={() => router.push("/sales/catalogue")}
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue mb-3 transition-colors"
      >
        <ChevronLeft size={14} /> Back to catalogue
      </button>

      <h1 className="font-grotesk font-bold text-lg text-ink mb-1">
        Order for {buyer.storeName ?? buyer.phone}
      </h1>
      <p className="text-xs text-gray-400 mb-4">
        {buyer.phone}
        {buyer.district ? ` · ${buyer.district}` : ""}
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-16">
          Nothing in the order yet — add products from the catalogue.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Lines */}
          <div className="bg-white border border-gray-200 rounded-[8px] divide-y divide-gray-100">
            {items.map((item) => {
              const unit = unitShort(item.sellUnit);
              const issue = issues.find((i) => i.id === item.id);
              return (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">
                        {formatPrice(item.price)} / {unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          item.qty - 1 < item.moq
                            ? removeItem(item.id)
                            : updateQty(item.id, item.qty - 1)
                        }
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 hover:bg-blue-pale transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="font-grotesk text-sm font-semibold w-10 text-center">
                        {item.qty} <span className="text-[10px] text-gray-400 font-normal">{unit}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.id, item.qty + 1)}
                        disabled={item.qty >= item.maxOrderQty}
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 hover:bg-blue-pale disabled:opacity-40 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        aria-label="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {issue && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                      <AlertCircle size={12} />
                      {issue.type === "INACTIVE" ? (
                        <span>No longer available — remove it.</span>
                      ) : issue.type === "PRICE" ? (
                        <span>Price changed to {formatPrice(issue.price ?? 0)}.</span>
                      ) : (
                        <>
                          <span>Only {issue.available} available.</span>
                          {issue.available > 0 && (
                            <button
                              type="button"
                              onClick={() => { updateQty(item.id, issue.available); void revalidate(); }}
                              className="font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded px-2 py-0.5 transition-colors"
                            >
                              Update to {issue.available}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Delivery + payment */}
          <div className="bg-white border border-gray-200 rounded-[8px] p-4 space-y-3">
            {hasSavedAddress && !editing ? (
              /* Saved shop address — read-only card, zero fields */
              <div className="flex items-start gap-3 rounded-[6px] border border-gray-200 bg-off-white/60 p-3">
                <span className="w-8 h-8 shrink-0 rounded-full bg-blue-light text-blue flex items-center justify-center">
                  <Store size={14} />
                </span>
                <div className="flex-1 min-w-0 text-sm">
                  <p className="font-semibold text-ink truncate">
                    {buyer.storeName ?? buyer.phone}
                  </p>
                  <p className="text-gray-600 text-xs mt-0.5">{buyer.address}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                    <MapPin size={10} /> {buyer.district}
                    {deliveryFee > 0 ? ` · delivery ${formatPrice(deliveryFee)}` : " · free delivery"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditing(true); setSaveMode("order"); }}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-blue hover:text-blue-dark transition-colors"
                >
                  <Pencil size={11} />
                  Change
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    Delivery address
                  </label>
                  <textarea
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, tole, landmark…"
                    className="w-full border border-gray-200 rounded-[6px] px-3 py-2 text-sm focus:outline-none focus:border-blue resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    District
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    required
                    className="w-full border border-gray-200 rounded-[6px] px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue"
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
                {hasSavedAddress && (
                  <div className="rounded-[6px] border border-gray-200 p-3 space-y-2">
                    {([
                      ["order", "Use for this order only"],
                      ["profile", "Save as shop's new address"],
                    ] as const).map(([mode, label]) => (
                      <label key={mode} className="flex items-center gap-2 text-sm text-ink cursor-pointer">
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
                        setEditing(false);
                        setAddress(buyer.address ?? "");
                        setDistrict(buyer.district ?? "");
                      }}
                      className="text-xs text-gray-400 hover:text-blue underline transition-colors"
                    >
                      Cancel — keep saved address
                    </button>
                  </div>
                )}
              </>
            )}
            <div>
              <span className="text-xs font-medium text-gray-600 block mb-1.5">Payment</span>
              <div className="grid grid-cols-2 gap-2">
                {(["COD", "CREDIT"] as const).map((m) => (
                  <label
                    key={m}
                    className={`flex items-center gap-2 border rounded-[6px] px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                      paymentMethod === m
                        ? "border-blue bg-blue-light/50 text-ink"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      className="accent-blue"
                      checked={paymentMethod === m}
                      onChange={() => setPaymentMethod(m)}
                    />
                    {m === "COD" ? "Cash on delivery" : "Credit (on account)"}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Notes</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note for the warehouse"
                className="w-full border border-gray-200 rounded-[6px] px-3 py-2 text-sm focus:outline-none focus:border-blue"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="bg-white border border-gray-200 rounded-[8px] p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-grotesk font-medium">{formatPrice(sub)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>VAT (13%)</span>
              <span className="font-grotesk font-medium">{formatPrice(vat)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Delivery{district ? ` (${district})` : ""}</span>
              {deliveryFee > 0 ? (
                <span className="font-grotesk font-medium">{formatPrice(deliveryFee)}</span>
              ) : (
                <span className="font-grotesk font-medium text-green">Free</span>
              )}
            </div>
            <div className="flex justify-between font-grotesk font-bold text-base text-ink border-t border-gray-200 pt-2">
              <span>Total</span>
              <span className="text-blue">{formatPrice(sub + vat + deliveryFee)}</span>
            </div>
          </div>

          {belowMin && (
            <p className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-[6px] p-3 text-xs">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              Minimum order is Rs {MIN_ORDER.toLocaleString("en-IN")}. Add Rs{" "}
              {Math.max(0, MIN_ORDER - sub).toLocaleString("en-IN")} more.
            </p>
          )}
          {error && (
            <p className="flex items-start gap-2 text-red-500 bg-red-50 rounded-[6px] p-3 text-xs">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || belowMin || items.length === 0}
            className="w-full bg-blue hover:bg-blue-dark disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-medium py-3.5 rounded-[6px] transition-colors"
          >
            {submitting ? "Placing order…" : `Place order for ${buyer.storeName ?? "shop"}`}
          </button>
        </form>
      )}
    </div>
  );
}

function SalesDone({
  orderNumber,
  total,
  shopName,
  onNextShop,
  onSameShop,
}: {
  orderNumber: string;
  total: number;
  shopName: string;
  onNextShop: () => void;
  onSameShop: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <CheckCircle2 size={48} className="text-green mb-4" />
      <h1 className="font-grotesk font-bold text-xl text-ink mb-1">Order placed</h1>
      <p className="text-sm text-gray-500 mb-1">
        {orderNumber} · {formatPrice(total)}
      </p>
      <p className="text-xs text-gray-400 mb-8">
        {shopName} will get the confirmation SMS.
      </p>
      <div className="w-full space-y-2">
        <button
          onClick={onNextShop}
          className="w-full bg-blue hover:bg-blue-dark text-white font-medium py-3 rounded-[6px] transition-colors"
        >
          Next shop
        </button>
        <button
          onClick={onSameShop}
          className="w-full border border-gray-200 hover:bg-gray-50 text-ink text-sm font-medium py-3 rounded-[6px] transition-colors"
        >
          Another order for this shop
        </button>
      </div>
    </div>
  );
}
