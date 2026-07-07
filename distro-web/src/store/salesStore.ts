import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useCartStore } from "./cartStore";

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

interface SalesState {
  /** The shop the rep is currently ordering for ("ordering for" banner). */
  buyer: SalesBuyer | null;
  setBuyer: (buyer: SalesBuyer) => void;
  clearBuyer: () => void;
}

export const useSalesStore = create<SalesState>()(
  persist(
    (set, get) => ({
      buyer: null,

      setBuyer: (buyer) => {
        // Switching shops mid-round — the van contents belong to the old shop.
        const prev = get().buyer;
        if (prev && prev.id !== buyer.id) {
          useCartStore.getState().clearCart();
        }
        set({ buyer });
      },

      clearBuyer: () => {
        useCartStore.getState().clearCart();
        set({ buyer: null });
      },
    }),
    {
      name: "distro-sales",
      // Session-scoped: a new browser session starts with no shop selected.
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
