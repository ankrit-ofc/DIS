/** Safe price formatter — never crashes on undefined/null */
export function fmtRs(amount: number | undefined | null): string {
  return `Rs ${(amount ?? 0).toLocaleString()}`;
}

/** "Rs 187.50 / bottle" — per-unit pricing */
export function fmtUnitPrice(price: number, unit: string): string {
  const formatted = price.toLocaleString("en-IN", { minimumFractionDigits: price % 1 ? 2 : 0, maximumFractionDigits: 2 });
  return `Rs ${formatted} / ${unit}`;
}

/** "Rs 4,500 / carton (24 pcs)" — when moq > 1 */
export function fmtCartonPrice(price: number, moq: number, unit: string): string {
  const carton = price * moq;
  return `Rs ${carton.toLocaleString("en-IN")} / carton (${moq} ${unit}${moq > 1 ? "s" : ""})`;
}

/** "Rs 14,400 / carton (12 bottles)" — primary carton-priced display */
export function fmtCarton(pricePerCarton: number, piecesPerCarton: number, unit: string): string {
  return `Rs ${pricePerCarton.toLocaleString("en-IN")} / carton (${piecesPerCarton} ${unit}${piecesPerCarton > 1 ? "s" : ""})`;
}

// ── sellUnit-aware helpers ────────────────────────────────────────────────────
export type SellUnit = "PIECE" | "CARTON";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface PricedProduct {
  sellUnit: SellUnit;
  price: number; // Rs per piece (derived for cartons)
  mrp?: number | null; // Rs per piece
  moq: number; // in sellUnit
  piecesPerCarton?: number | null;
  pricePerCarton?: number | null;
}

export function unitShort(u: SellUnit): string {
  return u === "CARTON" ? "ctn" : "pcs";
}

/** Rs per 1 unit of the product's sellUnit. */
export function unitPriceOf(p: PricedProduct): number {
  if (p.sellUnit === "CARTON") {
    return p.pricePerCarton ?? p.price * Math.max(1, p.piecesPerCarton ?? 1);
  }
  return p.price;
}

export function perPieceOf(p: PricedProduct): number {
  if (p.sellUnit === "CARTON") {
    return unitPriceOf(p) / Math.max(1, p.piecesPerCarton ?? 1);
  }
  return p.price;
}

/** Hero price line: "Rs 10,462 / carton · 24 pcs" or "Rs 28 /pc". */
export function priceLine1(p: PricedProduct): string {
  if (p.sellUnit === "CARTON") {
    return `Rs ${unitPriceOf(p).toLocaleString("en-IN")} / carton · ${p.piecesPerCarton ?? 1} pcs`;
  }
  return `Rs ${p.price.toLocaleString("en-IN")} /pc`;
}

/**
 * Secondary line. Never a strikethrough across mixed units:
 *   CARTON → "Rs 436/pc · MRP Rs 510/pc · Margin Rs 74/pc"
 *   PIECE  → "MRP Rs 35 · Margin Rs 7/pc · min 50 pcs"
 * Margin omitted when MRP is missing or ≤ the buy price.
 */
export function priceLine2(p: PricedProduct): string | null {
  const perPc = perPieceOf(p);
  const margin = p.mrp != null && p.mrp > perPc ? p.mrp - perPc : null;
  const seg: string[] = [];
  if (p.sellUnit === "CARTON") {
    seg.push(`Rs ${Math.round(perPc).toLocaleString("en-IN")}/pc`);
    if (p.mrp != null) seg.push(`MRP Rs ${Math.round(p.mrp).toLocaleString("en-IN")}/pc`);
    if (margin != null) seg.push(`Margin Rs ${Math.round(margin).toLocaleString("en-IN")}/pc`);
  } else {
    if (p.mrp != null) seg.push(`MRP Rs ${Math.round(p.mrp).toLocaleString("en-IN")}`);
    if (margin != null) seg.push(`Margin Rs ${Math.round(margin).toLocaleString("en-IN")}/pc`);
    if (p.moq > 1) seg.push(`min ${p.moq} pcs`);
  }
  return seg.length > 0 ? seg.join(" · ") : null;
}

/** One character for session avatar — owner name → store → phone digit */
export function sessionInitial(p: {
  ownerName?: string | null;
  storeName?: string | null;
  phone?: string | null;
} | null | undefined): string {
  if (!p) return "?";
  const name = p.ownerName?.trim();
  if (name) return name.charAt(0).toUpperCase();
  const store = p.storeName?.trim();
  if (store) return store.charAt(0).toUpperCase();
  const digits = p.phone?.replace(/\D/g, "") ?? "";
  return digits.slice(-1) || "?";
}
