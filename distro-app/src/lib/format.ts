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

/**
 * Display rounding for prices shown on a card or a detail header.
 *
 * DISPLAY ONLY. Stored values, cart lines, order totals and VAT arithmetic all
 * keep full precision — a carton at Rs 6,051.36 still bills as 6,051.36. This
 * exists because three prices with paisa on one card is unreadable at a glance,
 * not because the paisa are unwanted.
 */
function displayRs(amount: number): string {
  return Math.round(amount).toLocaleString("en-IN");
}

/** Hero price line: "Rs 10,462 / carton · 24 pcs" or "Rs 28 /pc". */
export function priceLine1(p: PricedProduct): string {
  if (p.sellUnit === "CARTON") {
    return `Rs ${displayRs(unitPriceOf(p))} / carton · ${p.piecesPerCarton ?? 1} pcs`;
  }
  return `Rs ${displayRs(p.price)} /pc`;
}

/**
 * Secondary line.
 *
 *   CARTON → "Rs 252/pc"
 *   PIECE  → "min 50 pcs"
 *
 * `showEconomics` adds the dealer figures (MRP and the shopkeeper's per-piece
 * margin). It is OFF by default: buyers were shown three unlabelled prices in
 * identical grey and read them as competing offers, and MRP/margin are ours to
 * discuss directly. Sales reps pass `true` — a rep pitches on margin at the
 * counter, so the numbers stay on rep-facing surfaces only.
 */
export function priceLine2(p: PricedProduct, showEconomics = false): string | null {
  const perPc = perPieceOf(p);
  const margin = p.mrp != null && p.mrp > perPc ? p.mrp - perPc : null;
  const seg: string[] = [];
  if (p.sellUnit === "CARTON") {
    seg.push(`Rs ${displayRs(perPc)}/pc`);
    if (showEconomics && p.mrp != null) seg.push(`MRP Rs ${displayRs(p.mrp)}/pc`);
    if (showEconomics && margin != null) seg.push(`Margin Rs ${displayRs(margin)}/pc`);
  } else {
    if (showEconomics && p.mrp != null) seg.push(`MRP Rs ${displayRs(p.mrp)}`);
    if (showEconomics && margin != null) seg.push(`Margin Rs ${displayRs(margin)}/pc`);
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
