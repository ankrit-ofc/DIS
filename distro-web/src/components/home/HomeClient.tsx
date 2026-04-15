"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  ArrowRight,
  BarChart3,
  Box,
  Check,
  Clock,
  Plus,
  ShieldCheck,
  Truck,
  TrendingUp,
  Apple,
  Play,
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useReveal } from "@/hooks/useReveal";
import { getImageUrl, formatPrice } from "@/lib/utils";
import type { Product } from "@/components/ProductCard";

interface Category {
  id: number | string;
  name: string;
  emoji?: string;
  productCount?: number;
  _count?: { products?: number };
}

interface Props {
  categories: Category[];
  products: Product[];
  totalProducts: number;
  districtsCount: number;
}

const BRAND_PILLS = [
  "All",
  "Gorkha",
  "Barahsinghe",
  "Tuborg",
  "Carlsberg",
  "8848 Vodka",
  "Signature",
  "Red Bull",
  "Mustang",
  "Max Tiger",
];

function categoryColor(name: string): { bg: string; stroke: string } {
  const n = name.toLowerCase();
  if (n.includes("liquor") || n.includes("whisky") || n.includes("vodka"))
    return { bg: "#EFF6FF", stroke: "#2563EB" };
  if (n.includes("beer")) return { bg: "#D1FAE5", stroke: "#00A05A" };
  if (n.includes("energy")) return { bg: "#FEF3C7", stroke: "#F59E0B" };
  return { bg: "#F3F4F6", stroke: "#6B7280" };
}

function CategoryIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  const { stroke } = categoryColor(name);
  if (n.includes("liquor") || n.includes("whisky") || n.includes("vodka")) {
    return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect x="24" y="18" width="14" height="52" rx="3" fill={stroke} opacity="0.9" />
        <rect x="42" y="12" width="14" height="58" rx="3" fill={stroke} />
        <rect x="27" y="12" width="8" height="10" rx="1.5" fill="#0D1120" />
        <rect x="45" y="6" width="8" height="10" rx="1.5" fill="#0D1120" />
      </svg>
    );
  }
  if (n.includes("beer")) {
    return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect x="22" y="16" width="14" height="54" rx="3" fill="#00C46F" />
        <rect x="44" y="16" width="14" height="54" rx="3" fill="#00A05A" />
        <rect x="22" y="24" width="14" height="6" fill="#FFFFFF" opacity=".6" />
        <rect x="44" y="24" width="14" height="6" fill="#FFFFFF" opacity=".6" />
      </svg>
    );
  }
  if (n.includes("energy") || n.includes("drink") || n.includes("beverage")) {
    return (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect x="22" y="16" width="14" height="52" rx="3" fill="#F59E0B" />
        <rect x="44" y="16" width="14" height="52" rx="3" fill="#D97706" />
        <rect x="22" y="30" width="14" height="3" fill="#FFFFFF" opacity=".7" />
        <rect x="44" y="30" width="14" height="3" fill="#FFFFFF" opacity=".7" />
      </svg>
    );
  }
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <path d="M40 14 L64 26 L64 58 L40 70 L16 58 L16 26 Z" fill="#B45309" />
      <path d="M40 14 L64 26 L40 38 L16 26 Z" fill="#D97706" />
      <path d="M40 38 L40 70" stroke="#78350F" strokeWidth="1.5" />
    </svg>
  );
}

function Stat({ num, label }: { num: string; label: string }) {
  return (
    <div>
      <p className="font-display font-extrabold text-[22px] text-[color:var(--blue)] leading-none">{num}</p>
      <p className="text-[11px] text-[color:var(--gray2)] font-medium mt-1">{label}</p>
    </div>
  );
}

