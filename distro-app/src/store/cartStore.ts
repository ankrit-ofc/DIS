import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  unit: string;
  piecesPerCarton: number;
  pricePerCarton: number;
  qty: number;
  image?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalAmount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  addItem: (item, qty = 1) => {
    const existing = get().items.find((i) => i.productId === item.productId);
    if (existing) {
      set({
        items: get().items.map((i) =>
          i.productId === item.productId ? { ...i, qty: i.qty + qty } : i
        ),
      });
    } else {
      set({ items: [...get().items, { ...item, qty }] });
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
          i.productId === productId ? { ...i, qty } : i
        ),
      });
    }
  },

  clearCart: () => set({ items: [] }),

  totalItems: () => get().items.reduce((sum, i) => sum + i.qty, 0),

  totalAmount: () =>
    get().items.reduce((sum, i) => sum + i.pricePerCarton * i.qty, 0),
}));

// Drop any cart blob written by the previous (per-piece) app version.
// The new cart is per-carton and incompatible — don't migrate, just discard.
export async function clearLegacyCart(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync("distro_cart");
  } catch {
    // best effort — key may not exist
  }
}
