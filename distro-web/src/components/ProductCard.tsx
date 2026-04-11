"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import toast from "react-hot-toast";
import { useCartStore } from "@/store/cartStore";
import { formatPrice, getImageUrl, getStockLabel } from "@/lib/utils";

export interface Product {
  id: number;
  name: string;
  brand?: string;
  price: number;
  mrp: number;
  unit: string;
  moq: number;
  stock: number;
  image?: string;
  imageUrl?: string;
  categoryId?: number;
}

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCartStore();
  const productImage = product.imageUrl ?? product.image;
  const stockInfo = getStockLabel(product.stock, product.moq);
  const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      mrp: product.mrp,
      unit: product.unit,
      moq: product.moq,
      image: productImage,
      brand: product.brand,
    });
    toast.success("Added to cart");
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
        {discount > 0 && (
          <span className="absolute top-2 left-2 rounded-full text-xs font-bold px-2.5 py-1 bg-green-500 text-white">
            -{discount}%
          </span>
        )}
        <span
          className="absolute top-2 right-2 rounded-full text-xs font-medium px-2.5 py-1 bg-green-50 text-green-700 border border-green-200"
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

        <div className="flex items-center gap-2 mt-1">
          <span className="font-grotesk text-xl font-bold text-blue">
            {formatPrice(product.price)}
          </span>
          {product.mrp > product.price && (
            <span className="text-sm text-gray-400 line-through ml-1">{formatPrice(product.mrp)}</span>
          )}
        </div>

        <p className="text-xs text-gray-400">MOQ: {product.moq} {product.unit}</p>

        <button
          onClick={handleAddToCart}
          disabled={product.stock <= 0}
          className="mt-2 flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:cursor-not-allowed w-full rounded-xl py-2.5 text-sm font-semibold bg-blue text-white hover:bg-blue/90 transition-colors"
        >
          <ShoppingCart size={15} />
          {product.stock <= 0 ? "Out of Stock" : "Add to Cart"}
        </button>
      </div>
    </Link>
  );
}
