import HomeClient from "@/components/home/HomeClient";
import type { Product } from "@/components/ProductCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Category {
  id: number | string;
  name: string;
  emoji?: string;
  /** Set by API: direct + child-category products */
  productCount?: number;
  _count?: { products?: number };
  children?: unknown[];
}

interface District {
  id: number | string;
  name: string;
  deliveryFee?: number;
  fee?: number;
  active?: boolean;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export default async function HomePage() {
  const [catResp, prodResp, distResp] = await Promise.all([
    safeFetch<{ categories?: Category[] } | Category[]>(
      `${API_BASE}/categories`,
      { categories: [] }
    ),
    safeFetch<{ products?: Product[]; total?: number }>(
      `${API_BASE}/products?limit=12&sort=newest`,
      { products: [], total: 0 }
    ),
    safeFetch<{ districts?: District[] } | District[]>(
      `${API_BASE}/districts?active=true`,
      { districts: [] }
    ),
  ]);

  const categories: Category[] = Array.isArray(catResp)
    ? catResp
    : catResp.categories ?? [];
  const products: Product[] = prodResp.products ?? [];
  const totalProducts = prodResp.total ?? products.length;
  const districts: District[] = Array.isArray(distResp)
    ? distResp
    : distResp.districts ?? [];

  return (
    <>
      <HomeClient
        categories={categories}
        products={products}
        totalProducts={totalProducts}
        districtsCount={districts.length}
      />
    </>
  );
}
