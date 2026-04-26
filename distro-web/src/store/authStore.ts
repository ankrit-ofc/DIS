import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useCartStore } from "./cartStore";

interface User {
  id: string | number;
  phone: string;
  storeName?: string | null;
  ownerName?: string | null;
  /** Some clients map display name here; API field is usually `ownerName` */
  name?: string | null;
  role: "BUYER" | "ADMIN" | "DRIVER";
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  isLoggedIn: () => boolean;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

async function revokeServerSession(token: string) {
  try {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
    await fetch(`${base}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // network best-effort — server session will still expire via JWT exp
  }
}

function setCookie(name: string, value: string, days = 30) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      _hasHydrated: false,

      setAuth: (token, user) => {
        const prev = get().user;
        // Different account signing in on the same browser — wipe prior user's per-session state
        if (prev && prev.id !== user.id) {
          useCartStore.getState().clearCart();
        }
        setCookie("distro-token", token);
        setCookie("distro-role", user.role);
        set({ token, user });
      },

      clearAuth: () => {
        const token = get().token;
        if (token) void revokeServerSession(token);
        useCartStore.getState().clearCart();
        deleteCookie("distro-token");
        deleteCookie("distro-role");
        if (typeof window !== "undefined") {
          localStorage.removeItem("distro-cart");
        }
        set({ token: null, user: null });
      },

      isLoggedIn: () => !!get().token,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "distro-auth",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        // Sync cookies on hydration for middleware to see
        if (state?.token && state?.user) {
          setCookie("distro-token", state.token);
          setCookie("distro-role", state.user.role);
        }
      },
    }
  )
);
