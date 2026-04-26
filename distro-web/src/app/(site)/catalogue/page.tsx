"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect, Suspense } from "react";
import { SlidersHorizontal, X, Search, ChevronLeft, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import ProductCard, { Product } from "@/components/ProductCard";
import { debounce } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  emoji: string;
}

interface Brand {
  id: number;
  name: string;
}

interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc", label: "Price: High → Low" },
  { value: "name_asc", label: "Name A → Z" },
];

function CatalogueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Read params
  const q = searchParams.get("q") || "";
  const sort = searchParams.get("sort") || "newest";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const inStockOnly = searchParams.get("inStock") === "1";
  const categoryParam = searchParams.getAll("category");
  const categoryIdLegacy = searchParams.get("categoryId");
  const selectedCategories =
    categoryParam.length > 0
      ? categoryParam
      : categoryIdLegacy
        ? [categoryIdLegacy]
        : [];
  const selectedBrands = searchParams
    .getAll("brand")
    .map((s) => parseInt(s, 10))
    .filter((n) => !Number.isNaN(n));
  const priceMin = parseInt(searchParams.get("priceMin") || "0", 10);
  const priceMax = parseInt(searchParams.get("priceMax") || "10000", 10);

  const [searchInput, setSearchInput] = useState(q);

  const setParam = useCallback(
    (key: string, value: string | string[] | null) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(key);
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v));
      } else if (value !== null) {
        params.set(key, value);
      }
      params.set("page", "1");
      router.replace(`/catalogue?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(
    debounce((val: string) => setParam("q", val || null), 300),
    [setParam]
  );

  useEffect(() => {
    debouncedSearch(searchInput);
  }, [searchInput, debouncedSearch]);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: () =>
      api.get("/categories").then((r) => {
        const d = r.data;
        return Array.isArray(d) ? d : d?.categories ?? [];
      }),
    retry: false,
  });

  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: ["brands"],
    queryFn: () =>
      api.get("/brands").then((r) => {
        const body = r.data;
        if (Array.isArray(body)) return body;
        return body?.brands ?? [];
      }),
    retry: false,
  });

  const queryString = new URLSearchParams({
    sort,
    page: String(page),
    limit: "24",
    ...(q && { q }),
    ...(inStockOnly && { inStock: "1" }),
    ...(priceMin > 0 && { priceMin: String(priceMin) }),
    ...(priceMax < 10000 && { priceMax: String(priceMax) }),
  });
  selectedCategories.forEach((c) => queryString.append("categoryId", String(c)));
  selectedBrands.forEach((bId) => {
    const b = brands.find((x) => x.id === bId);
    if (b?.name) queryString.append("brand", b.name);
  });

  const { data, isLoading } = useQuery<ProductsResponse>({
    queryKey: ["products", queryString.toString()],
    queryFn: () =>
      api.get(`/products?${queryString.toString()}`).then((r) => {
        if (Array.isArray(r.data)) {
          return { products: r.data, total: r.data.length, page: 1, totalPages: 1 };
        }
        return r.data;
      }),
    retry: false,
  });

  const products = data?.products || [];
  const totalPages = data?.totalPages || 1;

  function toggleCategory(id: string) {
    const next = selectedCategories.includes(id)
      ? selectedCategories.filter((c) => c !== id)
      : [...selectedCategories, id];
    setParam("category", next);
  }

  function toggleBrand(id: number) {
    const next = selectedBrands.includes(id)
      ? selectedBrands.filter((b) => b !== id)
      : [...selectedBrands, id];
    setParam("brand", next.map(String));
  }

  const Sidebar = (
    <aside className="space-y-6">
      {/* Categories */}
      {categories.length > 0 && (
        <div>
          <h3 className="font-grotesk font-semibold text-sm text-ink mb-3">
            Category
          </h3>
          <div className="space-y-2">
            {categories.map((cat) => (
              <label key={cat.id} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(cat.id)}
                  onChange={() => toggleCategory(cat.id)}
                  className="accent-blue w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-600 group-hover:text-ink transition-colors">
                  {cat.emoji} {cat.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Brands */}
      {brands.length > 0 && (
        <div>
          <h3 className="font-grotesk font-semibold text-sm text-ink mb-3">
            Brand
          </h3>
          <div className="space-y-2">
            {brands.map((brand) => (
              <label key={brand.id} className="flex items-center gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(brand.id)}
                  onChange={() => toggleBrand(brand.id)}
                  className="accent-blue w-4 h-4 rounded"
                />
                <span className="text-sm text-gray-600 group-hover:text-ink transition-colors">
                  {brand.name}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Price Range */}
      <div>
        <h3 className="font-grotesk font-semibold text-sm text-ink mb-3">
          Price Range (Rs)
        </h3>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={priceMin}
              min={0}
              onChange={(e) => setParam("priceMin", e.target.value)}
              placeholder="Min"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue"
            />
            <span className="text-gray-400">—</span>
            <input
              type="number"
              value={priceMax}
              min={0}
              onChange={(e) => setParam("priceMax", e.target.value)}
              placeholder="Max"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue"
            />
          </div>
        </div>
      </div>

      {/* In Stock */}
      <div>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setParam("inStock", e.target.checked ? "1" : null)}
            className="accent-blue w-4 h-4 rounded"
          />
          <span className="text-sm font-medium text-ink">In Stock Only</span>
        </label>
      </div>

      {/* Clear all */}
      {(selectedCategories.length > 0 ||
        selectedBrands.length > 0 ||
        inStockOnly ||
        priceMin > 0 ||
        priceMax < 10000) && (
          <button
            onClick={() => router.push("/catalogue")}
            className="w-full text-sm text-red-500 border border-red-200 rounded-lg py-2 hover:bg-red-50 transition-colors"
          >
            Clear All Filters
          </button>
        )}
    </aside>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-8">
      <h1 className="font-grotesk font-bold text-2xl text-ink mb-6">Catalogue</h1>

      {/* Search + Sort bar */}
      <div className="flex gap-3 mb-6">
        {!q && (
          <div className="flex-1 relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search products…"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue bg-white"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setParam("q", null);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-ink"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        <select
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-blue text-ink min-w-[160px]"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          className="lg:hidden flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white hover:bg-blue-pale transition-colors"
          onClick={() => setSidebarOpen(true)}
        >
          <SlidersHorizontal size={16} />
          Filters
        </button>
      </div>

      <div className="flex gap-6">
        {/* Desktop sidebar */}
        <div className="hidden lg:block w-60 flex-shrink-0 bg-white rounded-2xl border border-gray-200 p-5 self-start sticky top-20">
          {Sidebar}
        </div>

        {/* Mobile sidebar drawer */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-ink/40 z-40"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed left-0 top-0 h-full w-72 bg-white z-50 p-5 overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-grotesk font-semibold text-lg">Filters</h2>
                <button onClick={() => setSidebarOpen(false)}>
                  <X size={20} />
                </button>
              </div>
              {Sidebar}
            </div>
          </>
        )}

        {/* Product grid */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-gray-200 aspect-[3/4] animate-pulse"
                />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-24 text-gray-400">
              <p className="text-lg font-medium">No products found</p>
              <p className="text-sm mt-2">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-4">
                {data?.total || products.length} products
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    disabled={page <= 1}
                    onClick={() => setParam("page", String(page - 1))}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-blue-pale disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <button
                        key={p}
                        onClick={() => setParam("page", String(p))}
                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${p === page
                          ? "bg-blue text-white"
                          : "border border-gray-200 hover:bg-blue-pale text-gray-600"
                          }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setParam("page", String(page + 1))}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-blue-pale disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CataloguePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading catalogue…</div>}>
      <CatalogueContent />
    </Suspense>
  );
}
