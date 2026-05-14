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

/** One character for session avatar — owner name → store → phone digit */
export function sessionInitial(p: {
  name?: string | null;
  ownerName?: string | null;
  storeName?: string | null;
  phone?: string | null;
} | null | undefined): string {
  if (!p) return "?";
  const name = (p.ownerName ?? p.name)?.trim();
  if (name) return name.charAt(0).toUpperCase();
  const store = p.storeName?.trim();
  if (store) return store.charAt(0).toUpperCase();
  const digits = p.phone?.replace(/\D/g, "") ?? "";
  return digits.slice(-1) || "?";
}
