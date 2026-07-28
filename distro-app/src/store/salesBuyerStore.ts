import { create } from "zustand";
import { useCartStore } from "./cartStore";
import type { SalesBuyer } from "../lib/sales";

/**
 * The shop a SALES rep is currently ordering for.
 *
 * IN-MEMORY ONLY — deliberately never written to SecureStore. A rep who
 * reopens the app the next morning must land on the buyer picker, not on
 * yesterday's shop sitting above an empty cart.
 *
 * The selected buyer and the cart share one lifetime: changing shops or
 * clearing the selection empties the cart, and `clearSession` empties both on
 * logout. That coupling is the safety mechanism against a rep unknowingly
 * filing an order against the wrong shop.
 */
interface SalesBuyerState {
  buyer: SalesBuyer | null;
  /** Select a shop. Switching shops discards the previous shop's cart. */
  setBuyer: (buyer: SalesBuyer) => void;
  /** Deselect and discard the in-progress order. */
  clearBuyer: () => void;
}

export const useSalesBuyerStore = create<SalesBuyerState>((set, get) => ({
  buyer: null,

  setBuyer: (buyer) => {
    const prev = get().buyer;
    if (prev && prev.id !== buyer.id) {
      // The van contents belong to the shop we just left.
      useCartStore.getState().clearCart();
    }
    set({ buyer });
  },

  clearBuyer: () => {
    useCartStore.getState().clearCart();
    set({ buyer: null });
  },
}));
