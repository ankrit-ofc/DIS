import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { api } from "../lib/api";
import { useCartStore } from "./cartStore";

// NEVER import AsyncStorage. Use SecureStore only.

const TOKEN_KEY = "distro_token";

interface Profile {
  id: string;
  phone: string;
  role: "ADMIN" | "BUYER";
  /** API uses ownerName; some flows use `name` */
  name?: string;
  ownerName?: string | null;
  storeName?: string;
}

interface AuthState {
  token: string | null;
  profile: Profile | null;
  isLoading: boolean;
  loadToken: () => Promise<void>;
  setAuth: (token: string, profile: Profile) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  profile: null,
  isLoading: true,

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (token) {
        const res = await api.get("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        set({ token, profile: res.data, isLoading: false });
        return;
      }
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      useCartStore.getState().clearCart();
    }
    set({ token: null, profile: null, isLoading: false });
  },

  setAuth: async (token, profile) => {
    const prev = get().profile;
    if (prev && prev.id !== profile.id) {
      useCartStore.getState().clearCart();
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token, profile });
  },

  logout: async () => {
    const token = get().token;
    if (token) {
      try {
        await api.post("/auth/logout", {}, { headers: { Authorization: `Bearer ${token}` } });
      } catch {
        // best effort — token will still expire via JWT exp
      }
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    useCartStore.getState().clearCart();
    set({ token: null, profile: null });
  },
}));
