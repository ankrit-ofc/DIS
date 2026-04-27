"use client";

import { useEffect, useState } from "react";
import HomeClient from "./HomeClient";
import PWAHome from "./PWAHome";
import type { Product } from "@/components/ProductCard";

interface Category {
  id: number | string;
  name: string;
  emoji?: string;
  description?: string | null;
  productCount?: number;
  _count?: { products?: number };
  children?: unknown[];
}

export default function HomeSwitch(props: {
  categories: Category[];
  products: Product[];
  totalProducts: number;
  districtsCount: number;
}) {
  const [isPWA, setIsPWA] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(display-mode: standalone)");
    const update = () => setIsPWA(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  if (isPWA === null) {
    // First paint matches marketing home (server-rendered shape) to avoid flash
    return <HomeClient {...props} />;
  }

  if (isPWA) {
    return <PWAHome categories={props.categories} products={props.products} />;
  }

  return <HomeClient {...props} />;
}
