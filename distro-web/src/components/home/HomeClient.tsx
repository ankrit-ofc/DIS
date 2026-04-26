"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { motion, type Variants, useMotionValue, useAnimationFrame } from "framer-motion";
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
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { AnimatedTestimonials } from "@/components/ui/animated-testimonials";
import { DISTRO_ANIMATED_TESTIMONIALS } from "@/data/distro-testimonials";
import { useReveal } from "@/hooks/useReveal";
import { getImageUrl } from "@/lib/utils";
import type { Product } from "@/components/ProductCard";

interface Category {
  id: number | string;
  name: string;
  emoji?: string;
  description?: string | null;
  productCount?: number;
  _count?: { products?: number };
}

function deriveTag(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("beer") || n.includes("energy") || n.includes("juice") || n.includes("soft") || n.includes("water") || n.includes("drink"))
    return "Beverages";
  if (n.includes("whisk") || n.includes("vodka") || n.includes("rum") || n.includes("liquor") || n.includes("spirit") || n.includes("wine") || n.includes("gin"))
    return "Spirits";
  if (n.includes("snack") || n.includes("chip") || n.includes("biscuit") || n.includes("choco"))
    return "Snacks";
  if (n.includes("noodle") || n.includes("rice") || n.includes("flour") || n.includes("oil") || n.includes("groc"))
    return "Groceries";
  if (n.includes("tobacco") || n.includes("cigar"))
    return "Tobacco";
  return "Products";
}

function defaultDescription(name: string): string {
  return `Browse our full range of ${name.toLowerCase()} — competitive wholesale pricing for every shop.`;
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
    return { bg: "#E8EFFE", stroke: "#1A4BDB" };
  if (n.includes("beer")) return { bg: "#D1FAE5", stroke: "#00A05A" };
  if (n.includes("energy")) return { bg: "#FEF3C7", stroke: "#F59E0B" };
  return { bg: "#F3F4F6", stroke: "#6B7280" };
}

function CategoryIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  const { stroke } = categoryColor(name);
  if (n.includes("liquor") || n.includes("whisky") || n.includes("vodka")) {
    return (
      <svg width="56" height="56" viewBox="0 0 80 80" fill="none">
        <rect x="24" y="18" width="14" height="52" rx="3" fill={stroke} opacity="0.9" />
        <rect x="42" y="12" width="14" height="58" rx="3" fill={stroke} />
        <rect x="27" y="12" width="8" height="10" rx="1.5" fill="#0D1120" />
        <rect x="45" y="6" width="8" height="10" rx="1.5" fill="#0D1120" />
      </svg>
    );
  }
  if (n.includes("beer")) {
    return (
      <svg width="56" height="56" viewBox="0 0 80 80" fill="none">
        <rect x="22" y="16" width="14" height="54" rx="3" fill="#00C46F" />
        <rect x="44" y="16" width="14" height="54" rx="3" fill="#00A05A" />
        <rect x="22" y="24" width="14" height="6" fill="#FFFFFF" opacity=".6" />
        <rect x="44" y="24" width="14" height="6" fill="#FFFFFF" opacity=".6" />
      </svg>
    );
  }
  if (n.includes("energy") || n.includes("drink") || n.includes("beverage")) {
    return (
      <svg width="56" height="56" viewBox="0 0 80 80" fill="none">
        <rect x="22" y="16" width="14" height="52" rx="3" fill="#F59E0B" />
        <rect x="44" y="16" width="14" height="52" rx="3" fill="#D97706" />
        <rect x="22" y="30" width="14" height="3" fill="#FFFFFF" opacity=".7" />
        <rect x="44" y="30" width="14" height="3" fill="#FFFFFF" opacity=".7" />
      </svg>
    );
  }
  return (
    <svg width="56" height="56" viewBox="0 0 80 80" fill="none">
      <path d="M40 14 L64 26 L64 58 L40 70 L16 58 L16 26 Z" fill="#B45309" />
      <path d="M40 14 L64 26 L40 38 L16 26 Z" fill="#D97706" />
      <path d="M40 38 L40 70" stroke="#78350F" strokeWidth="1.5" />
    </svg>
  );
}

