"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { formatPrice, getImageUrl } from "@/lib/utils";

export default function CartPage() {
  const { items, updateQty, removeItem, subtotal } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <ShoppingBag size={64} strokeWidth={1} className="mx-auto text-gray-200 mb-6" />
        <h1 className="font-grotesk font-bold text-2xl text-ink mb-3">
          Your distro van is empty
        </h1>
        <p className="text-gray-400 mb-8">
          Browse our catalogue to add products to your van.
        </p>
        <Link
          href="/catalogue"
          className="inline-flex items-center gap-2 bg-blue hover:bg-blue-dark text-white font-medium px-8 py-3.5 rounded-xl transition-colors"
        >
          Browse Catalogue
          <ArrowRight size={18} />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="font-grotesk font-bold text-2xl text-ink mb-8">
        Distro Van ({items.length} {items.length === 1 ? "item" : "items"})
      </h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Items table */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Header — desktop */}
            <div className="hidden sm:grid grid-cols-[1fr_120px_100px_40px] gap-4 px-5 py-3 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <span>Product</span>
              <span className="text-center">Quantity</span>
              <span className="text-right">Subtotal</span>
              <span />
            </div>

            {/* Items */}
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:grid sm:grid-cols-[1fr_120px_100px_40px] gap-4 items-start sm:items-center px-5 py-4 border-b border-gray-200 last:border-0"
              >
                {/* Product info */}
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 bg-blue-pale rounded-xl overflow-hidden flex-shrink-0">
                    <Image
                      src={getImageUrl(item.image)}
                      alt={item.name}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <div>
                    {item.brand && (
                      <p className="text-xs text-gray-400">{item.brand}</p>
                    )}
                    <Link
                      href={`/product/${item.id}`}
                      className="text-sm font-medium text-ink hover:text-blue transition-colors"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-gray-400">
                      {formatPrice(item.price)} / {item.unit}
                    </p>
                  </div>
                </div>

                {/* Qty controls */}
                <div className="flex items-center gap-2 sm:justify-center">
                  <button
                    onClick={() => updateQty(item.id, item.qty - item.moq)}
                    disabled={item.qty <= item.moq}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-blue-pale disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Decrease"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="font-grotesk font-semibold w-10 text-center text-sm">
                    {item.qty}
                  </span>
                  <button
                    onClick={() => updateQty(item.id, item.qty + item.moq)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-blue-pale transition-colors"
                    aria-label="Increase"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                {/* Subtotal */}
                <p className="font-grotesk font-semibold text-sm text-ink sm:text-right">
                  {formatPrice(item.price * item.qty)}
                </p>

                {/* Remove */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  aria-label="Remove item"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="lg:w-72">
          <div className="bg-white rounded-2xl border border-gray-200 p-5 sticky top-20">
            <h2 className="font-grotesk font-semibold text-base text-ink mb-4">
              Order Summary
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>
                  Subtotal ({items.length}{" "}
                  {items.length === 1 ? "item" : "items"})
                </span>
                <span className="font-grotesk font-medium text-ink">
                  {formatPrice(subtotal())}
                </span>
              </div>
              <div className="flex justify-between text-gray-400 text-xs">
                <span>Delivery fee</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between font-grotesk font-bold text-base text-ink">
                <span>Total</span>
                <span className="text-blue">{formatPrice(subtotal())}</span>
              </div>
            </div>
            <Link
              href="/checkout"
              className="mt-5 block w-full text-center bg-blue hover:bg-blue-dark text-white font-medium py-3.5 rounded-xl transition-colors shadow-lg shadow-blue/20"
            >
              Proceed to Checkout
            </Link>
            <Link
              href="/catalogue"
              className="mt-3 block w-full text-center text-sm text-gray-400 hover:text-blue transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
