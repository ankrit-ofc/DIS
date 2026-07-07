"use client";

import { formatPrice, formatPerPiece, pieceMargin, type SellUnit } from "@/lib/utils";

export interface PricedProduct {
  sellUnit: SellUnit;
  price: number; // Rs per piece (derived for cartons)
  mrp?: number | null; // Rs per piece
  moq: number; // in sellUnit
  piecesPerCarton?: number | null;
  pricePerCarton?: number | string | null;
}

export function unitPriceOf(p: PricedProduct): number {
  if (p.sellUnit === "CARTON") {
    const raw = p.pricePerCarton;
    if (raw != null) return typeof raw === "string" ? parseFloat(raw) : raw;
    return p.price * (p.piecesPerCarton ?? 1);
  }
  return p.price;
}

export function perPieceOf(p: PricedProduct): number {
  if (p.sellUnit === "CARTON") {
    const ppc = Math.max(1, p.piecesPerCarton ?? 1);
    return unitPriceOf(p) / ppc;
  }
  return p.price;
}

/**
 * Buyer price display. Never strikes through across mixed units — no
 * struck-through MRP anywhere.
 *   CARTON:  Rs 10,462 / carton · 24 pcs
 *            Rs 436/pc · MRP Rs 510/pc · Margin Rs 74/pc
 *   PIECE:   Rs 28 /pc
 *            MRP Rs 35 · Margin Rs 7/pc · min 50 pcs
 */
export default function PriceBlock({
  product,
  size = "sm",
}: {
  product: PricedProduct;
  size?: "sm" | "lg";
}) {
  const heroCls =
    size === "lg"
      ? "font-grotesk font-bold text-3xl text-blue"
      : "font-grotesk font-bold text-base text-blue";
  const subCls =
    size === "lg" ? "text-sm text-gray-500 mt-1" : "text-[11px] text-gray-500 mt-0.5";

  if (product.sellUnit === "CARTON") {
    const ppc = Math.max(1, product.piecesPerCarton ?? 1);
    const perPiece = perPieceOf(product);
    const margin = pieceMargin(product.mrp, perPiece);
    const segments = [formatPerPiece(perPiece)];
    if (product.mrp != null) segments.push(`MRP ${formatPerPiece(product.mrp)}`);
    if (margin != null) segments.push(`Margin ${formatPerPiece(margin)}`);
    return (
      <div>
        <p className={heroCls}>
          {formatPrice(unitPriceOf(product))}{" "}
          <span className="font-normal text-gray-500 text-[0.7em]">/ carton · {ppc} pcs</span>
        </p>
        <p className={subCls}>{segments.join(" · ")}</p>
      </div>
    );
  }

  const margin = pieceMargin(product.mrp, product.price);
  const segments: string[] = [];
  if (product.mrp != null) segments.push(`MRP ${formatPrice(product.mrp)}`);
  if (margin != null) segments.push(`Margin ${formatPerPiece(margin)}`);
  if (product.moq > 1) segments.push(`min ${product.moq} pcs`);
  return (
    <div>
      <p className={heroCls}>
        {formatPrice(product.price)}{" "}
        <span className="font-normal text-gray-500 text-[0.7em]">/pc</span>
      </p>
      {segments.length > 0 && <p className={subCls}>{segments.join(" · ")}</p>}
    </div>
  );
}
