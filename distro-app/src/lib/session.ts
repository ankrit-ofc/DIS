import { Alert } from "react-native";
import { api } from "./api";
import { useAuthStore } from "../store/authStore";
import { isMobileRole } from "./roles";

/**
 * Store the session for a role the app supports (BUYER shops, SALES reps); for
 * anything else revoke the token the server just issued and point the user at
 * the web admin.
 *
 * Shared by every path that can produce a session (password login, OTP login) so
 * the role guard can't be forgotten on one of them.
 *
 * @returns true when the session was stored and the user is now logged in.
 */
export async function acceptMobileSession(token: string, profile: any): Promise<boolean> {
  if (!isMobileRole(profile?.role)) {
    try {
      await api.post("/auth/logout", {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      // best effort — token will expire on its own
    }
    Alert.alert("Admin access not available", "Admin access is on distronepal.com", [
      { text: "OK" },
    ]);
    return false;
  }
  await useAuthStore.getState().setAuth(token, profile);
  return true;
}
