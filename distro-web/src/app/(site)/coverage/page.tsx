"use client";

import { useEffect, useState } from "react";
import { MapPin, Truck, Clock, CheckCircle, XCircle } from "lucide-react";
import api from "@/lib/api";
import { LocationMap } from "@/components/ui/expand-map";

interface District {
  id: string;
  name: string;
  deliveryFee: number;
  active: boolean;
  estimatedDays: number;
}

export default function CoveragePage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .get("/districts")
      .then((res) => setDistricts(res.data.districts))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const active = districts.filter((d) => d.active);
  const filtered = active.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="flex justify-center mb-6">
          <LocationMap
            location="Kathmandu, Nepal"
            coordinates="27.7172° N, 85.3240° E"
          />
        </div>
        <h1 className="font-grotesk font-bold text-3xl text-ink mb-3">
          Delivery Coverage
        </h1>
        <p className="text-gray-400 max-w-md mx-auto">
          We deliver across the Kathmandu Valley ({active.length} active areas).
          Check if we cover your area and see delivery fees.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
          <MapPin size={20} className="text-blue mx-auto mb-2" />
          <p className="font-grotesk font-bold text-xl text-ink">
            {loading ? "—" : active.length}
          </p>
          <p className="text-xs text-gray-400">Districts</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
          <Truck size={20} className="text-blue mx-auto mb-2" />
          <p className="font-grotesk font-bold text-xl text-ink">
            {loading
              ? "—"
              : active.some((d) => d.deliveryFee === 0)
              ? "Free"
              : `Rs ${Math.min(...active.map((d) => d.deliveryFee))}`}
          </p>
          <p className="text-xs text-gray-400">From</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
          <Clock size={20} className="text-blue mx-auto mb-2" />
          <p className="font-grotesk font-bold text-xl text-ink">
            {loading
              ? "—"
              : `${Math.min(...active.map((d) => d.estimatedDays))}–${Math.max(
                  ...active.map((d) => d.estimatedDays)
                )}`}
          </p>
          <p className="text-xs text-gray-400">Days</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search your district..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-ink placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
        />
      </div>

      {/* District List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-blue-pale rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-2xl">
          <XCircle size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-ink text-sm">No district found</p>
          <p className="text-xs text-gray-400 mt-1">
            {search
              ? "Try a different search term."
              : "No active delivery districts at the moment."}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-200">
          {filtered.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <CheckCircle size={18} className="text-green flex-shrink-0" />
                <span className="text-sm font-medium text-ink">{d.name}</span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-400">
                  {d.estimatedDays === 1
                    ? "1 day"
                    : `${d.estimatedDays} days`}
                </span>
                <span className="font-grotesk font-semibold text-ink min-w-[80px] text-right">
                  {d.deliveryFee === 0
                    ? "Free"
                    : `Rs ${d.deliveryFee.toLocaleString()}`}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="mt-10 text-center bg-blue-pale rounded-2xl p-8">
        <p className="font-grotesk font-semibold text-ink mb-2">
          Don&apos;t see your district?
        </p>
        <p className="text-sm text-gray-400 mb-4">
          We&apos;re expanding rapidly. Reach out and we&apos;ll notify you when
          we cover your area.
        </p>
        <a
          href="https://wa.me/9779851017265"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-blue hover:bg-blue-dark text-white font-medium px-6 py-3 rounded-xl transition-colors"
        >
          Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
