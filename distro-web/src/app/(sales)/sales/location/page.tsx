"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ChevronLeft, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useSalesStore, type SalesBuyer } from "@/store/salesStore";
import SalesShell from "@/components/sales/SalesShell";
import type { LatLng } from "@/components/sales/LocationCapture";

const LocationCapture = dynamic(() => import("@/components/sales/LocationCapture"), {
  ssr: false,
  loading: () => <div className="h-64 bg-blue-light/40 rounded-[8px] animate-pulse" />,
});

// Capture/update the selected shop's coordinates (existing shops without a pin).
export default function SetLocationPage() {
  const router = useRouter();
  const { buyer, setBuyer } = useSalesStore();

  const [location, setLocation] = useState<LatLng | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!buyer) {
      router.replace("/sales");
      return;
    }
    if (buyer.latitude != null && buyer.longitude != null) {
      setLocation({ lat: Number(buyer.latitude), lng: Number(buyer.longitude) });
    }
  }, [buyer, router]);

  if (!buyer) return null;

  async function handleSave() {
    if (!buyer || !location) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.patch(`/sales/buyers/${buyer.id}`, {
        latitude: location.lat,
        longitude: location.lng,
      });
      const updated: SalesBuyer = res.data.buyer;
      setBuyer(updated); // same id — cart survives
      toast.success("Shop location saved");
      router.back();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? "Could not save the location");
      setSaving(false);
    }
  }

  return (
    <SalesShell>
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue mb-4 transition-colors"
      >
        <ChevronLeft size={14} /> Back
      </button>

      <div className="bg-white border border-gray-200 rounded-[8px] p-4">
        <h1 className="font-grotesk font-semibold text-base text-ink mb-1 flex items-center gap-1.5">
          <MapPin size={15} className="text-blue" />
          Shop location
        </h1>
        <p className="text-xs text-gray-400 mb-4">
          {buyer.storeName ?? buyer.phone} — drivers use this pin for navigation.
        </p>

        <LocationCapture value={location} onChange={(pos) => setLocation(pos)} district={buyer.district} />

        {error && (
          <p className="mt-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-[6px] px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !location}
          className="mt-4 w-full bg-blue hover:bg-blue-dark disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-medium py-3 rounded-[6px] transition-colors"
        >
          {saving ? "Saving…" : "Save location"}
        </button>
      </div>
    </SalesShell>
  );
}
