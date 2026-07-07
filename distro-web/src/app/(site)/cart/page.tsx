"use client";

import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, AlertCircle } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useCartValidation, type CartIssue } from "@/hooks/useCartValidation";
import { formatPrice, getImageUrl, unitShort } from "@/lib/utils";

function IssueBanner({
  issue,
  onUpdate,
  onRemove,
  onAcceptPrice,
}: {
  issue: CartIssue;
  onUpdate: () => void;
  onRemove: () => void;
  onAcceptPrice: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <AlertCircle size={13} className="shrink-0" />
      {issue.type === "INACTIVE" && (
        <>
          <span>No longer available.</span>
          <button onClick={onRemove} className="font-semibold underline hover:no-underline">
            Remove item
          </button>
        </>
      )}
      {issue.type === "STOCK" && (
        <>
          <span>Only {issue.available} available.</span>
          {issue.available > 0 && (
            <button
              onClick={onUpdate}
              className="font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-md px-2 py-0.5 transition-colors"
            >
              Update to {issue.available}
            </button>
          )}
          <button onClick={onRemove} className="font-semibold underline hover:no-underline">
            Remove
          </button>
        </>
      )}
      {issue.type === "PRICE" && (
        <>
          <span>Price changed to {formatPrice(issue.price ?? 0)}.</span>
          <button
            onClick={onAcceptPrice}
            className="font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-md px-2 py-0.5 transition-colors"
          >
            Use new price
          </button>
        </>
      )}
    </div>
  );
}

export default function CartPage() {
  const { items, updateQty, removeItem, subtotal, applyValidation } = useCartStore();
  const { issues, revalidate } = useCartValidation();

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
        Distro Van ({items.length} {items.length === 1 ? "product" : "products"})
      </h1>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Items table */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Header — desktop */}
            <div className="hidden sm:grid grid-cols-[1fr_130px_100px_40px] gap-4 px-5 py-3 border-b border-gray-200 text-xs font-semibold text-gray-400 uppercase tracking-wide">
              <span>Product</span>
              <span className="text-center">Quantity</span>
              <span className="text-right">Subtotal</span>
              <span />
            </div>

            {/* Items */}
            {items.map((item) => {
              const unit = unitShort(item.sellUnit);
              const issue = issues.find((i) => i.id === item.id);
              const atMax = item.qty >= item.maxOrderQty;
              return (
                <div
                  key={item.id}
                  className="px-5 py-4 border-b border-gray-200 last:border-0"
                >
                  <div className="flex flex-col sm:grid sm:grid-cols-[1fr_130px_100px_40px] gap-4 items-start sm:items-center">
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
                          {formatPrice(item.price)} / {unit}
                          {item.sellUnit === "CARTON" && item.piecesPerCarton
                            ? ` · ${item.piecesPerCarton} pcs/ctn`
                            : ""}
                        </p>
                      </div>
                    </div>

                    {/* Qty controls — steps in the product's sellUnit */}
                    <div className="flex flex-col items-start sm:items-center gap-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            item.qty - 1 < item.moq
                              ? removeItem(item.id)
                              : updateQty(item.id, item.qty - 1)
                          }
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-blue-pale transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="font-grotesk font-semibold w-12 text-center text-sm">
                          {item.qty} <span className="text-[10px] text-gray-400 font-normal">{unit}</span>
                        </span>
                        <button
                          onClick={() => updateQty(item.id, item.qty + 1)}
                          disabled={atMax}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-blue-pale disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      {item.sellUnit === "CARTON" && item.piecesPerCarton ? (
                        <span className="text-[10px] text-gray-400">
                          = {item.qty * item.piecesPerCarton} pcs
                        </span>
                      ) : null}
                      {atMax && (
                        <span className="text-[10px] text-amber-600">
                          Only {item.maxOrderQty} available
                        </span>
                      )}
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

                  {issue && (
                    <IssueBanner
                      issue={issue}
                      onUpdate={() => {
                        updateQty(item.id, issue.available);
                        void revalidate();
                      }}
                      onRemove={() => removeItem(item.id)}
                      onAcceptPrice={() => {
                        if (issue.price != null) {
                          applyValidation([{ id: item.id, price: issue.price }]);
                        }
                        void revalidate();
                      }}
                    />
                  )}
                </div>
              );
            })}
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
