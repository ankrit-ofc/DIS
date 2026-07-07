"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Store, PlusCircle, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import { formatPrice, debounce } from "@/lib/utils";
import { useSalesStore, type SalesBuyer } from "@/store/salesStore";
import SalesShell from "@/components/sales/SalesShell";

export default function SalesHomePage() {
  const router = useRouter();
  const { setBuyer } = useSalesStore();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [setQueryDebounced] = useState(() => debounce((v: string) => setQuery(v), 300));

  const { data: summary } = useQuery<{ today: { orders: number; value: number } }>({
    queryKey: ["sales-summary"],
    queryFn: () => api.get("/sales/summary").then((r) => r.data),
  });

  const { data: buyers = [], isFetching } = useQuery<SalesBuyer[]>({
    queryKey: ["sales-buyer-search", query],
    queryFn: () =>
      api
        .get(`/sales/buyers?search=${encodeURIComponent(query)}`)
        .then((r) => r.data.buyers ?? []),
    enabled: query.trim().length >= 2,
  });

  function pickBuyer(b: SalesBuyer) {
    setBuyer(b);
    router.push("/sales/catalogue");
  }

  const searched = query.trim().length >= 2;

  return (
    <SalesShell>
      <div className="space-y-4">
        {/* Today's round */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-[8px] p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              Orders today
            </p>
            <p className="font-grotesk font-bold text-2xl text-ink mt-1">
              {summary?.today.orders ?? 0}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-[8px] p-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              Value today
            </p>
            <p className="font-grotesk font-bold text-2xl text-ink mt-1">
              {formatPrice(summary?.today.value ?? 0)}
            </p>
          </div>
        </div>

        {/* Buyer search */}
        <div className="bg-white border border-gray-200 rounded-[8px] p-4">
          <h2 className="font-grotesk font-semibold text-sm text-ink mb-3">
            Find the shop
          </h2>
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setQueryDebounced(e.target.value);
              }}
              placeholder="Shop name or phone…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-[6px] text-sm bg-white focus:outline-none focus:border-blue"
            />
          </div>

          {searched && (
            <div className="mt-3 divide-y divide-gray-100">
              {isFetching && buyers.length === 0 ? (
                <p className="text-xs text-gray-400 py-3">Searching…</p>
              ) : buyers.length === 0 ? (
                <div className="py-3">
                  <p className="text-xs text-gray-400">No shop found for “{query}”.</p>
                </div>
              ) : (
                buyers.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => pickBuyer(b)}
                    className="w-full flex items-center gap-3 py-3 text-left hover:bg-gray-50 transition-colors rounded-[6px] px-1"
                  >
                    <span className="w-8 h-8 shrink-0 rounded-full bg-blue-light text-blue flex items-center justify-center">
                      <Store size={14} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-ink truncate">
                        {b.storeName ?? "Unnamed shop"}
                      </span>
                      <span className="block text-xs text-gray-400 truncate">
                        {b.phone}
                        {b.district ? ` · ${b.district}` : ""}
                      </span>
                    </span>
                    <ChevronRight size={15} className="text-gray-300 shrink-0" />
                  </button>
                ))
              )}
              <div className="pt-3">
                <button
                  onClick={() => router.push("/sales/new-buyer")}
                  className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-[6px] py-2.5 text-sm text-blue font-medium hover:bg-blue-light/40 transition-colors"
                >
                  <PlusCircle size={15} />
                  Shop not listed? Create it
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </SalesShell>
  );
}
