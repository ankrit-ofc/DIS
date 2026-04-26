"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LogOut, MapPin, Navigation, Phone, RefreshCw, Truck } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { formatPrice } from "@/lib/utils";

interface DriverOrder {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryDistrict: string;
  totalCartons: number;
  total: number;
  createdAt: string;
}

function buildMapsUrl(address: string, district: string): string {
  const parts = [address, district, "Nepal"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parts)}`;
}

function formatTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("9")) return `tel:+977${digits}`;
  return `tel:${phone}`;
}

export default function DriverDashboardPage() {
  const router = useRouter();
  const { user, clearAuth, _hasHydrated } = useAuthStore();

  const [orders, setOrders] = useState<DriverOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ orders: DriverOrder[] }>("/driver/orders");
      setOrders(res.data.orders ?? []);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: string }; status?: number } })?.response;
      if (data?.status === 401) {
        clearAuth();
        router.push("/driver/login");
        return;
      }
      setError(data?.data?.error ?? "Could not load deliveries");
    } finally {
      setLoading(false);
    }
  }, [clearAuth, router]);

  // Client-side guard — middleware also redirects, this catches the post-hydrate case
  useEffect(() => {
    if (!_hasHydrated) return;
    if (!user || user.role !== "DRIVER") {
      router.push("/driver/login");
      return;
    }
    load();
  }, [_hasHydrated, user, load, router]);

  function handleLogout() {
    clearAuth();
    toast.success("Signed out");
    router.push("/driver/login");
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-blue text-white px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Truck size={20} />
          <h1 className="font-grotesk font-semibold text-base">DISTRO Deliveries</h1>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Log out"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">Logout</span>
        </button>
      </header>

      <main className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-wide font-medium text-gray-500">
            {orders.length} {orders.length === 1 ? "delivery" : "deliveries"}
          </p>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium text-blue disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {loading && orders.length === 0 && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-44 bg-white rounded-2xl border border-gray-200 animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500">
            <Truck size={36} strokeWidth={1.2} className="mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No deliveries pending right now.</p>
            <p className="text-xs text-gray-400 mt-1">Pull refresh once admin confirms an order.</p>
          </div>
        )}

        <ul className="space-y-3">
          {orders.map((o) => (
            <li
              key={o.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-grotesk font-bold text-sm text-ink">
                    {o.orderNumber}
                  </p>
                  <p className="text-xs text-gray-500">{o.status}</p>
                </div>
                <span className="text-xs font-medium bg-blue-pale text-blue px-2.5 py-1 rounded-full">
                  {o.totalCartons} {o.totalCartons === 1 ? "carton" : "cartons"}
                </span>
              </div>

              <p className="font-medium text-sm text-ink">{o.customerName}</p>
              <a
                href={formatTelHref(o.customerPhone)}
                className="inline-flex items-center gap-1.5 text-sm text-blue hover:underline mt-0.5"
              >
                <Phone size={12} />
                {o.customerPhone}
              </a>

              <div className="flex items-start gap-1.5 mt-2 text-sm text-gray-600">
                <MapPin size={14} className="flex-shrink-0 mt-0.5 text-gray-400" />
                <div>
                  <p>{o.deliveryAddress || "—"}</p>
                  {o.deliveryDistrict && (
                    <p className="text-xs text-gray-400">{o.deliveryDistrict}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100">
                <p className="font-grotesk font-semibold text-sm text-ink">
                  {formatPrice(o.total)}
                </p>
                <a
                  href={buildMapsUrl(o.deliveryAddress, o.deliveryDistrict)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-blue hover:bg-blue-dark text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                >
                  <Navigation size={14} />
                  Navigate
                </a>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