function ProductRibbon({
  products,
  onAdd,
}: {
  products: Product[];
  onAdd: (p: Product) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const pausedRef = useRef(false);
  const halfWidthRef = useRef(0);
  const speedRef = useRef(0); // px per ms

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const total = track.scrollWidth;
      halfWidthRef.current = total / 2;
      const loopMs = 30_000;
      speedRef.current = halfWidthRef.current / loopMs;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [products.length]);

  useAnimationFrame((_, delta) => {
    if (pausedRef.current || halfWidthRef.current === 0) return;
    let next = x.get() - speedRef.current * delta;
    if (next <= -halfWidthRef.current) next += halfWidthRef.current;
    x.set(next);
  });

  if (products.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-72 bg-white rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  const loop = [...products, ...products];

  return (
    <div
      className="relative"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      style={{
        maskImage:
          "linear-gradient(to right, transparent 0, black 6%, black 94%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent 0, black 6%, black 94%, transparent 100%)",
      }}
    >
      <motion.div
        ref={trackRef}
        style={{ x }}
        className="flex w-max py-2"
      >
        {loop.map((p, i) => (
          <motion.div
            key={`${p.id}-${i}`}
            whileHover={{
              y: -2,
              boxShadow: "0 10px 28px -12px rgba(15, 23, 42, 0.18)",
            }}
            transition={{ type: "spring", stiffness: 360, damping: 26 }}
            className="shrink-0 w-[220px] sm:w-[240px] mr-5 rounded-2xl"
          >
            <ProductMini product={p} onAdd={onAdd} />
          </motion.div>
        ))}
      </motion.div>
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
  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    onAdd(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <Link
      href={`/product/${product.id}`}
      className="group bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all duration-200 overflow-hidden flex flex-col"
    >
      <div className="relative h-44 bg-gray-50 overflow-hidden">
        <Image
          src={getImageUrl(product.imageUrl ?? product.image)}
          alt={product.name}
          fill
          sizes="(max-width:768px) 50vw, 25vw"
          className="object-contain p-3"
        />
      </div>

      <div className="relative p-4 flex flex-col flex-1">
        <h3 className="text-base font-medium text-gray-900 line-clamp-2 mb-1">
          {product.name}
        </h3>
        <div className="flex items-baseline gap-2 mb-auto">
          <p className="text-base font-bold text-blue">
            Rs {product.price.toFixed(2)}
          </p>
          {mrp > product.price && (
            <p className="text-xs line-through text-gray-400">
              Rs {mrp.toFixed(2)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClick}
          className="absolute bottom-3 right-3 w-8 h-8 bg-blue text-white text-sm flex items-center justify-center rounded-lg hover:bg-blue-dark active:scale-95 transition-all duration-200"
          aria-label="Add to van"
        >
          {added ? <Check size={14} /> : <Plus size={14} />}
        </button>
      </div>
    </Link>
  );
}

// ── Framer Motion variants (shared by the "Now on mobile" block) ─────────
const containerStagger: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const fadeRight: Variants = {
  hidden: { opacity: 0, x: -14 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const phoneIn: Variants = {
  hidden: { opacity: 0, y: 60, rotate: -2 },
  show: {
    opacity: 1,
    y: 0,
    rotate: 0,
    transition: { duration: 0.85, ease: [0.2, 0.8, 0.2, 1], delay: 0.1 },
  },
};

const notifIn: Variants = {
  hidden: { opacity: 0, y: -16, scale: 0.9 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 220, damping: 18, delay: 0.55 },
  },
};

/** “How ordering works” step cards */
const orderingCard: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const ORDERING_STEPS = [
  {
    n: "1",
    title: "Register your shop",
    body:
      "Sign up and add your shop details. We verify and approve within one working day.",
  },
  {
    n: "2",
    title: "Order by the case",
    body:
      "Browse the catalogue, compare wholesale prices, and add cartons to your distro van with MOQ.",
  },
  {
    n: "3",
    title: "Pay your way",
    body:
      "Pay via eSewa, Khalti, or cash on delivery. Track your order and get next-day delivery (where available).",
  },
] as const;

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
    const piecesPerCarton = product.piecesPerCarton ?? product.moq ?? 1;
    const ppcRaw = product.pricePerCarton;
    const pricePerCarton =
      ppcRaw == null
        ? product.price * (product.moq ?? 1)
        : typeof ppcRaw === "string"
          ? parseFloat(ppcRaw)
          : ppcRaw;
    addItem({
      id: product.id,
      name: product.name,
      price: pricePerCarton,
      mrp: product.mrp,
      unit: product.unit,
      moq: product.moq,
      piecesPerCarton,
      image: product.imageUrl ?? product.image,
      brand: product.brand,
    });
    toast.success(`${product.name} — 1 carton added to your van`);
  }

  return (
    <>
      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-start lg:items-center">
            {/* LEFT */}
            <div className="max-w-xl">
              <div className="fade-up inline-flex items-center gap-2.5 bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 mb-6 shadow-sm shadow-blue-100/50">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-sm text-blue-dark font-medium">Kathmandu Valley&apos;s wholesale platform</span>
              </div>

              <h1 className="fade-up delay-1 font-grotesk text-5xl lg:text-6xl font-normal text-gray-900 tracking-tight mb-5 leading-[1.1]">
                Everything your shop needs, in{" "}
                <span className="text-blue font-bold">one place</span>
              </h1>

              <p className="fade-up delay-2 text-base text-gray-500 leading-relaxed max-w-lg">
                Browse products, compare prices, and order in bulk. Fast, reliable delivery across the Kathmandu Valley.
              </p>

              <div className="fade-up delay-3 flex flex-wrap gap-4 mt-8">
                <button
                  type="button"
                  onClick={() => router.push("/catalogue")}
                  className="inline-flex items-center gap-2 bg-blue text-white rounded-xl px-7 py-3.5 text-base font-semibold hover:bg-blue-dark hover:shadow-[0_8px_30px_rgba(26,75,219,0.4)] active:scale-[0.98] transition-all duration-300"
                >
                  Browse catalogue
                  <ArrowRight size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/track")}
                  className="inline-flex items-center gap-2 bg-black text-white rounded-xl px-7 py-3.5 text-base font-semibold hover:bg-gray-900 shadow-lg active:scale-[0.98] transition-all duration-200"
                >
                  Track my order
                </button>
              </div>

              <div className="fade-up delay-4 grid grid-cols-4 gap-8 mt-10 pt-6 border-t border-gray-200">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{totalProducts || 39}+</p>
                  <p className="text-xs text-gray-500 mt-1">Products</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{districtsCount || 10}</p>
                  <p className="text-xs text-gray-500 mt-1">Districts</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">24h</p>
                  <p className="text-xs text-gray-500 mt-1">Delivery</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">1K+</p>
                  <p className="text-xs text-gray-500 mt-1">Orders</p>
                </div>
              </div>
            </div>

            {/* RIGHT — illustration + badges share one box; badge positions use % so they track the cart at any width */}
            <div className="relative mx-auto w-full max-w-lg lg:max-h-[min(480px,56vh)] lg:mx-auto">
              <div className="float-anim relative w-full">
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-blue-100 to-purple-100 rounded-3xl blur-3xl opacity-20"
                  aria-hidden
                />
                <Image
                  src="/image.png"
                  alt="DISTRO wholesale cart"
                  width={580}
                  height={500}
                  priority
                  className="relative z-[1] w-full h-auto"
                  style={{ objectFit: "contain" }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.src.endsWith("/image.svg")) target.src = "/image.svg";
                  }}
                />

                {/* Layered cards: Rs (back) → products (mid) → order (top-left) — z-order matches reference */}
                <div
                  className="pop-in absolute z-[12] bottom-[12%] right-[-2%] sm:bottom-[14%] sm:right-[-2%] w-[min(100%,13rem)] rounded-xl border border-gray-100 bg-white/95 p-3 shadow-md backdrop-blur-sm"
                  style={{ animationDelay: "1s" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                      <TrendingUp className="h-4 w-4 text-blue" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900">Rs 1.2L</p>
                      <p className="text-xs text-gray-500">This month</p>
                    </div>
                  </div>
                </div>

                <div
                  className="pop-in absolute z-[22] right-[-4%] top-[36%] w-[min(100%,13.5rem)] -translate-y-1/2 rounded-xl border border-gray-100 bg-white/95 p-3.5 shadow-md backdrop-blur-sm sm:right-[-4%] sm:top-[38%]"
                  style={{ animationDelay: "1.2s" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                      <Box className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900">
                        {totalProducts || 39} products
                      </p>
                      <p className="text-xs text-gray-500">In stock now</p>
                    </div>
                  </div>
                </div>

                <div
                  className="pop-in absolute z-[22] left-[-4%] top-[4%] w-[min(100%,13.5rem)] rounded-xl border border-gray-100 bg-white/95 p-3.5 shadow-md backdrop-blur-sm sm:left-[-4%] sm:top-[6%]"
                  style={{ animationDelay: ".8s" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900">Order placed!</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── APP DOWNLOAD ─────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl sm:rounded-3xl border border-gray-200/80 bg-white shadow-sm overflow-hidden"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] items-stretch">
            {/* LEFT — copy */}
            <motion.div
              variants={containerStagger}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.25 }}
              className="p-8 sm:p-10 lg:p-12 flex flex-col justify-center gap-7 lg:gap-8 order-2 lg:order-1"
            >
              <div>
                <motion.div
                  variants={fadeRight}
                  className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full pl-1.5 pr-3 py-1 mb-5"
                >
                  <span className="relative flex h-[7px] w-[7px]">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue opacity-60" />
                    <span className="relative inline-flex rounded-full h-[7px] w-[7px] bg-blue" />
                  </span>
                  <span className="text-[10px] font-medium text-blue uppercase tracking-[0.06em]">
                    Now on mobile
                  </span>
                </motion.div>

                <motion.h2
                  variants={fadeUp}
                  className="font-grotesk font-extrabold text-gray-900 text-[30px] sm:text-[34px] lg:text-[38px] leading-[1.04] tracking-[-0.02em] mb-4"
                >
                  Order
                  <br className="hidden sm:block" />
                  <span className="sm:hidden"> </span>
                  wholesale,
                  <br />
                  <em className="not-italic text-blue">
                    from your
                    <br className="hidden sm:block" />
                    <span className="sm:hidden"> </span>
                    pocket.
                  </em>
                </motion.h2>

                <motion.p
                  variants={fadeUp}
                  className="text-[13px] text-gray-500 leading-[1.7] max-w-[22rem] mb-5"
                >
                  Browse the full catalogue, track deliveries, and reorder your regulars — built for the Kathmandu Valley&apos;s shopkeepers.
                </motion.p>
                <motion.ul
                  variants={containerStagger}
                  className="space-y-2 mb-6 max-w-[22rem]"
                >
                  {[
                    "One-tap reordering for your regular stock.",
                    "Live delivery tracking across the Kathmandu Valley.",
                    "Offline van — add items even with patchy signal.",
                  ].map((item) => (
                    <motion.li
                      key={item}
                      variants={fadeRight}
                      className="flex items-start gap-2 text-[12.5px] text-gray-600 leading-[1.65]"
                    >
                      <Check className="mt-[3px] h-3.5 w-3.5 text-blue shrink-0" />
                      <span>{item}</span>
                    </motion.li>
                  ))}
                </motion.ul>

                <motion.div variants={fadeUp} className="flex flex-wrap gap-2.5">
                  <motion.a
                    href="#"
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    className="inline-flex items-center gap-2 bg-gray-900 text-white rounded-[10px] px-3.5 py-2 shadow-sm hover:bg-black transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    <span className="flex flex-col items-start leading-none">
                      <span className="text-[8px] opacity-70">Download on the</span>
                      <span className="text-[11.5px] font-semibold mt-0.5">App Store</span>
                    </span>
                  </motion.a>
                  <motion.a
                    href="#"
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 400, damping: 22 }}
                    className="inline-flex items-center gap-2 bg-white text-gray-900 border-[1.5px] border-gray-200 rounded-[10px] px-3.5 py-2 hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M3 20.5v-17c0-.83.94-1.3 1.6-.8l14 8.5c.6.37.6 1.23 0 1.6l-14 8.5c-.66.5-1.6.03-1.6-.8z" />
                    </svg>
                    <span className="flex flex-col items-start leading-none">
                      <span className="text-[8px] opacity-70">GET IT ON</span>
                      <span className="text-[11.5px] font-semibold mt-0.5">Google Play</span>
                    </span>
                  </motion.a>
                </motion.div>
              </div>

              <motion.div
                variants={containerStagger}
                className="flex border-t border-gray-100 pt-5"
              >
                {[
                  { n: "Free", accent: ".", label: "Always free to use" },
                  { n: "4.8", accent: "★", label: "Shopkeeper rating" },
                  { n: "1K", accent: "+", label: "Active shops" },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    variants={fadeUp}
                    className={
                      i === 0 ? "flex-1" : "flex-1 pl-5 border-l border-gray-100"
                    }
                  >
                    <p className="font-grotesk text-xl font-extrabold text-gray-900 tracking-[-0.02em] leading-none mb-1">
                      {s.n}
                      <span className="text-blue">{s.accent}</span>
                    </p>
                    <p className="text-[10px] text-gray-400">{s.label}</p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            {/* RIGHT — blue panel + phone mockup */}
            <div className="relative order-1 lg:order-2 flex items-center justify-center overflow-hidden bg-[#1D4ED8] py-10 sm:py-12 lg:py-12 px-4 min-h-[500px] sm:min-h-[540px] lg:min-h-[620px]">
              {/* Soft radial spotlight behind the phone */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "radial-gradient(55% 55% at 60% 55%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 70%)",
                }}
              />

              {/* Decorative floating circles */}
              <motion.div
                aria-hidden
                className="pointer-events-none absolute -top-24 -right-20 w-[340px] h-[340px] rounded-full bg-white/[0.06]"
                animate={{ y: [0, 14, 0], x: [0, -6, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                aria-hidden
                className="pointer-events-none absolute -bottom-16 -left-16 w-[220px] h-[220px] rounded-full bg-white/[0.05]"
                animate={{ y: [0, -10, 0], x: [0, 6, 0] }}
                transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
              />

              {/* Top-right floating notification — sits above the phone, barely tucking into the top-right corner */}
              <motion.div
                variants={notifIn}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.3 }}
                className="absolute top-3 right-3 sm:right-6 lg:right-8 z-[5] w-[186px] bg-white rounded-2xl px-3 py-2 flex items-center gap-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.22)]"
              >
                <motion.div
                  className="w-7 h-7 bg-blue-50 rounded-[8px] flex items-center justify-center text-[14px] shrink-0"
                  animate={{ rotate: [0, -8, 8, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
                >
                  📦
                </motion.div>
                <div className="min-w-0 leading-tight">
                  <span className="block text-[10.5px] font-semibold text-gray-900 whitespace-nowrap">
                    Order dispatched!
                  </span>
                  <span className="block text-[9.5px] text-gray-400 whitespace-nowrap">
                    Est. delivery · 2 hrs
                  </span>
                </div>
              </motion.div>

              {/* Bottom-left floating card (rating) */}
              <motion.div
                variants={notifIn}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.3 }}
                className="absolute bottom-8 left-4 sm:left-8 lg:left-10 z-[5] w-[210px] bg-white rounded-2xl px-3 py-2.5 flex items-center gap-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.22)]"
              >
                <motion.div
                  className="w-8 h-8 bg-amber-50 rounded-[9px] flex items-center justify-center text-[14px] shrink-0"
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  aria-hidden
                >
                  ⭐
                </motion.div>
                <div className="min-w-0 leading-tight">
                  <span className="block text-[10.5px] font-semibold text-gray-900 whitespace-nowrap">
                    Loved by shopkeepers
                  </span>
                  <span className="block text-[9.5px] text-gray-400 whitespace-nowrap">
                    4.8 / 5 average rating
                  </span>
                </div>
              </motion.div>

              {/* Phone frame (vertically centered, gently floating) */}
              <motion.div
                variants={phoneIn}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.25 }}
                className="relative z-[2] w-[240px] sm:w-[260px] lg:w-[270px]"
              >
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                >
                <div className="relative bg-gray-900 rounded-[44px] p-3 shadow-[0_30px_60px_-18px_rgba(0,0,0,0.55),0_12px_24px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/30">
                  {/* side buttons */}
                  <span
                    className="absolute -left-1 top-20 w-1 h-8 bg-gray-800 rounded-l-sm"
                    aria-hidden
                  />
                  <span
                    className="absolute -right-1 top-[70px] w-1 h-12 bg-gray-800 rounded-r-sm"
                    aria-hidden
                  />

                  <div className="relative bg-slate-50 rounded-[32px] overflow-hidden">
                    {/* status bar */}
                    <div className="flex justify-between items-center px-4 pt-3 pb-1 bg-slate-50">
                      <span className="text-[11px] font-bold text-gray-900">9:41</span>
                      <div className="flex items-center gap-1.5 text-gray-900">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1.5 8.5a13 13 0 0121 0M5 12a10 10 0 0114 0M8.5 15.5a6 6 0 017 0M12 19h.01" />
                        </svg>
                        <svg width="16" height="12" viewBox="0 0 24 12" fill="currentColor">
                          <rect x="0" y="1" width="20" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                          <rect x="2" y="3" width="12" height="6" rx="1" />
                          <path d="M22 4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                    </div>

                    {/* dynamic island */}
                    <div className="w-[88px] h-[26px] bg-gray-900 rounded-full mx-auto mb-2.5" />

                    {/* app content */}
                    <div className="px-3.5 pb-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-grotesk text-sm font-extrabold text-blue">
                          DISTRO
                        </span>
                        <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-dark">
                          RB
                        </div>
                      </div>

                      <div className="text-[10px] text-gray-400 mb-0.5">Good morning,</div>
                      <div className="text-[13px] font-semibold text-gray-900 mb-3">
                        Ramesh Bhandari <span aria-hidden>👋</span>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-[10px] h-[30px] flex items-center gap-1.5 px-2.5 mb-3.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5">
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.35-4.35" />
                        </svg>
                        <span className="text-[10px] text-gray-300">Search products...</span>
                      </div>

                      <div className="text-[8px] font-semibold text-gray-400 uppercase tracking-[0.07em] mb-2">
                        Top picks for you
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="relative bg-white border border-gray-100 rounded-xl p-2">
                          <div className="h-11 rounded-lg flex items-center justify-center text-[22px] mb-1.5 bg-yellow-100">
                            <span aria-hidden>🍜</span>
                          </div>
                          <div className="text-[9px] font-medium text-gray-900 leading-[1.3] mb-0.5">
                            Wai Wai Noodles
                          </div>
                          <div className="text-[9px] font-semibold text-blue">Rs 1,200/cs</div>
                          <div className="absolute bottom-2 right-2 w-[18px] h-[18px] bg-blue rounded-full flex items-center justify-center text-white text-sm leading-none">
                            +
                          </div>
                        </div>
                        <div className="relative bg-white border border-gray-100 rounded-xl p-2">
                          <div className="h-11 rounded-lg flex items-center justify-center text-[22px] mb-1.5 bg-green-100">
                            <span aria-hidden>🥤</span>
                          </div>
                          <div className="text-[9px] font-medium text-gray-900 leading-[1.3] mb-0.5">
                            Coke 250ml
                          </div>
                          <div className="text-[9px] font-semibold text-blue">Rs 880/cs</div>
                          <div className="absolute bottom-2 right-2 w-[18px] h-[18px] bg-blue rounded-full flex items-center justify-center text-white text-sm leading-none">
                            +
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue rounded-xl px-3.5 py-2.5 flex items-center justify-between">
                        <div>
                          <span className="block text-[9px] text-white/70 mb-0.5">
                            Last order total
                          </span>
                          <span className="block text-[13px] font-bold text-white">
                            Rs 24,500
                          </span>
                        </div>
                        <div className="bg-white/20 rounded-[7px] px-2.5 py-1.5 text-[9px] font-semibold text-white whitespace-nowrap">
                          Reorder →
                        </div>
                      </div>
                    </div>

                    {/* Bottom tab bar — looks like a real app */}
                    <div className="border-t border-gray-200/70 bg-white px-2 pt-2">
                      <div className="grid grid-cols-5 gap-1">
                        {[
                          {
                            label: "Home",
                            active: true,
                            icon: (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V11z" />
                              </svg>
                            ),
                          },
                          {
                            label: "Shop",
                            icon: (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M3 9h18l-1.5 11a2 2 0 0 1-2 1.8H6.5A2 2 0 0 1 4.5 20L3 9z" />
                                <path d="M8 9V6a4 4 0 0 1 8 0v3" />
                              </svg>
                            ),
                          },
                          {
                            label: "Van",
                            badge: 3,
                            icon: (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <circle cx="9" cy="21" r="1" />
                                <circle cx="18" cy="21" r="1" />
                                <path d="M3 3h2l2.6 12.59a2 2 0 0 0 2 1.41h8.8a2 2 0 0 0 2-1.59L22 6H6" />
                              </svg>
                            ),
                          },
                          {
                            label: "Orders",
                            icon: (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                <path d="M3.3 7l8.7 5 8.7-5M12 22V12" />
                              </svg>
                            ),
                          },
                          {
                            label: "Me",
                            icon: (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                              </svg>
                            ),
                          },
                        ].map((tab) => (
                          <div
                            key={tab.label}
                            className={`relative flex flex-col items-center gap-0.5 py-1 rounded-md ${
                              tab.active ? "text-blue" : "text-gray-400"
                            }`}
                          >
                            {tab.active && (
                              <span
                                aria-hidden
                                className="absolute top-0 h-[2px] w-5 rounded-full bg-blue"
                              />
                            )}
                            {tab.icon}
                            <span className="text-[7.5px] font-semibold tracking-wide">
                              {tab.label}
                            </span>
                            {tab.badge ? (
                              <span className="absolute top-0.5 right-1/2 translate-x-[12px] w-[11px] h-[11px] rounded-full bg-blue text-white text-[7px] font-bold flex items-center justify-center ring-[1.5px] ring-white">
                                {tab.badge}
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>

                      {/* Home indicator bar (same white surface as tab bar — no seam) */}
                      <div className="flex justify-center pt-2 pb-2">
                        <span
                          aria-hidden
                          className="block w-[90px] h-[4px] rounded-full bg-gray-900/25"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── ORDERING FLOW ────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pt-10 pb-2">
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.18 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-gray-100 bg-white/70 backdrop-blur-sm p-6 sm:p-8"
        >
          <motion.div
            variants={containerStagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <motion.div
              variants={fadeUp}
              className="md:col-span-3 flex items-end justify-between gap-6 mb-1"
            >
              <div>
                <h2 className="font-grotesk text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
                  How ordering works
                </h2>
                <p className="text-sm text-gray-500">
                  Get set up once, then reorder in minutes.
                </p>
              </div>
              <div className="hidden sm:block shrink-0">
                <motion.div whileHover={{ x: 4 }} transition={{ type: "spring", stiffness: 400, damping: 22 }}>
                  <Link
                    href="/faq"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue hover:text-blue-dark transition-colors"
                  >
                    Learn more
                    <ArrowRight size={16} />
                  </Link>
                </motion.div>
              </div>
            </motion.div>

            {ORDERING_STEPS.map((step) => (
              <motion.div
                key={step.n}
                variants={orderingCard}
                whileHover={{
                  y: -6,
                  boxShadow: "0 12px 40px -12px rgba(15, 23, 42, 0.12)",
                }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-900 text-white text-xs font-bold">
                  {step.n}
                </span>
                <h3 className="mt-3 text-base font-semibold text-gray-900">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                  {step.body}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── CATEGORIES ──────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 pt-10 pb-2">
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.18 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl border border-gray-100 bg-white/70 backdrop-blur-sm p-6 sm:p-8"
        >
          <motion.div
            variants={containerStagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <motion.div
              variants={fadeUp}
              className="md:col-span-3 flex items-end justify-between gap-6 mb-1"
            >
              <div>
                <h2 className="font-grotesk text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
                  Shop by category
                </h2>
                <p className="text-sm text-gray-500">
                  Explore our full range of wholesale products.
                </p>
              </div>
              <div className="hidden sm:block shrink-0">
                <motion.div whileHover={{ x: 4 }} transition={{ type: "spring", stiffness: 400, damping: 22 }}>
                  <Link
                    href="/catalogue"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue hover:text-blue-dark transition-colors"
                  >
                    View all
                    <ArrowRight size={16} />
                  </Link>
                </motion.div>
              </div>
            </motion.div>

            {categories.length === 0
              ? [0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    variants={orderingCard}
                    className="h-44 rounded-2xl border border-gray-100 bg-white shadow-sm animate-pulse"
                  />
                ))
              : categories.slice(0, 6).map((cat) => {
                  const count = cat.productCount ?? cat._count?.products ?? 0;
                  const desc = cat.description?.trim() || defaultDescription(cat.name);
                  const tag = deriveTag(cat.name);
                  const { bg, stroke } = categoryColor(cat.name);
                  return (
                    <motion.button
                      key={cat.id}
                      type="button"
                      variants={orderingCard}
                      whileHover={{
                        y: -6,
                        boxShadow: "0 12px 40px -12px rgba(15, 23, 42, 0.12)",
                      }}
                      transition={{ type: "spring", stiffness: 320, damping: 26 }}
                      onClick={() =>
                        router.push(
                          `/catalogue?${new URLSearchParams({ category: String(cat.id) }).toString()}`
                        )
                      }
                      className="group text-left rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className="inline-flex h-7 items-center justify-center rounded-lg px-2.5 text-[11px] font-bold"
                          style={{ backgroundColor: bg, color: stroke }}
                        >
                          {tag}
                        </span>
                        <span className="text-[11px] font-medium text-gray-400">
                          {count} {count === 1 ? "product" : "products"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-gray-900">
                        {cat.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 leading-relaxed line-clamp-3">
                        {desc}
                      </p>
                      <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue group-hover:gap-2.5 transition-all">
                        Browse
                        <ArrowRight size={14} />
                      </div>
                    </motion.button>
                  );
                })}
          </motion.div>
        </motion.div>
      </section>

      {/* ── FEATURED PRODUCTS ───────────────────────────────── */}
      <section className="bg-slate-50/30 py-14">
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-7xl mx-auto px-6"
        >
          <motion.div
            variants={containerStagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            <motion.div
              variants={fadeUp}
              className="flex items-center justify-between mb-8"
            >
              <div>
                <h2 className="font-grotesk text-2xl lg:text-3xl font-bold text-gray-900 mb-1">Featured products</h2>
                <p className="text-sm text-gray-500">Popular items from trusted brands</p>
              </div>
              <motion.div
                whileHover={{ x: 4 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="hidden md:block"
              >
                <Link
                  href="/catalogue"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-blue hover:text-blue-dark transition-colors"
                >
                  See all {totalProducts || products.length}
                  <ArrowRight size={16} />
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="flex gap-2.5 mb-8 flex-wrap"
            >
              {BRAND_PILLS.map((b) => {
                const active = activeBrand === b;
                return (
                  <motion.button
                    key={b}
                    type="button"
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 380, damping: 24 }}
                    onClick={() => setActiveBrand(b)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 ${active
                      ? "bg-blue text-white shadow-lg shadow-blue/25"
                      : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:shadow-md"
                      }`}
                  >
                    {b}
                  </motion.button>
                );
              })}
            </motion.div>

            <motion.div variants={fadeUp} key={activeBrand}>
              <ProductRibbon products={filtered} onAdd={addToCart} />
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-6 flex justify-center"
            >
              <motion.button
                type="button"
                whileHover={{ y: -2, boxShadow: "0 12px 32px -12px rgba(15,23,42,0.15)" }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 360, damping: 24 }}
                onClick={() => router.push("/catalogue")}
                className="inline-flex items-center gap-2 bg-white text-gray-900 border border-gray-200 rounded-xl px-6 py-3 text-sm font-semibold hover:border-gray-300 transition-colors"
              >
                Browse all products
                <ArrowRight size={18} />
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── TESTIMONIALS (animated carousel) ─────────────────── */}
      <section className="reveal max-w-7xl mx-auto px-6 py-14">
        <AnimatedTestimonials
          title="Trusted by shopkeepers across the Kathmandu Valley"
          subtitle="Hear from the store owners who made the switch to DISTRO."
          badgeText="Trusted by shopkeepers"
          testimonials={DISTRO_ANIMATED_TESTIMONIALS}
          autoRotateInterval={7000}
          trustedCompaniesTitle="Serving shops across the Kathmandu Valley"
          trustedCompanies={[
            "Kathmandu",
            "Lalitpur",
            "Bhaktapur",
            "Kirtipur",
            "Madhyapur Thimi",
          ]}
          className="rounded-2xl border border-gray-200/90 bg-white px-2 py-2 sm:px-4"
        />
      </section>
    </>
  );
}
