import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SellUnit } from "@/lib/utils";

// `price` and `qty` are in the product's sellUnit:
//   PIECE  → price = Rs/piece,  qty = pieces
//   CARTON → price = Rs/carton, qty = cartons (piecesPerCarton for display)
// `moq` and `maxOrderQty` are in the same unit; the stepper clamps qty to
// [moq, maxOrderQty]. maxOrderQty is a snapshot — the server re-validates.
export interface CartItem {
  id: string;
  name: string;
  sellUnit: SellUnit;
  price: number;
  mrp?: number | null; // Rs per piece
  moq: number;
  maxOrderQty: number;
  piecesPerCarton?: number | null;
  qty: number;
  image?: string;
  brand?: string;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  /** Refresh server-derived caps/prices after a /cart/validate round-trip. */
  applyValidation: (updates: Array<{ id: string; maxOrderQty?: number; price?: number }>) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  totalItems: () => number;
  subtotal: () => number;
}

function clampQty(qty: number, item: Pick<CartItem, "moq" | "maxOrderQty">): number {
  const min = Math.max(1, item.moq);
  const max = Math.max(min, item.maxOrderQty);
  return Math.min(max, Math.max(min, Math.floor(qty)));
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      // First add lands at MOQ (or the requested qty), clamped to availability.
      addItem: (item, qty) => {
        set((state) => {
          const existing = state.items.find((i) => i.id === item.id);
          if (existing) {
            const next = clampQty(existing.qty + (qty ?? existing.moq), existing);
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, qty: next } : i
              ),
            };
          }
          return {
            items: [...state.items, { ...item, qty: clampQty(qty ?? item.moq, item) }],
          };
        });
      },

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQty: (id, qty) => {
        set((state) => ({
          items:
            Math.floor(qty) <= 0
              ? state.items.filter((i) => i.id !== id)
              : state.items.map((i) =>
                  i.id === id ? { ...i, qty: clampQty(qty, i) } : i
                ),
        }));
      },

      applyValidation: (updates) =>
        set((state) => ({
          items: state.items.map((i) => {
            const u = updates.find((x) => x.id === i.id);
            if (!u) return i;
            return {
              ...i,
              ...(u.maxOrderQty != null && { maxOrderQty: u.maxOrderQty }),
              ...(u.price != null && { price: u.price }),
            };
          }),
        })),

      clearCart: () => set({ items: [] }),

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.qty, 0),

      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
    }),
    {
      name: "distro-cart",
      version: 2,
      // v1 carts were carton-only with numeric ids — incompatible; start fresh.
      migrate: (persisted: unknown, version: number) => {
        if (version < 2) return { items: [] as CartItem[] };
        return persisted as { items: CartItem[] };
      },
      partialize: (state) => ({ items: state.items }),
    }
  )
);
