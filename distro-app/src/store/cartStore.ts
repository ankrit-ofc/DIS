import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { SellUnit } from "../lib/format";

// `price` and `qty` are in the product's sellUnit:
//   PIECE  → price = Rs/piece,  qty = pieces
//   CARTON → price = Rs/carton, qty = cartons
// `moq` and `maxOrderQty` share that unit; qty is clamped to [moq, maxOrderQty].
export interface CartItem {
  productId: string;
  name: string;
  sellUnit: SellUnit;
  price: number;
  mrp?: number | null;
  moq: number;
  maxOrderQty: number;
  piecesPerCarton?: number | null;
  qty: number;
  image?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  /** Refresh server-derived caps/prices after /cart/validate. */
  applyValidation: (updates: Array<{ productId: string; maxOrderQty?: number; price?: number }>) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalAmount: () => number;
}

function clampQty(qty: number, item: Pick<CartItem, "moq" | "maxOrderQty">): number {
  const min = Math.max(1, item.moq);
  const max = Math.max(min, item.maxOrderQty);
  return Math.min(max, Math.max(min, Math.floor(qty)));
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  // First add lands at MOQ (or the requested qty), clamped to availability.
  addItem: (item, qty) => {
    const existing = get().items.find((i) => i.productId === item.productId);
    if (existing) {
      set({
        items: get().items.map((i) =>
          i.productId === item.productId
            ? { ...i, qty: clampQty(i.qty + (qty ?? i.moq), i) }
            : i
        ),
      });
    } else {
      set({
        items: [...get().items, { ...item, qty: clampQty(qty ?? item.moq, item) }],
      });
    }
  },

  removeItem: (productId) =>
    set({ items: get().items.filter((i) => i.productId !== productId) }),

  updateQty: (productId, qty) => {
    if (qty <= 0) {
      set({ items: get().items.filter((i) => i.productId !== productId) });
    } else {
      set({
        items: get().items.map((i) =>
          i.productId === productId ? { ...i, qty: clampQty(qty, i) } : i
        ),
      });
    }
  },

  applyValidation: (updates) =>
    set({
      items: get().items.map((i) => {
        const u = updates.find((x) => x.productId === i.productId);
        if (!u) return i;
        return {
          ...i,
          ...(u.maxOrderQty != null && { maxOrderQty: u.maxOrderQty }),
          ...(u.price != null && { price: u.price }),
        };
      }),
    }),

  clearCart: () => set({ items: [] }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.qty, 0),

  totalAmount: () =>
    get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
}));

// Drop any cart blob written by previous app versions.
// The cart is in-memory per session and incompatible across schema changes.
export async function clearLegacyCart(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync("distro_cart");
  } catch {
    // best effort — key may not exist
  }
}
