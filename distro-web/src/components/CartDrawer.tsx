"use client";

import { X, ShoppingBag, Plus, Minus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCartStore } from "@/store/cartStore";
import { formatPrice } from "@/lib/utils";

export default function CartDrawer() {
  const { items, isOpen, closeCart, updateQty, removeItem, subtotal } =
    useCartStore();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-ink/40 z-50 backdrop-blur-sm"
        onClick={closeCart}
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-sm bg-white z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-grotesk font-semibold text-lg text-ink">
            Distro Van{" "}
            {items.length > 0 && (
              <span className="text-blue">({items.length})</span>
            )}
          </h2>
          <button
            onClick={closeCart}
            className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
            aria-label="Close distro van"
          >
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
              <ShoppingBag size={48} strokeWidth={1.2} />
              <p className="font-medium text-base">Your distro van is empty</p>
              <p className="text-sm text-center">
                Browse the catalogue to add products
              </p>
              <Link
                href="/catalogue"
                onClick={closeCart}
                className="mt-2 px-5 py-2 bg-blue text-white text-sm font-medium rounded-lg hover:bg-blue-dark transition-colors"
              >
                Browse Catalogue
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 p-3 bg-off-white rounded-xl"
                >
                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    {item.brand && (
                      <p className="text-xs text-gray-400 mb-0.5">
                        {item.brand}
                      </p>
                    )}
                    <p className="text-sm font-medium text-ink truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{item.unit}</p>
                    <p className="font-grotesk font-semibold text-blue text-sm mt-1">
                      {formatPrice(item.price * item.qty)}
                    </p>
                  </div>

                  {/* Qty + remove */}
                  <div className="flex flex-col items-end gap-2">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 size={14} />
                    </button>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQty(item.id, item.qty - item.moq)}
                        disabled={item.qty <= item.moq}
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 hover:bg-blue-pale disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="font-grotesk text-sm font-medium w-8 text-center">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, item.qty + item.moq)}
                        className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 hover:bg-blue-pale transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 px-5 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Subtotal</span>
              <span className="font-grotesk font-bold text-lg text-ink">
                {formatPrice(subtotal())}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Delivery fee calculated at checkout
            </p>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="block w-full text-center bg-blue hover:bg-blue-dark text-white font-medium py-3 rounded-xl transition-colors"
            >
              Proceed to Checkout
            </Link>
            <Link
              href="/cart"
              onClick={closeCart}
              className="block w-full text-center border border-gray-200 hover:bg-blue-pale text-gray-600 text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              View Full Van
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
