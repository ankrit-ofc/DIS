import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api } from "../lib/api";
import { useCartStore } from "./cartStore";
import { registerForPushNotificationsAsync } from "../lib/notifications";

// NEVER import AsyncStorage. Use SecureStore only.

const TOKEN_KEY = "distro_token";

/** Register this device's Expo push token with the backend. Best-effort. */
function syncPushToken(): void {
  registerForPushNotificationsAsync()
    .then((token) => {
      if (token) return api.post("/auth/push-token", { token, platform: Platform.OS });
    })
    .catch(() => {
      // ignore — push is non-critical (no permission, simulator, offline, etc.)
    });
}

interface Profile {
  id: string;
  phone: string;
  role: "ADMIN" | "BUYER";
  /** Canonical field returned by the API (`/auth/me`, `PATCH /auth/me`). */
  ownerName?: string | null;
  storeName?: string;
  district?: string | null;
  address?: string | null;
  creditLimit?: number;
  creditUsed?: number;
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
        // Mobile is buyer-only — purge any non-buyer session that survived from a
        // prior install or admin login attempt.
        if (res.data?.role !== "BUYER") {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          useCartStore.getState().clearCart();
          set({ token: null, profile: null, isLoading: false });
          return;
        }
        set({ token, profile: res.data, isLoading: false });
        syncPushToken();
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
    syncPushToken();
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
