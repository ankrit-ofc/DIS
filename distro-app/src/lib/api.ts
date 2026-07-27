import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { emitUnauthorized } from "./authEvents";
import { API_URL } from "./config";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// Attach token from SecureStore before every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("distro_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle responses — auto-logout on 401 (expired / invalid token)
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      // Clears SecureStore + resets Zustand auth state (handler registered by
      // the auth store). RootNavigator observes `token` and will automatically
      // switch to AuthStack (Login screen) when it becomes null.
      emitUnauthorized();
    }

    const message =
      err.response?.data?.error ??
      err.response?.data?.message ??
      err.message ??
      "Network error";
    // Keep the structured body (e.g. 409 INSUFFICIENT_STOCK items) reachable.
    const wrapped = new Error(message) as Error & { status?: number; data?: unknown };
    wrapped.status = err.response?.status;
    wrapped.data = err.response?.data;
    return Promise.reject(wrapped);
  }
);
