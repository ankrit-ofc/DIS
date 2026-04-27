"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import ProductCard, { type Product } from "@/components/ProductCard";

interface Category {
  id: number | string;
  name: string;
  emoji?: string;
  productCount?: number;
  _count?: { products?: number };
}

export default function PWAHome({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const greetingName = user?.ownerName || user?.storeName || user?.name || null;

  const featured = products.slice(0, 8);
  const topCategories = categories
    .filter((c) => (c.productCount ?? c._count?.products ?? 0) > 0)
    .slice(0, 12);

  return (
    <div className="bg-off-white min-h-screen pb-mobile-nav">
      {/* Compact header */}
      <header className="safe-top bg-blue text-white px-4 pt-3 pb-4 rounded-b-2xl shadow-sm">
        <p className="text-xs uppercase tracking-wider text-white/70">
          {greetingName ? "Namaste" : "Welcome"}
        </p>
        <h1 className="font-grotesk text-xl font-semibold mt-0.5">
          {greetingName ? `Hi, ${greetingName}` : "Welcome to DISTRO"}
        </h1>
      </header>

      {/* Search bar */}
      <div className="px-3 -mt-3">
        <button
          onClick={() => router.push("/catalogue")}
          className="w-full flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm text-left text-gray-400"
        >
          <Search size={18} className="text-gray-400" />
          <span className="text-sm">Search products, brands…</span>
        </button>
      </div>

      {/* Category quick-scroll */}
      {topCategories.length > 0 && (
        <section className="mt-5">
          <div className="px-3 flex items-center justify-between mb-2">
            <h2 className="font-grotesk text-base font-semibold text-ink">
              Categories
            </h2>
            <Link href="/catalogue" className="text-xs text-blue font-medium">
              See all
            </Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto px-3 pb-2 snap-x snap-mandatory">
            {topCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/catalogue?category=${cat.id}`}
                className="snap-start shrink-0 w-20 flex flex-col items-center gap-1.5 bg-white rounded-2xl border border-gray-100 px-2 py-3 shadow-sm"
              >
                <span className="text-2xl leading-none">
                  {cat.emoji || "📦"}
                </span>
                <span className="text-[11px] text-center font-medium text-ink line-clamp-2">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured grid */}
      {featured.length > 0 && (
        <section className="mt-4 px-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-grotesk text-base font-semibold text-ink">
              Featured
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      <div className="px-3 mt-5">
        <Link
          href="/catalogue"
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue text-white py-3 text-sm font-semibold"
        >
          View all products
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
