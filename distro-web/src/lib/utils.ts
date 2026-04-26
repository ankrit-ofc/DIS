import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return "Rs " + new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatUnitPrice(amount: number, unit: string): string {
  const val = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `Rs ${val} / ${unit}`;
}

export function formatCartonPrice(price: number, moq: number): string {
  const val = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price * moq);
  return `Rs ${val} / carton (${moq} pcs)`;
}

/** Carton price label, e.g. "Rs 1,200 / carton". `pricePerCarton` is the raw amount. */
export function formatPerCarton(pricePerCarton: number): string {
  const val = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pricePerCarton);
  return `Rs ${val} / carton`;
}

export function formatPiecesPerCarton(n: number): string {
  return `${n} ${n === 1 ? "piece" : "pieces"} per carton`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function debounce(fn: (val: string) => void, ms: number): (val: string) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (val: string) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(val), ms);
  };
}

export function getImageUrl(imageUrl: string | null | undefined): string {
  if (!imageUrl) return "/placeholder.svg";
  if (imageUrl.startsWith("http")) return imageUrl;
  const base = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:3001";
  return `${base}${imageUrl}`;
}

/** Next.js `[id]` segment — skip fetch when URL is `/…/undefined` or param missing */
export function routeParamId(param: string | string[] | undefined): string {
  const s = typeof param === "string" ? param : Array.isArray(param) ? param[0] ?? "" : "";
  if (!s || s === "undefined") return "";
  return s;
}

/** GET /districts returns `{ districts: [...] }`; some callers expect a bare array */
export function normalizeDistrictsList<T = unknown>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object" && "districts" in body) {
    const list = (body as { districts?: unknown }).districts;
    return Array.isArray(list) ? (list as T[]) : [];
  }
  return [];
}

export function getStockLabel(stock: number, moq: number): {
  label: string;
  color: string;
} {
  if (stock <= 0) return { label: "Out of Stock", color: "text-red-500 bg-red-50" };
  if (stock <= moq * 2) return { label: "Low Stock", color: "text-orange-500 bg-orange-50" };
  return { label: "In Stock", color: "text-green bg-green-light" };
}

/** Single-letter avatar for nav (owner name → store → phone) — matches API `ownerName` / `storeName` */
export function getSessionInitial(
  user:
    | {
        ownerName?: string | null;
        name?: string | null;
        storeName?: string | null;
        phone?: string | null;
      }
    | null
    | undefined
): string {
  if (!user) return "?";
  const name = (user.ownerName ?? user.name)?.trim();
  if (name) return name.charAt(0).toUpperCase();
  const store = user.storeName?.trim();
  if (store) return store.charAt(0).toUpperCase();
  const digits = user.phone?.replace(/\D/g, "") ?? "";
  return digits.slice(-1) || "?";
}

export function getSessionDisplayName(
  user: {
    ownerName?: string | null;
    name?: string | null;
    storeName?: string | null;
    phone: string;
    role: "BUYER" | "ADMIN" | "DRIVER";
  } | null
): string {
  if (!user) return "";
  if (user.role === "ADMIN") {
    return user.ownerName?.trim() || user.name?.trim() || user.storeName?.trim() || "Admin";
  }
  return user.ownerName?.trim() || user.name?.trim() || user.storeName?.trim() || user.phone;
}
