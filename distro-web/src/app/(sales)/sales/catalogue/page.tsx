"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, ShoppingCart } from "lucide-react";
import api from "@/lib/api";
import { debounce, formatPrice } from "@/lib/utils";
import { useSalesStore } from "@/store/salesStore";
import { useCartStore } from "@/store/cartStore";
import ProductCard, { type Product } from "@/components/ProductCard";
import SalesShell from "@/components/sales/SalesShell";

// Reuses the buyer catalogue building blocks (cards, sellUnit steppers, MOQ,
// stock caps) — the only differences are the pinned buyer banner and checkout.
export default function SalesCataloguePage() {
  const router = useRouter();
  const { buyer } = useSalesStore();
  const { items, subtotal } = useCartStore();

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [setQueryDebounced] = useState(() => debounce((v: string) => setQuery(v), 300));

  // No shop selected → back to the search flow.
  useEffect(() => {
    if (!buyer) router.replace("/sales");
  }, [buyer, router]);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["sales-products", query],
    queryFn: () =>
      api
        .get(`/products?limit=40${query ? `&search=${encodeURIComponent(query)}` : ""}`)
        .then((r) => r.data.products ?? []),
    enabled: !!buyer,
  });

  if (!buyer) return null;

  return (
    <SalesShell>
      <div className="pb-24">
        <div className="relative mb-4">
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
            placeholder="Search products…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-[6px] text-sm bg-white focus:outline-none focus:border-blue"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-white rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-16">No products found</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>

      {/* Sticky order bar */}
      {items.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30">
          <div className="max-w-lg mx-auto px-4 pb-4">
            <button
              onClick={() => router.push("/sales/checkout")}
              className="w-full flex items-center justify-between bg-blue hover:bg-blue-dark text-white rounded-xl px-5 py-3.5 transition-colors shadow-lg shadow-blue/25"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <ShoppingCart size={16} />
                {items.length} {items.length === 1 ? "product" : "products"}
              </span>
              <span className="font-grotesk font-bold">
                {formatPrice(subtotal())} →
              </span>
            </button>
          </div>
        </div>
      )}
    </SalesShell>
  );
}