function TrustItem({
  icon,
  title,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  tone: "blue" | "green" | "red" | "amber";
}) {
  const bg = {
    blue: "bg-[#EFF6FF] text-[#2563EB]",
    green: "bg-[#D1FAE5] text-[#00A05A]",
    red: "bg-[#FEE2E2] text-[#DC2626]",
    amber: "bg-[#FEF3C7] text-[#D97706]",
  }[tone];
  return (
    <div className="bg-white rounded-xl border border-[color:var(--gray)] hover:border-[color:var(--blue-mid)] hover:-translate-y-0.5 transition p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-[color:var(--ink)] leading-tight">{title}</p>
        <p className="text-xs text-[color:var(--gray2)] leading-tight mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function ProductMini({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: (p: Product) => void;
}) {
  const [added, setAdded] = useState(false);
  const mrp = product.mrp ?? 0;
  const discount =
    mrp > product.price ? Math.round(((mrp - product.price) / mrp) * 100) : 0;
  const stock = product.stockQty ?? product.stock ?? 0;
  const outOfStock = stock <= 0;
  const lowStock = stock > 0 && stock <= 20;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (outOfStock) return;
    onAdd(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <Link
      href={`/product/${product.id}`}
      className="group bg-white rounded-xl border border-[color:var(--gray)] hover:border-[color:var(--blue)] hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col"
    >
      <div className="relative h-44 bg-[color:var(--off)] overflow-hidden">
        <Image
          src={getImageUrl(product.imageUrl ?? product.image)}
          alt={product.name}
          fill
          sizes="(max-width:768px) 50vw, 25vw"
          className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {discount > 0 && (
            <span className="bg-[color:var(--green)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              -{discount}%
            </span>
          )}
          {lowStock && (
            <span className="bg-[color:var(--amber)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Low stock
            </span>
          )}
          {outOfStock && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              Out of stock
            </span>
          )}
        </div>
      </div>

      <div className="p-3 flex flex-col flex-1">
        {product.brand && (
          <p className="uppercase text-[10px] text-[color:var(--blue)] font-semibold tracking-wide">
            {product.brand}
          </p>
        )}
        <p className="text-[13px] font-bold text-[color:var(--ink)] line-clamp-2 mt-0.5">
          {product.name}
        </p>
        <p className="text-[10px] text-[color:var(--gray2)] mt-0.5">{product.unit}</p>

        <div className="mt-2">
          <p className="text-base font-bold text-[color:var(--blue)]">
            Rs {product.price.toFixed(2)} / {product.unit}
          </p>
          <p className="text-[11px] text-[color:var(--gray2)] mt-0.5">
            Rs {(product.price * product.moq).toLocaleString("en-IN")} / ctn ({product.moq} pcs)
          </p>
          {mrp > product.price && (
            <p className="text-[10px] line-through text-slate-300 mt-0.5">
              Rs {mrp.toFixed(2)}
            </p>
          )}
        </div>

        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <span className="text-[10px] bg-[color:var(--gray)]/60 text-[color:var(--ink)] px-2 py-1 rounded-full font-medium">
            Min {product.moq} pcs
          </span>
          <button
            type="button"
            onClick={handleClick}
            disabled={outOfStock}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 transition ${
              outOfStock
                ? "bg-gray-300 cursor-not-allowed text-[9px] font-bold"
                : added
                ? "bg-[color:var(--green)]"
                : "bg-[color:var(--blue)] hover:bg-[color:var(--blue-dark)]"
            }`}
            aria-label="Add to cart"
          >
            {outOfStock ? "Out" : added ? <Check size={16} /> : <Plus size={16} />}
          </button>
        </div>
      </div>
    </Link>
  );
}

export default function HomeClient({
  categories,
  products,
  totalProducts,
  districtsCount,
}: Props) {
  useReveal();
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [activeBrand, setActiveBrand] = useState("All");

  const filtered = useMemo(() => {
    const list = activeBrand === "All"
      ? products
      : products.filter((p) => (p.brand ?? "").toLowerCase() === activeBrand.toLowerCase());
    return list.slice(0, 8);
  }, [products, activeBrand]);

  function addToCart(product: Product) {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      mrp: product.mrp,
      unit: product.unit,
      moq: product.moq,
      image: product.imageUrl ?? product.image,
      brand: product.brand,
    }, product.moq);
    toast.success(`${product.name} added to cart`);
  }

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="bg-white border-b border-[color:var(--gray)]">
        <div className="max-w-[1200px] mx-auto grid md:grid-cols-2 gap-10 items-center px-6 md:px-10 pt-[60px] pb-10">
          {/* LEFT */}
          <div>
            <div className="fade-up inline-flex items-center gap-2 bg-[color:var(--blue-light)] border border-[color:var(--blue-mid)] rounded-full px-3 py-1 text-xs text-[color:var(--blue)] font-semibold mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--green)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[color:var(--green)]"></span>
              </span>
              Nepal&apos;s wholesale platform
            </div>

            <h1 className="fade-up delay-1 font-display font-extrabold text-[40px] md:text-[48px] text-[color:var(--ink)] leading-tight -tracking-wide mb-4">
              Everything your shop
              <br />
              needs, in{" "}
              <span className="relative inline-block text-[color:var(--blue)]">
                one place.
                <span className="absolute left-0 right-0 bottom-0 h-1.5 bg-[color:var(--blue-mid)] -z-0" aria-hidden="true"></span>
              </span>
            </h1>

            <p className="fade-up delay-2 text-base text-[color:var(--gray2)] leading-relaxed mb-7 max-w-md">
              Browse products, compare prices, and order in bulk. Fast,
              reliable delivery across Nepal.
            </p>

            <div className="fade-up delay-3 flex flex-wrap gap-3 mb-8">
              <button
                type="button"
                onClick={() => router.push("/catalogue")}
                className="bg-[color:var(--blue)] text-white rounded-xl px-7 py-3 text-base font-bold hover:bg-[color:var(--blue-dark)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(37,99,235,.3)] transition"
              >
                Browse catalogue
              </button>
              <button
                type="button"
                onClick={() => router.push("/track")}
                className="bg-white text-[color:var(--ink)] border border-[color:var(--gray)] rounded-xl px-7 py-3 text-base font-bold hover:border-[color:var(--blue)] hover:text-[color:var(--blue)] transition"
              >
                Track my order
              </button>
            </div>

            <div className="fade-up delay-4 flex flex-wrap gap-3 mb-8">
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border border-[color:var(--gray)] rounded-xl px-4 py-2 flex items-center gap-2 hover:border-[color:var(--blue)] hover:-translate-y-0.5 transition"
              >
                <Apple size={22} className="text-[color:var(--ink)]" />
                <div className="text-left">
                  <p className="text-[9px] text-[color:var(--gray2)] leading-none">Download on the</p>
                  <p className="text-sm font-bold text-[color:var(--ink)] leading-tight">App Store</p>
                </div>
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border border-[color:var(--gray)] rounded-xl px-4 py-2 flex items-center gap-2 hover:border-[color:var(--blue)] hover:-translate-y-0.5 transition"
              >
                <Play size={22} className="text-[color:var(--ink)]" fill="currentColor" />
                <div className="text-left">
                  <p className="text-[9px] text-[color:var(--gray2)] leading-none">Get it on</p>
                  <p className="text-sm font-bold text-[color:var(--ink)] leading-tight">Google Play</p>
                </div>
              </a>
            </div>

            <div className="fade-up delay-5 flex flex-wrap gap-6 pt-6 border-t border-[color:var(--gray)]">
              <Stat num={`${totalProducts || 39}+`} label="Products" />
              <Stat num={String(districtsCount || 10)} label="Districts" />
              <Stat num="Rs 1K" label="Min order" />
              <Stat num="24h" label="Valley delivery" />
            </div>
          </div>

          {/* RIGHT */}
          <div className="relative min-h-[520px] flex items-center justify-center">
            <div className="float-anim">
              <Image
                src="/image.png"
                alt="DISTRO wholesale cart"
                width={580}
                height={500}
                priority
                style={{ objectFit: "contain", width: "100%", height: "auto", maxWidth: 580 }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.endsWith("/image.svg")) target.src = "/image.svg";
                }}
              />
            </div>

            {/* Floating badges */}
            <div className="pop-in absolute top-6 left-0 bg-white rounded-2xl shadow-md border border-[color:var(--gray)] p-3 flex items-center gap-2" style={{ animationDelay: ".8s" }}>
              <div className="w-8 h-8 bg-[color:var(--green-light)] rounded-lg flex items-center justify-center">
                <Check size={18} className="text-[color:var(--green-dark)]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[color:var(--ink)] leading-tight">Order placed!</p>
                <p className="text-[10px] text-[color:var(--gray2)] leading-tight">ORD-20240315-0042</p>
              </div>
            </div>

            <div className="pop-in absolute bottom-10 right-0 bg-white rounded-2xl shadow-md border border-[color:var(--gray)] p-3 flex items-center gap-2" style={{ animationDelay: "1s" }}>
              <div className="w-8 h-8 bg-[color:var(--blue-light)] rounded-lg flex items-center justify-center">
                <TrendingUp size={18} className="text-[color:var(--blue)]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[color:var(--ink)] leading-tight">Rs 1.2L</p>
                <p className="text-[10px] text-[color:var(--gray2)] leading-tight">This month</p>
              </div>
            </div>

            <div className="pop-in absolute top-1/2 right-4 -translate-y-1/2 bg-white rounded-2xl shadow-md border border-[color:var(--gray)] p-3 flex items-center gap-2" style={{ animationDelay: "1.2s" }}>
              <div className="w-8 h-8 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
                <Box size={18} className="text-[color:var(--amber)]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[color:var(--ink)] leading-tight">
                  {totalProducts || 39} products
                </p>
                <p className="text-[10px] text-[color:var(--gray2)] leading-tight">In stock now</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ─────────────────────────────────────── */}
      <section className="reveal grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto px-6 md:px-10 py-8">
        <TrustItem
          icon={<BarChart3 size={22} />}
          title="Wholesale prices"
          sub="Best rates on all products"
          tone="blue"
        />
        <TrustItem
          icon={<Truck size={22} />}
          title="Fast delivery"
          sub="1 day Kathmandu valley"
          tone="green"
        />
        <TrustItem
          icon={<ShieldCheck size={22} />}
          title="IRD invoices"
          sub="VAT invoices on every order"
          tone="red"
        />
        <TrustItem
          icon={<Clock size={22} />}
          title="Credit available"
          sub="Udhari for trusted buyers"
          tone="amber"
        />
      </section>

      {/* ── CATEGORIES ──────────────────────────────────────── */}
      <section className="reveal max-w-6xl mx-auto px-6 md:px-10 pb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-extrabold text-[22px] text-[color:var(--ink)]">
            Shop by category
          </h2>
          <Link
            href="/catalogue"
            className="text-sm font-semibold text-[color:var(--blue)] hover:underline"
          >
            View all →
          </Link>
        </div>

        {categories.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-48 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {categories.slice(0, 6).map((cat) => {
              const count = cat.productCount ?? cat._count?.products ?? 0;
              const tone = categoryColor(cat.name);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => router.push(`/catalogue?categoryId=${cat.id}`)}
                  className="group text-left bg-white rounded-2xl border border-[color:var(--gray)] hover:border-[color:var(--blue)] hover:shadow-[0_10px_30px_rgba(37,99,235,.15)] hover:-translate-y-1 transition p-5"
                >
                  <p className="text-base font-bold text-[color:var(--ink)]">{cat.name}</p>
                  <p className="text-xs text-[color:var(--gray2)] mt-0.5">{count} products</p>
                  <div
                    className="h-28 flex items-center justify-center mt-3 rounded-xl"
                    style={{ background: tone.bg }}
                  >
                    <div className="group-hover:scale-110 transition-transform">
                      <CategoryIcon name={cat.name} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── FEATURED PRODUCTS ───────────────────────────────── */}
      <section className="reveal max-w-6xl mx-auto px-6 md:px-10 pb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-extrabold text-[22px] text-[color:var(--ink)]">
            Featured products
          </h2>
          <Link
            href="/catalogue"
            className="text-sm font-semibold text-[color:var(--blue)] hover:underline"
          >
            See all {totalProducts || products.length} →
          </Link>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {BRAND_PILLS.map((b) => {
            const active = activeBrand === b;
            return (
              <button
                key={b}
                type="button"
                onClick={() => setActiveBrand(b)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                  active
                    ? "bg-[color:var(--blue)] text-white"
                    : "bg-white border border-[color:var(--gray)] text-[color:var(--ink)] hover:border-[color:var(--blue-mid)]"
                }`}
              >
                {b}
              </button>
            );
          })}
        </div>

        {products.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-72 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <ProductMini key={p.id} product={p} onAdd={addToCart} />
            ))}
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => router.push("/catalogue")}
            className="w-full max-w-xs border-2 border-[color:var(--blue)] text-[color:var(--blue)] font-bold rounded-xl py-3 hover:bg-[color:var(--blue)] hover:text-white transition"
          >
            Browse all products
          </button>
        </div>
      </section>

      {/* ── PROMO BANNER ─────────────────────────────────────── */}
      <section className="reveal max-w-6xl mx-auto px-6 md:px-10 pb-12">
        <div className="relative bg-[color:var(--blue)] rounded-3xl p-8 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 overflow-hidden">
          <div className="absolute -top-10 -left-10 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -bottom-10 -right-10 w-64 h-64 rounded-full bg-white/5" />

          <div className="relative z-10">
            <p className="text-[11px] font-bold text-blue-200 uppercase tracking-wider mb-2">
              Limited time offer
            </p>
            <p className="text-[28px] font-extrabold text-white leading-tight">
              Register today —
            </p>
            <p className="text-[28px] font-extrabold text-white leading-tight">
              {formatPrice(200)} credit on your first order.
            </p>
            <p className="text-sm text-blue-200 mt-2">
              For registered shopkeepers only · Valid this week
            </p>
          </div>

          <div className="relative z-10">
            <button
              type="button"
              onClick={() => router.push("/register")}
              className="inline-flex items-center gap-2 bg-white text-[color:var(--blue)] font-bold px-8 py-3.5 rounded-xl hover:-translate-y-0.5 hover:shadow-lg transition"
            >
              Create free account
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
