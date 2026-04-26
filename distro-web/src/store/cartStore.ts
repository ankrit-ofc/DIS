import { create } from "zustand";
import { persist } from "zustand/middleware";

// `price` and `qty` are CARTON-based:
//   price = price per carton (Rs)
//   qty   = number of cartons (whole integers, ≥ 1)
//   piecesPerCarton is informational only — used to display "Y pieces per carton"
export interface CartItem {
  id: number;
  name: string;
  price: number;
  mrp: number;
  unit: string;
  moq: number;
  piecesPerCarton: number;
  qty: number;
  image?: string;
  brand?: string;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (id: number) => void;
  updateQty: (id: number, qty: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  totalItems: () => number;
  subtotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item, qty = 1) => {
        const safeQty = Math.max(1, Math.floor(qty));
        set((state) => {
          const existing = state.items.find((i) => i.id === item.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, qty: i.qty + safeQty } : i
              ),
            };
          }
          return {
            items: [...state.items, { ...item, qty: safeQty }],
          };
        });
      },

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQty: (id, qty) => {
        const safe = Math.floor(qty);
        set((state) => ({
          items:
            safe <= 0
              ? state.items.filter((i) => i.id !== id)
              : state.items.map((i) => (i.id === id ? { ...i, qty: safe } : i)),
        }));
      },

      clearCart: () => set({ items: [] }),

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.qty, 0),

      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
    }),
    {
      name: "distro-cart",
      partialize: (state) => ({ items: state.items }),
    }
  )
);
