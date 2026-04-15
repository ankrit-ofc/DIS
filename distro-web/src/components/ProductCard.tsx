"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart } from "lucide-react";
import toast from "react-hot-toast";
import { useCartStore } from "@/store/cartStore";
import { formatPrice, formatUnitPrice, formatCartonPrice, getImageUrl, getStockLabel } from "@/lib/utils";

export interface Product {
  id: number;
  name: string;
  brand?: string;
  price: number;
  mrp: number;
  unit: string;
  moq: number;
  stock: number;
  stockQty?: number;
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
      className="group bg-white rounded-2xl border border-gray-200 hover:border-blue hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col"
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
          <span className="absolute top-2 left-2 bg-green text-white text-xs font-grotesk font-bold px-2 py-0.5 rounded-full">
            -{discount}%
          </span>
        )}
        <span
          className={`absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full ${stockInfo.color}`}
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
        <p className="text-sm font-medium text-ink line-clamp-2 flex-1">
          {product.name}
        </p>
        <p className="text-xs text-gray-400">{product.unit}</p>

        <div className="mt-1">
          <div className="flex items-center gap-2">
            <span className="font-grotesk font-bold text-[#2563EB] text-base">
              {formatUnitPrice(product.price, product.unit)}
            </span>
            {product.mrp > product.price && (
              <span className="price-mrp text-xs">{formatPrice(product.mrp)}</span>
            )}
          </div>
          <p className="text-[11px] text-[#9BA3BF] mt-0.5">
            {formatCartonPrice(product.price, product.moq)}
          </p>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={product.stock <= 0}
          className="mt-2 w-full flex items-center justify-center gap-2 bg-blue hover:bg-blue-dark disabled:bg-gray-200 disabled:cursor-not-allowed text-white text-sm font-medium py-2 rounded-xl transition-colors"
        >
          <ShoppingCart size={15} />
          {product.stock <= 0 ? "Out of Stock" : "Add to Cart"}
        </button>
      </div>
    </Link>
  );
}
