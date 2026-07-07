"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { useCartStore, type CartItem } from "@/store/cartStore";
import { unitShort, type SellUnit, type StockStatus } from "@/lib/utils";

export interface StepperProduct {
  id: string;
  name: string;
  sellUnit: SellUnit;
  /** Rs per sellUnit (carton price for cartons, piece price for pieces) */
  unitPrice: number;
  mrp?: number | null;
  moq: number;
  maxOrderQty: number;
  piecesPerCarton?: number | null;
  stockStatus: StockStatus;
  image?: string;
  brand?: string;
}

/**
 * Add-to-Van button that morphs into a MOQ-aware stepper once the product is
 * in the van. First tap adds the MOQ quantity; the center number is typeable
 * (clamped to [MOQ, maxOrderQty]); − below MOQ asks before removing; + past
 * availability is disabled with an "Only N available" hint.
 */
export default function QtyStepper({
  product,
  size = "sm",
}: {
  product: StepperProduct;
  size?: "sm" | "lg";
}) {
  const { items, addItem, updateQty, removeItem } = useCartStore();
  const inCart = items.find((i) => i.id === product.id);

  const [draft, setDraft] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [capHint, setCapHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (hintTimer.current) clearTimeout(hintTimer.current); }, []);
  useEffect(() => { if (!inCart) { setConfirmRemove(false); setDraft(null); } }, [inCart]);

  const outOfStock = product.stockStatus === "OUT_OF_STOCK" || product.maxOrderQty < 1;
  const unit = unitShort(product.sellUnit);
  const max = Math.max(product.moq, product.maxOrderQty);

  function toCartItem(): Omit<CartItem, "qty"> {
    return {
      id: product.id,
      name: product.name,
      sellUnit: product.sellUnit,
      price: product.unitPrice,
      mrp: product.mrp,
      moq: product.moq,
      maxOrderQty: product.maxOrderQty,
      piecesPerCarton: product.piecesPerCarton,
      image: product.image,
      brand: product.brand,
    };
  }

  function showCapHint() {
    setCapHint(true);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setCapHint(false), 2500);
  }

  function commitDraft() {
    if (!inCart || draft === null) return;
    const n = parseInt(draft, 10);
    setDraft(null);
    if (isNaN(n)) return;
    if (n < product.moq) {
      updateQty(product.id, product.moq);
      return;
    }
    if (n > max) {
      updateQty(product.id, max);
      showCapHint();
      return;
    }
    updateQty(product.id, n);
  }

  const btnBase =
    size === "lg"
      ? "py-3.5 rounded-xl text-base"
      : "py-2.5 rounded-xl text-sm";

  if (outOfStock) {
    return (
      <button
        disabled
        onClick={(e) => e.preventDefault()}
        className={`w-full flex items-center justify-center gap-2 bg-gray-200 text-gray-400 cursor-not-allowed font-semibold ${btnBase}`}
      >
        Out of Stock
      </button>
    );
  }

  if (!inCart) {
    return (
      <button
        onClick={(e) => {
          e.preventDefault();
          addItem(toCartItem(), product.moq);
        }}
        className={`w-full flex items-center justify-center gap-2 bg-blue text-white hover:bg-blue-dark transition-colors font-semibold ${btnBase}`}
      >
        <ShoppingCart size={size === "lg" ? 18 : 15} />
        Add to Van
      </button>
    );
  }

  if (confirmRemove) {
    return (
      <div
        onClick={(e) => e.preventDefault()}
        className={`w-full flex items-center justify-center gap-2 border border-red-200 bg-red-50 rounded-xl ${size === "lg" ? "py-2.5" : "py-1.5"}`}
      >
        <span className="text-xs font-medium text-red-600">Remove?</span>
        <button
          onClick={(e) => { e.preventDefault(); removeItem(product.id); }}
          className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg px-2.5 py-1 transition-colors"
        >
          Yes
        </button>
        <button
          onClick={(e) => { e.preventDefault(); setConfirmRemove(false); }}
          className="text-xs font-medium text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition-colors"
        >
          No
        </button>
      </div>
    );
  }

  const qty = inCart.qty;
  const atMax = qty >= max;
  const btnCls = `${size === "lg" ? "w-10 h-10" : "w-8 h-8"} flex items-center justify-center rounded-lg border border-gray-200 hover:bg-blue-pale disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0`;

  return (
    <div onClick={(e) => e.preventDefault()} className="w-full">
      <div className={`flex items-center justify-between gap-1 border border-gray-200 rounded-xl bg-white ${size === "lg" ? "p-1.5" : "p-1"}`}>
        <button
          onClick={(e) => {
            e.preventDefault();
            // Stepping below MOQ means leaving the product — confirm first.
            if (qty - 1 < product.moq) setConfirmRemove(true);
            else updateQty(product.id, qty - 1);
          }}
          className={btnCls}
          aria-label="Decrease quantity"
        >
          <Minus size={13} />
        </button>
        <div className="flex items-baseline gap-1 min-w-0">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft ?? String(qty)}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={commitDraft}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitDraft(); } }}
            onClick={(e) => e.preventDefault()}
            className={`${size === "lg" ? "w-14 text-lg" : "w-9 text-sm"} font-grotesk font-bold text-center text-ink bg-transparent outline-none`}
            aria-label={`Quantity in ${unit}`}
          />
          <span className="text-[11px] text-gray-400 shrink-0">{unit}</span>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            if (atMax) { showCapHint(); return; }
            updateQty(product.id, qty + 1);
          }}
          disabled={atMax}
          className={btnCls}
          aria-label="Increase quantity"
        >
          <Plus size={13} />
        </button>
      </div>
      {(capHint || atMax) && (
        <p className="text-[11px] text-amber-600 mt-1 text-center">
          Only {product.maxOrderQty} available
        </p>
      )}
    </div>
  );
}
