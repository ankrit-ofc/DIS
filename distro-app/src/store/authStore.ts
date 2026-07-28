import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { api } from "../lib/api";
import { useCartStore } from "./cartStore";
import { useSalesBuyerStore } from "./salesBuyerStore";
import { registerForPushNotificationsAsync } from "../lib/notifications";
import { isMobileRole, MobileRole } from "../lib/roles";
import { setUnauthorizedHandler } from "../lib/authEvents";

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

/**
 * Wipe everything tied to the signed-in user's in-progress order. The rep's
 * selected shop and the cart must die together — see salesBuyerStore.
 */
function resetOrderState(): void {
  useCartStore.getState().clearCart();
  useSalesBuyerStore.getState().clearBuyer();
}

interface Profile {
  id: string;
  phone: string;
  /** Only roles the app can host reach the store — see lib/roles.ts. */
  role: MobileRole;
  /** Canonical field returned by the API (`/auth/me`, `PATCH /auth/me`). */
  ownerName?: string | null;
  storeName?: string;
  district?: string | null;
  address?: string | null;
  /** Prisma Decimal — arrives as a string over JSON. */
  latitude?: string | number | null;
  longitude?: string | number | null;
  creditLimit?: number;
  creditUsed?: number;
}

interface AuthState {
  token: string | null;
  profile: Profile | null;
  isLoading: boolean;
  loadToken: () => Promise<void>;
  setAuth: (token: string, profile: Profile) => Promise<void>;
  /** Refresh the cached profile after PATCH /auth/me (token unchanged). */
  setProfile: (profile: Profile) => void;
  /** Drop the local session without calling the server (used on 401). */
  clearSession: () => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Role of the signed-in user, or null when signed out. Navigation branches on
 * this. Derived rather than stored separately so it can never desync from the
 * profile.
 */
export const useUserRole = (): MobileRole | null =>
  useAuthStore((s) => s.profile?.role ?? null);

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
        // Purge any session whose role the app can't host (ADMIN/DRIVER) that
        // survived from a prior install or a login attempt.
        if (!isMobileRole(res.data?.role)) {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          resetOrderState();
          set({ token: null, profile: null, isLoading: false });
          return;
        }
        set({ token, profile: res.data, isLoading: false });
        syncPushToken();
        return;
      }
    } catch {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      resetOrderState();
    }
    set({ token: null, profile: null, isLoading: false });
  },

  setAuth: async (token, profile) => {
    const prev = get().profile;
    if (prev && prev.id !== profile.id) {
      resetOrderState();
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token, profile });
    syncPushToken();
  },

  setProfile: (profile) => set({ profile }),

  clearSession: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    resetOrderState();
    set({ token: null, profile: null });
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
    await get().clearSession();
  },
}));

// A 401 means the token is already dead, so tear the session down locally —
// calling logout() here would POST /auth/logout with that token, get another
// 401, and re-enter this handler.
setUnauthorizedHandler(() => useAuthStore.getState().clearSession());
