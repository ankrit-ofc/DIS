"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useState, useRef } from "react";
import { ShoppingCart, ChevronLeft, Minus, Plus, Edit2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useCartStore } from "@/store/cartStore";
import { formatPrice, getImageUrl, getStockLabel } from "@/lib/utils";
import { Product } from "@/components/ProductCard";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const { addItem } = useCartStore();

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: () => api.get(`/products/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const [qty, setQty] = useState<number | null>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);

  const moq = product?.moq || 1;
  const currentQty = qty ?? moq;
  const productImage = product?.imageUrl ?? product?.image;

  function decrement() {
    const newQty = currentQty - moq;
    if (newQty >= moq) setQty(newQty);
  }
  function increment() {
    setQty(currentQty + moq);
  }
  function handleQtyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    if (value === '') {
      setQty(null);
      return;
    }
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setQty(num);
    }
  }
  function handleQtyBlur() {
    if (qty === null || qty < moq) {
      setQty(moq);
    }
  }

  function handleAddToCart() {
    if (!product || isOutOfStock) return;
    addItem(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        mrp: product.mrp,
        unit: product.unit,
        moq: product.moq,
        image: productImage,
        brand: product.brand,
      },
      currentQty
    );
    toast.success(`${product.name} added to your van`);
  }

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 grid md:grid-cols-2 gap-8">
        <div className="aspect-square bg-blue-pale rounded-2xl animate-pulse" />
        <div className="space-y-4">
          <div className="h-6 bg-blue-pale rounded animate-pulse w-1/3" />
          <div className="h-8 bg-blue-pale rounded animate-pulse w-3/4" />
          <div className="h-6 bg-blue-pale rounded animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 text-center text-gray-400">
        <p className="text-lg font-medium">Product not found</p>
        <Link
          href="/catalogue"
          className="mt-4 inline-flex items-center gap-1 text-blue hover:underline text-sm"
        >
          <ChevronLeft size={14} /> Back to Catalogue
        </Link>
      </div>
    );
  }

  const stock = product.stockQty ?? product.stock ?? 0;
  const stockInfo = getStockLabel(stock, product.moq);
  const discount = Math.round(
    ((product.mrp - product.price) / product.mrp) * 100
  );
  const isOutOfStock = stock <= 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/catalogue"
        className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue mb-6 transition-colors"
      >
        <ChevronLeft size={14} /> Back to Catalogue
      </Link>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Image */}
        <div className="relative aspect-square bg-blue-pale rounded-2xl overflow-hidden">
          <Image
            src={getImageUrl(productImage)}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        </div>

        {/* Details */}
        <div className="flex flex-col gap-4">
          {product.brand && (
            <span className="inline-flex self-start bg-blue-light text-blue text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
              {product.brand}
            </span>
          )}

          <h1 className="font-grotesk font-bold text-2xl sm:text-3xl text-ink">
            {product.name}
          </h1>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-medium px-3 py-1 rounded-full ${stockInfo.color}`}
            >
              {stockInfo.label}
            </span>
            <span className="text-xs text-gray-400">{product.unit}</span>
          </div>

          {/* Price */}
          <div className="flex items-end gap-3">
            <span className="font-grotesk font-bold text-3xl text-blue">
              {formatPrice(product.price)}
            </span>
            {product.mrp > product.price && (
              <span className="price-mrp text-base mb-1">
                {formatPrice(product.mrp)}
              </span>
            )}
          </div>

          {/* MOQ */}
          <div className="bg-blue-pale rounded-xl p-4">
            <p className="text-sm text-gray-600">
              <span className="font-grotesk font-semibold text-ink">
                Minimum order:
              </span>{" "}
              {product.moq} {product.unit}
            </p>
            {stock > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {stock} {product.unit} available
              </p>
            )}
          </div>

          {/* Qty selector */}
          {!isOutOfStock && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 border border-gray-200 rounded-xl p-1">
                <button
                  onClick={decrement}
                  disabled={currentQty <= moq}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-blue-pale disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Minus size={16} />
                </button>
                <input
                  ref={qtyInputRef}
                  type="number"
                  value={currentQty}
                  onChange={handleQtyChange}
                  onBlur={handleQtyBlur}
                  min={moq}
                  className="font-grotesk font-bold text-xl w-12 text-center bg-transparent border-0 outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <Edit2
                  size={12}
                  className="text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
                  onClick={() => qtyInputRef.current?.focus()}
                />
                <button
                  onClick={increment}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-blue-pale transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              <span className="text-sm text-gray-400">
                = {formatPrice(product.price * currentQty)}
              </span>
            </div>
          )}

          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className="w-full flex items-center justify-center gap-2 bg-blue hover:bg-blue-dark disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-medium py-3.5 rounded-xl text-base transition-colors shadow-lg shadow-blue/20"
          >
            <ShoppingCart size={20} />
            {isOutOfStock ? "Out of Stock" : "Add to Van"}
          </button>

          <p className="text-xs text-gray-400 text-center">
            Payments: eSewa · Khalti · Cash on Delivery
          </p>
        </div>
      </div>
    </div>
  );
}
