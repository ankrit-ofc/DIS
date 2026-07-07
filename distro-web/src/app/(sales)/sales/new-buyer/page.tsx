"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { ChevronLeft } from "lucide-react";
import api from "@/lib/api";
import { normalizeDistrictsList } from "@/lib/utils";
import { useSalesStore, type SalesBuyer } from "@/store/salesStore";
import SalesShell from "@/components/sales/SalesShell";
import type { LatLng } from "@/components/sales/LocationCapture";

// Leaflet is sales-route-only — never in the buyer bundle.
const LocationCapture = dynamic(() => import("@/components/sales/LocationCapture"), {
  ssr: false,
  loading: () => <div className="h-64 bg-blue-light/40 rounded-[8px] animate-pulse" />,
});

interface District {
  id: string;
  name: string;
  active: boolean;
}

// Quick-create at the shop door — no OTP, the rep is physically present.
function NewBuyerForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setBuyer } = useSalesStore();

  const [districts, setDistricts] = useState<District[]>([]);
  const [form, setForm] = useState({
    storeName: searchParams.get("name") ?? "",
    ownerName: "",
    phone: "",
    district: "",
    address: "",
  });
  const [location, setLocation] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get("/districts?active=true")
      .then((r) => setDistricts(normalizeDistrictsList<District>(r.data)))
      .catch(() => {});
  }, []);

  function handleLocation(pos: LatLng, reverseAddress?: string) {
    setLocation(pos);
    // GPS reverse geocode pre-fills the address only while it's still empty —
    // never clobber what the rep typed.
    if (reverseAddress) {
      setForm((s) => (s.address.trim() ? s : { ...s, address: reverseAddress }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post("/sales/buyers", {
        ...form,
        latitude: location?.lat,
        longitude: location?.lng,
      });
      const buyer: SalesBuyer = res.data.buyer;
      setBuyer(buyer);
      router.push("/sales/catalogue");
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? "Could not create the shop");
      setSubmitting(false);
    }
  }

  return (
    <SalesShell>
      <button
        onClick={() => router.push("/sales")}
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue mb-4 transition-colors"
      >
        <ChevronLeft size={14} /> Back to search
      </button>

      <div className="bg-white border border-gray-200 rounded-[8px] p-4">
        <h1 className="font-grotesk font-semibold text-base text-ink mb-1">
          New shop
        </h1>
        <p className="text-xs text-gray-400 mb-4">
          Creates a normal buyer account — the owner can log in later with their phone.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Shop name <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={form.storeName}
              onChange={(e) => setForm((s) => ({ ...s, storeName: e.target.value }))}
              className="w-full border border-gray-200 rounded-[6px] px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Owner name
            </label>
            <input
              value={form.ownerName}
              onChange={(e) => setForm((s) => ({ ...s, ownerName: e.target.value }))}
              className="w-full border border-gray-200 rounded-[6px] px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="tel"
              placeholder="98XXXXXXXX"
              value={form.phone}
              onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value.replace(/\D/g, "") }))}
              className="w-full border border-gray-200 rounded-[6px] px-4 py-2.5 text-sm focus:outline-none focus:border-blue"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              District <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.district}
              onChange={(e) => setForm((s) => ({ ...s, district: e.target.value }))}
              className="w-full border border-gray-200 rounded-[6px] px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-blue"
            >
              <option value="">Select district…</option>
              {districts.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Address / location note
            </label>
            <textarea
              rows={2}
              placeholder="Street, tole, landmark…"
              value={form.address}
              onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
              className="w-full border border-gray-200 rounded-[6px] px-4 py-2.5 text-sm focus:outline-none focus:border-blue resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              Shop location
            </label>
            <LocationCapture
              value={location}
              onChange={handleLocation}
              district={form.district || null}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-[6px] px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue hover:bg-blue-dark disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-medium py-3 rounded-[6px] transition-colors"
          >
            {submitting ? "Creating…" : "Create shop & start order"}
          </button>
        </form>
      </div>
    </SalesShell>
  );
}

export default function NewBuyerPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <NewBuyerForm />
    </Suspense>
  );
}
