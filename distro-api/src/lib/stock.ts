import { Product, SellUnit } from '@prisma/client';

// Buyers never see raw stockQty — only a coarse status plus a hard cap for the
// qty stepper (maxOrderQty, expressed in the product's sellUnit).
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

// LOW_STOCK thresholds: CARTON products are "low" at ≤ 5 sellable cartons;
// PIECE products are "low" at ≤ MOQ × 2 pieces remaining.
export const LOW_STOCK_CARTONS = 5;
export const LOW_STOCK_MOQ_MULTIPLIER = 2;

type ProductStockFields = Pick<
  Product,
  'sellUnit' | 'stockQty' | 'moq' | 'piecesPerCarton' | 'pricePerCarton' | 'price'
>;

/** Pieces consumed per 1 unit of the product's sellUnit (1 for PIECE). */
export function piecesPerSellUnit(p: ProductStockFields): number {
  if (p.sellUnit === 'CARTON') {
    return Math.max(1, p.piecesPerCarton ?? 1);
  }
  return 1;
}

/** Rs per 1 unit of the product's sellUnit. */
export function unitPrice(p: ProductStockFields): number {
  if (p.sellUnit === 'CARTON') {
    return p.pricePerCarton != null
      ? Number(p.pricePerCarton)
      : p.price * piecesPerSellUnit(p);
  }
  return p.price;
}

/** Minimum order quantity in the product's sellUnit (moq column, sellUnit-interpreted). */
export function moqUnits(p: ProductStockFields): number {
  return Math.max(1, p.moq);
}

/** Max orderable quantity in the product's sellUnit, derived from piece stock. */
export function maxOrderQty(p: ProductStockFields): number {
  return Math.max(0, Math.floor(p.stockQty / piecesPerSellUnit(p)));
}

export function stockStatus(p: ProductStockFields): StockStatus {
  const available = maxOrderQty(p);
  if (available < 1) return 'OUT_OF_STOCK';
  if (p.sellUnit === 'CARTON') {
    if (available <= LOW_STOCK_CARTONS) return 'LOW_STOCK';
  } else if (p.stockQty <= moqUnits(p) * LOW_STOCK_MOQ_MULTIPLIER) {
    return 'LOW_STOCK';
  }
  return 'IN_STOCK';
}

/** Short label for invoices / SMS: "pcs" or "ctn". */
export function unitLabel(unit: SellUnit): string {
  return unit === 'CARTON' ? 'ctn' : 'pcs';
}

/**
 * Buyer-facing product shape: raw stockQty stripped, stockStatus + maxOrderQty
 * added. Accepts the select-shape used by the public product endpoints.
 */
export function toBuyerProduct<T extends ProductStockFields>(
  p: T,
): Omit<T, 'stockQty' | 'pricePerCarton'> & {
  pricePerCarton: number | null;
  stockStatus: StockStatus;
  maxOrderQty: number;
} {
  const { stockQty: _stockQty, pricePerCarton, ...rest } = p;
  return {
    ...rest,
    // Decimal → number so clients never see Prisma Decimal strings.
    pricePerCarton: pricePerCarton != null ? Number(pricePerCarton) : null,
    stockStatus: stockStatus(p),
    maxOrderQty: maxOrderQty(p),
  };
}
