"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import toast from "react-hot-toast";
import { useCartStore } from "@/store/cartStore";
import {
  formatPrice,
  formatPerCarton,
  formatPiecesPerCarton,
  getImageUrl,
  getStockLabel,
} from "@/lib/utils";

export interface Product {
  id: number;
  name: string;
  brand?: string;
  price: number;
  mrp: number;
  unit: string;
  moq: number;
  piecesPerCarton?: number | null;
  pricePerCarton?: number | string | null;
  stock?: number;
  stockQty?: number;
  image?: string;
  imageUrl?: string;
  categoryId?: number;
}

function resolveCartonFields(product: Product) {
  const piecesPerCarton = product.piecesPerCarton ?? product.moq ?? 1;
  const ppcRaw = product.pricePerCarton;
  const pricePerCarton =
    ppcRaw == null
      ? product.price * (product.moq ?? 1)
      : typeof ppcRaw === "string"
        ? parseFloat(ppcRaw)
        : ppcRaw;
  return { piecesPerCarton, pricePerCarton };
}

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCartStore();
  const productImage = product.imageUrl ?? product.image;
  const stock = product.stockQty ?? product.stock ?? 0;
  const { piecesPerCarton, pricePerCarton } = resolveCartonFields(product);
  // Stock is in pieces; out of stock when fewer than 1 carton's worth remains.
  const isOutOfStock = stock < piecesPerCarton;
  const stockInfo = getStockLabel(stock, piecesPerCarton);

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (isOutOfStock) return;
    addItem({
      id: product.id,
      name: product.name,
      price: pricePerCarton,
      mrp: product.mrp,
      unit: product.unit,
      moq: product.moq,
      piecesPerCarton,
      image: productImage,
      brand: product.brand,
    });
    toast.success("1 carton added to your van");
  }

  return (
    <Link
      href={`/product/${product.id}`}
      className="group rounded-2xl shadow-md hover:shadow-xl hover:scale-[1.02] transition-all duration-300 bg-white border border-gray-100 overflow-hidden flex flex-col"
    >
      {/* Image */}
      <div className="relative aspect-square bg-blue-pale overflow-hidden">
        <Image
          src={getImageUrl(productImage)}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        <span
          className={`absolute top-2 right-2 rounded-full text-xs font-medium px-2.5 py-1 border ${
            isOutOfStock
              ? "bg-gray-100 text-gray-500 border-gray-200"
              : "bg-green-50 text-green-700 border-green-200"
          }`}
        >
          {stockInfo.label}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-3 gap-1">
        {product.brand && (
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            {product.brand}
          </p>
        )}
        <p className="text-base font-semibold text-gray-900 capitalize line-clamp-2 flex-1">
          {product.name}
        </p>
        <p className="text-xs text-gray-400 uppercase tracking-wide">{product.unit}</p>

        <div className="mt-1">
          <div className="flex items-center gap-2">
            <span className="font-grotesk font-bold text-blue text-base">
              {formatPerCarton(pricePerCarton)}
            </span>
            {product.mrp > product.price && (
              <span className="price-mrp text-xs">{formatPrice(product.mrp)}</span>
            )}
          </div>
          <p className="text-[11px] text-[#9BA3BF] mt-0.5">
            {formatPiecesPerCarton(piecesPerCarton)}
          </p>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          className="mt-2 flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:cursor-not-allowed w-full rounded-xl py-2.5 text-sm font-semibold bg-blue text-white hover:bg-blue/90 transition-colors"
        >
          <ShoppingCart size={15} />
          {isOutOfStock ? "Out of Stock" : "Add to Van"}
        </button>
      </div>
    </Link>
  );
}
