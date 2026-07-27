/**
 * Shapes returned by the /sales endpoints. Mirrors BUYER_SELECT in
 * distro-api/src/routes/sales.ts — keep in sync with it.
 */
export interface SalesBuyer {
  id: string;
  storeName: string | null;
  ownerName: string | null;
  phone: string;
  district: string | null;
  address: string | null;
  /** Prisma Decimal — arrives as a string over JSON. */
  latitude: string | number | null;
  longitude: string | number | null;
  creditLimit: number;
  creditUsed: number;
}

/** Label for a shop in lists and headers. */
export function buyerLabel(buyer: SalesBuyer): string {
  return buyer.storeName?.trim() || buyer.ownerName?.trim() || buyer.phone;
}

/** Coordinates as numbers, or null when the shop has no pin yet. */
export function buyerCoords(
  buyer: SalesBuyer,
): { latitude: number; longitude: number } | null {
  if (buyer.latitude == null || buyer.longitude == null) return null;
  const latitude = Number(buyer.latitude);
  const longitude = Number(buyer.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}
